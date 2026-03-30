// Common BLE target pair used by Niimbot B1 and similar models.
const NIIMBOT_SERVICE_UUID = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const NIIMBOT_IO_CHARACTERISTIC_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';
const PRINTHEAD_WIDTH_PIXELS = 384;
const DEFAULT_LABEL_HEIGHT_PIXELS = 160;
const PACKET_SEND_DELAY_MS = 20;
const DEFAULT_WAIT_BETWEEN_PRINT_LINES_MS = 10;
const DEFAULT_PRINT_LINE_BATCH_SIZE = 8;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

type PrinterPacket = {
	replyType: number;
	payload: number[];
	rawBytes: number[];
};

export class NiimbotService {
	deviceId: string | null = null;
	lastError: string | null = null;
	private device: BluetoothDevice | null = null;
	private server: BluetoothRemoteGATTServer | null = null;
	private ioCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
	private connectionListeners = new Set<(deviceId: string | null) => void>();
	private packetQueue: PrinterPacket[] = [];
	private waitBetweenPrintLinesMs = DEFAULT_WAIT_BETWEEN_PRINT_LINES_MS;
	private printLineBatchSize = DEFAULT_PRINT_LINE_BATCH_SIZE;

	private clearConnectionState() {
		this.device = null;
		this.server = null;
		this.ioCharacteristic = null;
		this.deviceId = null;
	}

	isConnected() {
		return Boolean(this.ioCharacteristic && this.server?.connected);
	}

	private notifyConnectionListeners() {
		for (const listener of this.connectionListeners) {
			listener(this.deviceId);
		}
	}

	subscribeConnection(listener: (deviceId: string | null) => void) {
		this.connectionListeners.add(listener);
		listener(this.deviceId);

		return () => {
			this.connectionListeners.delete(listener);
		};
	}

	getPrintTuning() {
		return {
			waitBetweenPrintLinesMs: this.waitBetweenPrintLinesMs,
			printLineBatchSize: this.printLineBatchSize
		};
	}

	setPrintTuning(options: {
		waitBetweenPrintLinesMs?: number;
		printLineBatchSize?: number;
	}) {
		if (options.waitBetweenPrintLinesMs !== undefined) {
			this.waitBetweenPrintLinesMs = clamp(Math.round(options.waitBetweenPrintLinesMs), 0, 1000);
		}

		if (options.printLineBatchSize !== undefined) {
			this.printLineBatchSize = clamp(Math.round(options.printLineBatchSize), 1, 512);
		}
	}

	async initialize() {
		if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
			throw new Error('Web Bluetooth API not available in this browser.');
		}
	}

	async connect() {
		try {
			this.lastError = null;
			if (this.isConnected()) {
				return true;
			}

			this.clearConnectionState();
			if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
				this.lastError = 'Web Bluetooth is not available in this browser.';
				return false;
			}

			console.log('Scanning for Niimbot printer...');
			const device = await navigator.bluetooth.requestDevice({
				acceptAllDevices: true,
				optionalServices: [NIIMBOT_SERVICE_UUID]
			});

			console.log(`Found device: ${device.name} (${device.id})`);
			this.device = device;
			this.deviceId = device.id;
			device.addEventListener('gattserverdisconnected', () => {
				console.log(`Device ${device.id} disconnected.`);
				this.clearConnectionState();
				this.notifyConnectionListeners();
			});

			const server = await device.gatt?.connect();
			if (!server) {
				throw new Error('Could not connect to the printer.');
			}

			this.server = server;
			const service = await server.getPrimaryService(NIIMBOT_SERVICE_UUID);
			const characteristic = await service.getCharacteristic(NIIMBOT_IO_CHARACTERISTIC_UUID);
			this.ioCharacteristic = characteristic;

			await characteristic.startNotifications();
			characteristic.addEventListener('characteristicvaluechanged', (event) => {
				const target = event.target as BluetoothRemoteGATTCharacteristic | null;
				if (!target?.value) return;
				this.handleIncomingData(target.value);
			});

			await this.sendProtocolConnect();
			await sleep(120);

			console.log('Successfully connected and listening for notifications!');
			this.notifyConnectionListeners();
			return true;
		} catch (error) {
			console.error('Failed to connect to printer:', error);
			this.clearConnectionState();
			this.lastError =
				error instanceof Error ? error.message : 'Failed to connect to the printer.';
			this.notifyConnectionListeners();
			return false;
		}
	}

	private buildPacket(commandType: number, data: number[] = [], prefixByte?: number): DataView {
		const length = data.length;
		const packet = [0x55, 0x55, commandType, length, ...data];

		// Checksum is XOR of command, length, and payload bytes.
		let checksum = commandType ^ length;
		for (const byte of data) {
			checksum ^= byte;
		}

		packet.push(checksum, 0xaa, 0xaa);

		if (prefixByte !== undefined) {
			packet.unshift(prefixByte & 0xff);
		}

		const uint8Array = new Uint8Array(packet);
		return new DataView(uint8Array.buffer);
	}

	private async writePacket(dataView: DataView, writeWithResponse = true) {
		if (!this.ioCharacteristic) {
			throw new Error('Printer is not connected.');
		}

		await sleep(PACKET_SEND_DELAY_MS);
		const payload = dataView.buffer.slice(0) as ArrayBuffer;

		if (writeWithResponse) {
			await this.ioCharacteristic.writeValueWithResponse(payload);
			return;
		}

		await this.ioCharacteristic.writeValueWithoutResponse(payload);
	}

	private clearPacketQueue() {
		this.packetQueue = [];
	}

	private async waitForPacket(
		matcher: (packet: PrinterPacket) => boolean,
		timeoutMs = 30_000
	): Promise<PrinterPacket> {
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			for (let index = 0; index < this.packetQueue.length; index += 1) {
				const packet = this.packetQueue[index];

				if (packet.replyType === 0xdb) {
					this.packetQueue.splice(index, 1);
					throw new Error(
						`Printer reported error 0x${(packet.payload[0] ?? 0).toString(16)}`
					);
				}

				if (packet.replyType === 0x00) {
					this.packetQueue.splice(index, 1);
					throw new Error(
						`Printer does not support command payload [${packet.payload.join(', ')}]`
					);
				}

				if (matcher(packet)) {
					this.packetQueue.splice(index, 1);
					return packet;
				}
			}

			await sleep(20);
		}

		throw new Error('Timed out waiting for printer response.');
	}

	private async transceive(
		commandType: number,
		data: number[] = [],
		responseOffset = 1,
		awaitResponse = true
	) {
		const responseType = (commandType + responseOffset) & 0xff;
		this.clearPacketQueue();
		await this.sendCommand(commandType, data, true);

		if (!awaitResponse) {
			return null;
		}

		return this.waitForPacket((packet) => packet.replyType === responseType);
	}

	private handleIncomingData(dataView: DataView) {
		const bytes: number[] = [];

		for (let index = 0; index < dataView.byteLength; index += 1) {
			bytes.push(dataView.getUint8(index));
		}

		console.log('Received raw bytes from printer:', bytes);

		if (bytes[0] === 0x55 && bytes[1] === 0x55) {
			const replyType = bytes[2];
			const dataLength = bytes[3];
			const payload = bytes.slice(4, 4 + dataLength);
			this.packetQueue.push({
				replyType,
				payload,
				rawBytes: bytes
			});

			console.log(`Received Reply Type: 0x${replyType.toString(16)}, Payload:`, payload);

			if (replyType === 0x1a) {
				console.log('RFID / Paper Size Data:', payload);
			}

			if (replyType === 0xdb) {
				console.error('Printer reported a print error:', payload);
			}
		}
	}

	private packUint16(value: number): [number, number] {
		return [(value >> 8) & 0xff, value & 0xff];
	}

	private countBlackBits(bytes: Uint8Array) {
		let count = 0;

		for (const byte of bytes) {
			let value = byte;
			while (value > 0) {
				count += value & 1;
				value >>= 1;
			}
		}

		return count;
	}

	private getBlackPixelCountBytes(bytes: Uint8Array): [number, number, number] {
		// Mirror hass-niimbot exactly: three 1-byte counters, each calculated from
		// a 4-byte slice in the raster header prefix.
		return [
			this.countBlackBits(bytes.slice(0, 4)) & 0xff,
			this.countBlackBits(bytes.slice(4, 8)) & 0xff,
			this.countBlackBits(bytes.slice(8, 12)) & 0xff
		];
	}

	private createCanvas(width: number, height: number) {
		if (typeof document === 'undefined') {
			throw new Error('Canvas rendering is only available in the browser.');
		}

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Could not create 2D canvas context for label rendering.');
		}

		return { canvas, context };
	}

	private drawTextLabel(
		context: CanvasRenderingContext2D,
		text: string,
		width = PRINTHEAD_WIDTH_PIXELS,
		height = DEFAULT_LABEL_HEIGHT_PIXELS
	) {
		const inset = clamp(Math.round(height * 0.06), 10, 24);
		const contentX = clamp(Math.round(width * 0.06), 20, 28);
		const titleFontSize = clamp(Math.round(height * 0.18), 26, 44);
		const bodyFontSize = clamp(Math.round(height * 0.11), 18, 30);
		const titleY = clamp(Math.round(height * 0.12), 20, Math.max(20, height - 80));
		const bodyY = clamp(
			Math.round(height * 0.43),
			titleY + titleFontSize + 10,
			Math.max(titleY + titleFontSize + 10, height - 60)
		);
		const upperBarY = clamp(Math.round(height * 0.72), bodyY + bodyFontSize + 8, Math.max(0, height - 30));
		const lowerBarY = clamp(Math.round(height * 0.82), upperBarY + 10, Math.max(0, height - 18));
		const upperBarHeight = clamp(Math.round(height * 0.035), 4, 10);
		const lowerBarHeight = clamp(Math.round(height * 0.06), 8, 16);

		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, width, height);

		context.strokeStyle = '#000000';
		context.lineWidth = 4;
		context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

		context.fillStyle = '#000000';
		context.textBaseline = 'top';
		context.font = `bold ${titleFontSize}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
		context.fillText('WHAT THE BLOCK', contentX, titleY);

		context.font = `${bodyFontSize}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
		context.fillText(text.trim() || 'Printer connection OK', contentX, bodyY, width - contentX * 2);

		context.fillRect(contentX, upperBarY, width - contentX * 2, upperBarHeight);
		context.fillRect(contentX, lowerBarY, Math.floor((width - contentX * 2) * 0.6), lowerBarHeight);
	}

	private renderTextLabelRows(text: string, width = PRINTHEAD_WIDTH_PIXELS, height = DEFAULT_LABEL_HEIGHT_PIXELS) {
		const { context } = this.createCanvas(width, height);

		this.drawTextLabel(context, text, width, height);

		const imageData = context.getImageData(0, 0, width, height).data;
		const bytesPerRow = width / 8;
		const rows: Uint8Array[] = [];

		for (let y = 0; y < height; y += 1) {
			const row = new Uint8Array(bytesPerRow);

			for (let x = 0; x < width; x += 1) {
				const pixelOffset = (y * width + x) * 4;
				const red = imageData[pixelOffset];
				const green = imageData[pixelOffset + 1];
				const blue = imageData[pixelOffset + 2];
				const alpha = imageData[pixelOffset + 3];
				const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
				const isBlackPixel = alpha > 0 && luminance < 200;

				if (isBlackPixel) {
					row[Math.floor(x / 8)] |= 1 << (7 - (x % 8));
				}
			}

			rows.push(row);
		}

		return rows;
	}

	getTestLabelPreview(
		text = 'Printer connection OK',
		height = DEFAULT_LABEL_HEIGHT_PIXELS,
		width = PRINTHEAD_WIDTH_PIXELS
	) {
		const { canvas, context } = this.createCanvas(width, height);
		this.drawTextLabel(context, text, width, height);

		return {
			dataUrl: canvas.toDataURL('image/png'),
			width: canvas.width,
			height: canvas.height
		};
	}

	async sendCommand(commandType: number, data: number[] = [], writeWithResponse = true) {
		if (!this.deviceId) {
			throw new Error('Cannot send command: Printer is not connected.');
		}

		const dataView = this.buildPacket(commandType, data);

		try {
			await this.writePacket(dataView, writeWithResponse);
			console.log(
				`Sent command: 0x${commandType.toString(16)} with data [${data.join(', ')}]`
			);
		} catch (error) {
			console.error('Failed to write to printer:', error);
			throw error;
		}
	}

	async sendProtocolConnect() {
		if (!this.deviceId) {
			throw new Error('Cannot send protocol connect: Printer is not connected.');
		}

		const dataView = this.buildPacket(0xc1, [0x01], 0x03);

		try {
			await this.writePacket(dataView, true);
			console.log('Sent protocol connect command: 0xc1 with data [1]');
		} catch (error) {
			console.error('Failed to send protocol connect command:', error);
			throw error;
		}
	}

	async sendSimpleCommand(commandType: number) {
		await this.sendCommand(commandType, [0x01]);
	}

	async requestPrinterInfo() {
		// `0x40` is the PrinterInfo command family. Payload `0x0b` is documented
		// as a request for the device serial number and is a better B1 smoke test.
		return this.transceive(0x40, [0x0b], 0x0b);
	}

	async requestRfidInfo() {
		return this.transceive(0x1a, [0x01]);
	}

	async requestPrintStatus() {
		const packet = await this.transceive(0xa3, [0x01], 0x10);
		if (!packet || packet.payload.length < 4) {
			return null;
		}

		const page = (packet.payload[0] << 8) | packet.payload[1];
		const progress = Math.min(packet.payload[2], packet.payload[3]);
		return { page, progress };
	}

	async sendHeartbeat(awaitResponse = true) {
		// The wiki shows `0x01` and `0x04` heartbeat payload variants. Start with
		// the more common simple variant until a different version is needed.
		return this.transceive(0xdc, [0x01], 1, awaitResponse);
	}

	async printInternalTestPage() {
		await this.sendSimpleCommand(0x5a);
	}

	async setDensity(density = 3) {
		const packet = await this.transceive(0x21, [density & 0xff], 0x10);
		return packet?.payload[0] === 1;
	}

	async setLabelType(type = 1) {
		const packet = await this.transceive(0x23, [type & 0xff], 0x10);
		return packet?.payload[0] === 1;
	}

	async printStart(totalPages = 1, pageColor = 0) {
		const [pagesHigh, pagesLow] = this.packUint16(totalPages);
		const packet = await this.transceive(0x01, [
			pagesHigh,
			pagesLow,
			0x00,
			0x00,
			0x00,
			0x00,
			pageColor & 0xff
		]);
		return packet?.payload[0] === 1;
	}

	async pageStart() {
		const packet = await this.transceive(0x03, [0x01]);
		return packet?.payload[0] === 1;
	}

	async setPageSize(rows: number, columns = PRINTHEAD_WIDTH_PIXELS, copies = 1) {
		const [rowsHigh, rowsLow] = this.packUint16(rows);
		const [columnsHigh, columnsLow] = this.packUint16(columns);
		const [copiesHigh, copiesLow] = this.packUint16(copies);

		const packet = await this.transceive(0x13, [
			rowsHigh,
			rowsLow,
			columnsHigh,
			columnsLow,
			copiesHigh,
			copiesLow
		]);
		return packet?.payload[0] === 1;
	}

	async printEmptyRow(rowNumber: number, repeatCount = 1, writeWithResponse = true) {
		const [rowHigh, rowLow] = this.packUint16(rowNumber);
		await this.sendCommand(0x84, [rowHigh, rowLow, repeatCount & 0xff], writeWithResponse);
	}

	async printBitmapRow(
		rowNumber: number,
		rowBytes: Uint8Array,
		repeatCount = 1,
		writeWithResponse = true
	) {
		const [rowHigh, rowLow] = this.packUint16(rowNumber);
		const blackPixelCount = this.getBlackPixelCountBytes(rowBytes);
		await this.sendCommand(0x85, [
			rowHigh,
			rowLow,
			...blackPixelCount,
			repeatCount & 0xff,
			...rowBytes
		], writeWithResponse);
	}

	async pageEnd() {
		const packet = await this.transceive(0xe3, [0x01]);
		return packet?.payload[0] === 1;
	}

	async printEnd() {
		const packet = await this.transceive(0xf3, [0x01]);
		return packet?.payload[0] === 1;
	}

	async getPrintEnd() {
		const status = await this.requestPrintStatus();
		if (!status) {
			return false;
		}

		return status.progress >= 100;
	}

	async printTestLabel(
		text = 'Printer connection OK',
		height = DEFAULT_LABEL_HEIGHT_PIXELS,
		width = PRINTHEAD_WIDTH_PIXELS
	) {
		if (!this.deviceId) {
			throw new Error('Printer is not connected.');
		}

		const rows = this.renderTextLabelRows(text, width, height);
		return this.printRows(rows, width);
	}

	canvasToRows(canvas: HTMLCanvasElement) {
		const width = canvas.width;
		const height = canvas.height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Could not get 2d context from canvas.');

		const imageData = context.getImageData(0, 0, width, height).data;
		const bytesPerRow = width / 8;
		const rows: Uint8Array[] = [];

		for (let y = 0; y < height; y += 1) {
			const row = new Uint8Array(bytesPerRow);

			for (let x = 0; x < width; x += 1) {
				const pixelOffset = (y * width + x) * 4;
				const red = imageData[pixelOffset];
				const green = imageData[pixelOffset + 1];
				const blue = imageData[pixelOffset + 2];
				const alpha = imageData[pixelOffset + 3];
				const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
				const isBlackPixel = alpha > 0 && luminance < 200;

				if (isBlackPixel) {
					row[Math.floor(x / 8)] |= 1 << (7 - (x % 8));
				}
			}

			rows.push(row);
		}

		return rows;
	}

	async printCanvasLabel(canvas: HTMLCanvasElement) {
		if (!this.deviceId) {
			throw new Error('Printer is not connected.');
		}

		const width = canvas.width;
		const rows = this.canvasToRows(canvas);

		return this.printRows(rows, width);
	}

	private async printRows(rows: Uint8Array[], width = PRINTHEAD_WIDTH_PIXELS) {

		if (!(await this.setDensity(3))) {
			throw new Error('Could not set print density.');
		}
		if (!(await this.setLabelType(1))) {
			throw new Error('Could not set label type.');
		}
		if (!(await this.printStart(1, 0))) {
			throw new Error('Could not start print job.');
		}
		if (!(await this.pageStart())) {
			throw new Error('Could not start print page.');
		}
		if (!(await this.setPageSize(rows.length, width, 1))) {
			throw new Error('Could not set page size.');
		}

		let pendingEmptyRowStart: number | null = null;
		let pendingEmptyRowCount = 0;
		let transmittedRowCommands = 0;

		const shouldConfirmRowWrite = () =>
			this.printLineBatchSize <= 1 ||
			(transmittedRowCommands + 1) % this.printLineBatchSize === 0;

		const flushEmptyRows = async () => {
			if (pendingEmptyRowStart === null || pendingEmptyRowCount === 0) {
				return;
			}

			while (pendingEmptyRowCount > 0) {
				const rowsToPrint = Math.min(255, pendingEmptyRowCount);
				await this.printEmptyRow(pendingEmptyRowStart, rowsToPrint, shouldConfirmRowWrite());
				transmittedRowCommands += 1;
				await sleep(this.waitBetweenPrintLinesMs);
				pendingEmptyRowStart += rowsToPrint;
				pendingEmptyRowCount -= rowsToPrint;
			}

			pendingEmptyRowStart = null;
			pendingEmptyRowCount = 0;
		};

		for (let rowNumber = 0; rowNumber < rows.length; rowNumber += 1) {
			const rowBytes = rows[rowNumber];
			const isEmptyRow = rowBytes.every((value) => value === 0);

			if (isEmptyRow) {
				if (pendingEmptyRowCount === 0) {
					pendingEmptyRowStart = rowNumber;
				}
				pendingEmptyRowCount += 1;
				continue;
			}

			await flushEmptyRows();
			await this.printBitmapRow(rowNumber, rowBytes, 1, shouldConfirmRowWrite());
			transmittedRowCommands += 1;
			await sleep(this.waitBetweenPrintLinesMs);
		}

		await flushEmptyRows();

		if (!(await this.pageEnd())) {
			throw new Error('Printer did not finish the page successfully.');
		}

		const startTime = Date.now();
		while (!(await this.getPrintEnd())) {
			if (Date.now() - startTime > 5_000) {
				break;
			}
			await sleep(500);
		}

		if (!(await this.printEnd())) {
			throw new Error('Printer did not finish the print successfully.');
		}
	}

	async disconnect() {
		if (this.ioCharacteristic) {
			try {
				await this.ioCharacteristic.stopNotifications();
			} catch (error: unknown) {
				console.warn('Failed to stop printer notifications:', error);
			}
		}

		await this.server?.disconnect();
		console.log('Disconnected from printer.');
		this.clearConnectionState();
		this.notifyConnectionListeners();

		this.lastError = null;
	}
}

// Export a singleton instance to use across your app
export const printerService = new NiimbotService();
