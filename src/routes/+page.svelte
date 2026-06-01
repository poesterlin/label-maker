<script lang="ts">
	import Konva from 'konva';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import BasicPanel from './BasicPanel.svelte';
	import BulkPanel from './BulkPanel.svelte';
	import CanvasCard from './CanvasCard.svelte';

	const BOARD_STORAGE_KEY = 'label-maker:board:v1';
	const DESIGN_WIDTH = 900;
	const DESIGN_HEIGHT = 520;
	const DEFAULT_FONT_FAMILY = 'Inter, system-ui, sans-serif';
	const DEFAULT_FONT_STYLE = 'normal';
	const DEFAULT_TEXT_ALIGN = 'left';
	const DEFAULT_VERTICAL_ALIGN = 'top';
	const DEFAULT_HEIGHT = 0;

	type LabelItem = {
		id: number;
		text: string;
		x: number;
		y: number;
		fontSize: number;
		fontFamily: string;
		fontStyle: string;
		fill: string;
		width: number;
		height: number;
		align: string;
		verticalAlign: string;
	};

	let stageHost = $state<HTMLDivElement>();
	let stageHostWidth = $state(0);
	let selectedId = $state<number | null>(1);
	let items = $state<LabelItem[]>([
		{
			id: 1,
			text: 'Fresh Bread',
			x: 120,
			y: 90,
			fontSize: 44,
			fontFamily: DEFAULT_FONT_FAMILY,
			fontStyle: DEFAULT_FONT_STYLE,
			fill: '#111827',
			width: 320,
			height: DEFAULT_HEIGHT,
			align: DEFAULT_TEXT_ALIGN,
			verticalAlign: DEFAULT_VERTICAL_ALIGN
		},
		{
			id: 2,
			text: 'Best before: today',
			x: 122,
			y: 158,
			fontSize: 22,
			fontFamily: DEFAULT_FONT_FAMILY,
			fontStyle: DEFAULT_FONT_STYLE,
			fill: '#374151',
			width: 260,
			height: DEFAULT_HEIGHT,
			align: DEFAULT_TEXT_ALIGN,
			verticalAlign: DEFAULT_VERTICAL_ALIGN
		}
	]);

	let nextId = $state(3);
	let stage: Konva.Stage | undefined;
	let layer: Konva.Layer | undefined;
	let transformer: Konva.Transformer | undefined;
	let nodes = new SvelteMap<number, Konva.Text>();
	let printerMessage = $state('');
	let printing = $state(false);
	let hasRestoredBoard = $state(false);
	let toolbarX = $state(0);
	let toolbarY = $state(0);
	let toolbarVisible = $state(false);
	let editingText = $state(false);
	let editValue = $state('');
	let editId = $state<number | null>(null);
	let editX = $state(0);
	let editY = $state(0);
	let editWidth = $state(0);
	let editHeight = $state(0);
	let editFontSize = $state(0);
	let editFontFamily = $state(DEFAULT_FONT_FAMILY);
	let editFontStyle = $state(DEFAULT_FONT_STYLE);
	let editAlign = $state(DEFAULT_TEXT_ALIGN);

	let mode = $state<'basic' | 'bulk'>('basic');
	let bulkList = $state('');
	let bulkFontSize = $state(44);
	let bulkFontFamily = $state(DEFAULT_FONT_FAMILY);
	let bulkFontStyle = $state('bold');
	let bulkAlign = $state<'left' | 'center' | 'right'>('center');
	let bulkFill = $state('#111827');
	let bulkPreviewIndex = $state(0);

	let _savedBasicSelectedId = $state<number | null>(null);
	let _savedBasicNextId = $state(3);
	let _savedBasicItems = $state<LabelItem[]>([]);

	const bulkLines = $derived(
		bulkList
			.split('\n\n')
			.map((block) => block.trim())
			.filter((block) => block.length > 0)
	);

	const pageTitle = 'Thermal Label Designer - Print with Niimbot B1 via Bluetooth';
	const pageDescription =
		'Create, edit, and print black-and-white labels for Niimbot B1 from your browser using Web Bluetooth. Position text, duplicate elements, and print instantly.';
	const pageKeywords =
		'Niimbot B1, label maker, web bluetooth printer, thermal label printer, browser label editor, black and white labels';
	const pageJsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'Niimbot B1 Label Maker',
			description: pageDescription,
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Any',
			url: page.url.href,
			browserRequirements: 'Web Bluetooth support (Chrome or Edge)'
		})
	);


	type PersistedBoard = {
		selectedId: number | null;
		items: PersistedLabelItem[];
		nextId: number;
	};

	type PersistedLabelItem = Omit<LabelItem, 'fontFamily' | 'fontStyle' | 'align' | 'verticalAlign' | 'height'> & {
		fontFamily?: string;
		fontStyle?: string;
		align?: string;
		verticalAlign?: string;
		height?: number;
	};

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null;
	}

	function isValidLabelItem(value: unknown): value is PersistedLabelItem {
		if (!isRecord(value)) return false;
		const hasValidFontFamily =
			value.fontFamily === undefined || typeof value.fontFamily === 'string';
		const hasValidFontStyle =
			value.fontStyle === undefined || typeof value.fontStyle === 'string';
		const hasValidAlign =
			value.align === undefined || typeof value.align === 'string';
		const hasValidVerticalAlign =
			value.verticalAlign === undefined || typeof value.verticalAlign === 'string';
		const hasValidHeight =
			value.height === undefined || typeof value.height === 'number';

		return (
			typeof value.id === 'number' &&
			typeof value.text === 'string' &&
			typeof value.x === 'number' &&
			typeof value.y === 'number' &&
			typeof value.fontSize === 'number' &&
			hasValidFontFamily &&
			hasValidFontStyle &&
			hasValidAlign &&
			hasValidVerticalAlign &&
			hasValidHeight &&
			typeof value.fill === 'string' &&
			typeof value.width === 'number'
		);
	}

	function normalizeLabelItem(item: PersistedLabelItem): LabelItem {
		return {
			...item,
			fontFamily: item.fontFamily ?? DEFAULT_FONT_FAMILY,
			fontStyle: item.fontStyle ?? DEFAULT_FONT_STYLE,
			align: item.align ?? DEFAULT_TEXT_ALIGN,
			verticalAlign: item.verticalAlign ?? DEFAULT_VERTICAL_ALIGN,
			height: item.height ?? DEFAULT_HEIGHT
		};
	}

	function isValidPersistedBoard(value: unknown): value is PersistedBoard {
		if (!isRecord(value)) return false;
		if (!(value.selectedId === null || typeof value.selectedId === 'number')) return false;
		if (!Array.isArray(value.items) || !value.items.every(isValidLabelItem)) return false;
		if (typeof value.nextId !== 'number') return false;

		return true;
	}

	function addText() {
		const item = {
			id: nextId++,
			text: 'New text',
			x: 80,
			y: 220,
			fontSize: 28,
			fontFamily: DEFAULT_FONT_FAMILY,
			fontStyle: DEFAULT_FONT_STYLE,
			fill: '#111827',
			width: 240,
			height: DEFAULT_HEIGHT,
			align: DEFAULT_TEXT_ALIGN,
			verticalAlign: DEFAULT_VERTICAL_ALIGN
		};

		items = [...items, item];
		selectedId = item.id;
	}

	function updateItem(id: number, patch: Partial<LabelItem>) {
		items = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
	}

	function deleteSelected() {
		if (selectedId === null) return;
		const deletedId = selectedId;

		items = items.filter((item) => item.id !== deletedId);
		const nextSelected = items[0];
		selectedId = nextSelected?.id ?? null;
	}

	function duplicateSelected() {
		if (selectedId === null) return;
		const source = items.find((item) => item.id === selectedId);
		if (!source) return;

		const duplicate = {
			...source,
			id: nextId++,
			x: source.x + 18,
			y: source.y + 18
		};

		items = [...items, duplicate];
		selectedId = duplicate.id;
	}

	function updateToolbarPosition() {
		if (!stage || !stageHost || selectedId === null) {
			untrack(() => {
				toolbarVisible = false;
			});
			return;
		}
		const node = nodes.get(selectedId);
		if (!node) {
			untrack(() => {
				toolbarVisible = false;
			});
			return;
		}
		const box = node.getClientRect();
		const container = stage.container();
		const containerRect = container.getBoundingClientRect();
		const hostRect = stageHost.getBoundingClientRect();
		const x = (containerRect.left - hostRect.left) + box.x + box.width / 2;
		const y = (containerRect.top - hostRect.top) + box.y - 12;

		untrack(() => {
			toolbarX = x;
			toolbarY = y;
			toolbarVisible = true;
			if (editingText && editId === selectedId) {
				editX = (containerRect.left - hostRect.left) + box.x;
				editY = (containerRect.top - hostRect.top) + box.y;
				editWidth = box.width;
				editHeight = box.height;
			}
		});
	}

	function deselect() {
		selectedId = null;
		toolbarVisible = false;
		if (transformer) transformer.nodes([]);
		layer?.batchDraw();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (editingText) return;
		const target = e.target;
		if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelected();
		} else if (e.key === 'Escape') {
			deselect();
		} else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
			e.preventDefault();
			duplicateSelected();
		}
	}

	function startEditing(item: LabelItem) {
		editId = item.id;
		editValue = item.text;
		editFontSize = item.fontSize;
		editFontFamily = item.fontFamily;
		editFontStyle = item.fontStyle;
		editAlign = item.align;
		editingText = true;
		updateToolbarPosition();
	}

	function commitEdit() {
		if (editId === null) return;
		updateItem(editId, { text: editValue });
		editId = null;
		editingText = false;
	}

	function focusOnMount(el: HTMLTextAreaElement) {
		el.focus();
	}

	function toggleBold() {
		if (selectedId === null) return;
		const item = items.find((i) => i.id === selectedId);
		if (!item) return;
		const styles: Record<string, string> = {
			normal: 'bold',
			bold: 'normal',
			italic: 'bold italic',
			'bold italic': 'italic'
		};
		updateItem(selectedId, { fontStyle: styles[item.fontStyle] ?? 'bold' });
	}

	function toggleItalic() {
		if (selectedId === null) return;
		const item = items.find((i) => i.id === selectedId);
		if (!item) return;
		const styles: Record<string, string> = {
			normal: 'italic',
			italic: 'normal',
			bold: 'bold italic',
			'bold italic': 'bold'
		};
		updateItem(selectedId, { fontStyle: styles[item.fontStyle] ?? 'italic' });
	}

	function cycleFontSize(delta: number) {
		if (selectedId === null) return;
		const item = items.find((i) => i.id === selectedId);
		if (!item) return;
		const next = Math.max(12, Math.min(180, item.fontSize + delta));
		updateItem(selectedId, { fontSize: next });
	}

	async function printCurrentLabel() {
		if (!browser) return;
		if (!stage) {
			printerMessage = 'Label canvas is not ready yet.';
			return;
		}

		printing = true;
		printerMessage = 'Connecting to printer...';

		try {
			const { printerService } = await import('$lib/niimbot');

			await printerService.initialize();

			if (!printerService.isConnected() && !(await printerService.connect())) {
				printerMessage = printerService.lastError ?? 'Could not connect to the printer.';
				return;
			}

			const printerWidth = 384;
			const frameNode = stage.findOne<Konva.Rect>('.board-frame');
			const frameWasVisible = frameNode?.visible() ?? false;
			const selectedNodes = transformer?.nodes() ?? [];
			const stageScaleX = stage.scaleX();
			const stageScaleY = stage.scaleY();
			const stageWidth = stage.width();
			const stageHeight = stage.height();
			let canvas: HTMLCanvasElement;

			try {
				frameNode?.visible(false);
				transformer?.nodes([]);
				stage.scale({ x: 1, y: 1 });
				stage.size({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT });
				layer?.batchDraw();

				canvas = stage.toCanvas({
					pixelRatio: printerWidth / DESIGN_WIDTH
				});
			} finally {
				frameNode?.visible(frameWasVisible);
				transformer?.nodes(selectedNodes);
				stage.scale({ x: stageScaleX, y: stageScaleY });
				stage.size({ width: stageWidth, height: stageHeight });
				layer?.batchDraw();
			}

			await printerService.printCanvasLabel(canvas);
			printerMessage = 'Sent label to the printer.';
		} catch (error) {
			printerMessage = error instanceof Error ? error.message : 'Printing failed.';
		} finally {
			printing = false;
		}
	}

	function switchMode(newMode: 'basic' | 'bulk') {
		if (newMode === mode) return;
		if (mode === 'basic') {
			_savedBasicSelectedId = selectedId;
			_savedBasicNextId = nextId;
			_savedBasicItems = items;
			updateBulkPreview();
		} else {
			items = _savedBasicItems.length > 0 ? _savedBasicItems : items;
			selectedId = _savedBasicSelectedId;
			nextId = _savedBasicNextId;
		}
		mode = newMode;
	}

	function updateBulkPreview() {
		const text = bulkLines[bulkPreviewIndex] || 'Label text';
		const id = 1;
		items = [{
			id,
			text,
			x: 24,
			y: 200,
			fontSize: bulkFontSize,
			fontFamily: bulkFontFamily,
			fontStyle: bulkFontStyle,
			fill: bulkFill,
			width: 852,
			height: DEFAULT_HEIGHT,
			align: bulkAlign,
			verticalAlign: 'middle'
		}];
		selectedId = id;
		nextId = 2;
	}

	async function printBulkLabels() {
		if (!browser) return;
		if (!stage) {
			printerMessage = 'Label canvas is not ready yet.';
			return;
		}

		if (bulkLines.length === 0) {
			printerMessage = 'No labels to print. Add some text to the list.';
			return;
		}

		printing = true;

		try {
			const { printerService } = await import('$lib/niimbot');
			await printerService.initialize();

			if (!printerService.isConnected() && !(await printerService.connect())) {
				printerMessage = printerService.lastError ?? 'Could not connect to the printer.';
				return;
			}

			const printerWidth = 384;
			const frameNode = stage.findOne<Konva.Rect>('.board-frame');
			const frameWasVisible = frameNode?.visible() ?? false;
			const selectedNodes = transformer?.nodes() ?? [];
			const stageScaleX = stage.scaleX();
			const stageScaleY = stage.scaleY();
			const stageWidth = stage.width();
			const stageHeight = stage.height();

			const bulkNode = nodes.get(1);
			const originalText = bulkNode?.text() ?? '';

			try {
				frameNode?.visible(false);
				transformer?.nodes([]);
				stage.scale({ x: 1, y: 1 });
				stage.size({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT });

				for (let i = 0; i < bulkLines.length; i++) {
					printerMessage = `Printing label ${i + 1} / ${bulkLines.length}...`;

					if (bulkNode) {
						bulkNode.text(bulkLines[i]);
					}
					layer?.batchDraw();

					const canvas = stage.toCanvas({
						pixelRatio: printerWidth / DESIGN_WIDTH
					});

					await printerService.printCanvasLabel(canvas);
				}

				printerMessage = `Printed ${bulkLines.length} labels.`;
			} finally {
				if (bulkNode) {
					bulkNode.text(originalText);
				}
				frameNode?.visible(frameWasVisible);
				transformer?.nodes(selectedNodes);
				stage.scale({ x: stageScaleX, y: stageScaleY });
				stage.size({ width: stageWidth, height: stageHeight });
				layer?.batchDraw();
			}
		} catch (error) {
			printerMessage = error instanceof Error ? error.message : 'Printing failed.';
		} finally {
			printing = false;
		}
	}

	onMount(() => {
		if (!browser) return;

		const raw = localStorage.getItem(BOARD_STORAGE_KEY);
		if (!raw) {
			hasRestoredBoard = true;
			return;
		}

		try {
			const parsed: unknown = JSON.parse(raw);
			if (!isValidPersistedBoard(parsed)) return;

			selectedId = parsed.selectedId;
			items = parsed.items.map(normalizeLabelItem);
			nextId = parsed.nextId;
		} catch {
			// Ignore invalid persisted data and continue with defaults.
		} finally {
			hasRestoredBoard = true;
		}
	});

	$effect(() => {
		if (!browser || !hasRestoredBoard || mode !== 'basic') return;

		const payload: PersistedBoard = {
			selectedId,
			items,
			nextId
		};

		localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(payload));
	});

	$effect(() => {
		if (!stageHost) return;

		stage?.destroy();
		nodes = new SvelteMap();
		const initialItems = untrack(() => items);

		stage = new Konva.Stage({
			container: stageHost,
			width: DESIGN_WIDTH,
			height: DESIGN_HEIGHT
		});

		layer = new Konva.Layer();
		transformer = new Konva.Transformer({
			rotateEnabled: false,
			keepRatio: false,
			enabledAnchors: ['middle-left', 'middle-right', 'middle-top', 'middle-bottom']
		});

		const bg = new Konva.Rect({
			x: 24,
			y: 24,
			width: 852,
			height: 472,
			name: 'board-frame',
			radius: 18,
			fill: '#fffdfa',
			stroke: '#d6d3d1',
			strokeWidth: 2,
			shadowColor: 'rgba(15, 23, 42, 0.12)',
			shadowBlur: 24,
			shadowOffsetY: 10
		});

		layer.add(bg);

		for (const item of initialItems) {
			const node = new Konva.Text({
				x: item.x,
				y: item.y,
				text: item.text,
				fontSize: item.fontSize,
				fill: item.fill,
				fontFamily: item.fontFamily,
				fontStyle: item.fontStyle,
				width: item.width,
				height: item.height > 0 ? item.height : undefined,
				align: item.align,
				verticalAlign: item.verticalAlign,
				draggable: true,
				padding: 2
			});

		node.on('click tap', () => {
			selectedId = item.id;
			if (transformer) {
				transformer.nodes([node]);
				layer?.batchDraw();
			}
			updateToolbarPosition();
		});

			node.on('dragmove', () => {
				updateItem(item.id, { x: node.x(), y: node.y() });
				updateToolbarPosition();
			});

			node.on('dblclick dbltap', () => {
				startEditing(item);
			});

			node.on('transform', () => {
				const scaleX = node.scaleX();
				const scaleY = node.scaleY();
				node.scaleX(1);
				node.scaleY(1);
				updateItem(item.id, {
					x: node.x(),
					y: node.y(),
					width: Math.max(90, node.width() * scaleX),
					height: node.height() > 0 ? Math.max(24, node.height() * scaleY) : node.height()
				});
				updateToolbarPosition();
			});

			nodes.set(item.id, node);
			layer.add(node);
		}

		layer.add(transformer);
		stage.add(layer);
		const currentSelectedId = untrack(() => selectedId);
		if (transformer) {
			const node = currentSelectedId ? nodes.get(currentSelectedId) : undefined;
			transformer.nodes(node ? [node] : []);
			layer?.batchDraw();
		}

		return () => {
			stage?.destroy();
			stage = undefined;
			layer = undefined;
			transformer = undefined;
			nodes = new SvelteMap();
		};
	});

	$effect(() => {
		if (!stage || !layer) return;
		const currentSelectedId = selectedId;
		const itemIds = new Set(items.map((item) => item.id));

		for (const [id, node] of nodes) {
			if (itemIds.has(id)) continue;
			node.destroy();
			nodes.delete(id);
		}

		for (const item of items) {
			let node = nodes.get(item.id);
			if (!node) {
				const createdNode = new Konva.Text({
					x: item.x,
					y: item.y,
					text: item.text,
					fontSize: item.fontSize,
					fill: item.fill,
					fontFamily: item.fontFamily,
					fontStyle: item.fontStyle,
					width: item.width,
					height: item.height > 0 ? item.height : undefined,
					align: item.align,
					verticalAlign: item.verticalAlign,
					draggable: true,
					padding: 2
				});

				createdNode.on('click tap', () => {
					selectedId = item.id;
					if (transformer) {
						transformer.nodes([createdNode]);
						layer?.batchDraw();
					}
					updateToolbarPosition();
				});

				createdNode.on('dragmove', () => {
					updateItem(item.id, { x: createdNode.x(), y: createdNode.y() });
					updateToolbarPosition();
				});

				createdNode.on('dblclick dbltap', () => {
					startEditing(item);
				});

				createdNode.on('transform', () => {
					const scaleX = createdNode.scaleX();
					const scaleY = createdNode.scaleY();
					createdNode.scaleX(1);
					createdNode.scaleY(1);
					updateItem(item.id, {
						x: createdNode.x(),
						y: createdNode.y(),
						width: Math.max(90, createdNode.width() * scaleX),
						height: createdNode.height() > 0 ? Math.max(24, createdNode.height() * scaleY) : createdNode.height()
					});
					updateToolbarPosition();
				});

				nodes.set(item.id, createdNode);
				layer.add(createdNode);
				node = createdNode;
			}

			if (!node) continue;

			node.position({ x: item.x, y: item.y });
			node.text(item.text);
			node.fontSize(item.fontSize);
			node.fontFamily(item.fontFamily);
			node.fontStyle(item.fontStyle);
			node.fill(item.fill);
			node.width(item.width);
			node.height(item.height > 0 ? item.height : undefined);
			node.align(item.align);
			node.verticalAlign(item.verticalAlign);
		}

		if (transformer) {
			const node = currentSelectedId ? nodes.get(currentSelectedId) : undefined;
			transformer.nodes(node ? [node] : []);
		}
		layer.batchDraw();
		requestAnimationFrame(() => updateToolbarPosition());
	});

	$effect(() => {
		if (!stage || !layer || stageHostWidth <= 0) return;

		const scale = Math.min(1, stageHostWidth / DESIGN_WIDTH);

		stage.size({
			width: DESIGN_WIDTH * scale,
			height: DESIGN_HEIGHT * scale
		});
		stage.scale({ x: scale, y: scale });
		layer.batchDraw();
		requestAnimationFrame(() => updateToolbarPosition());
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta name="keywords" content={pageKeywords} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={page.url.href} />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<script type="application/ld+json">{pageJsonLd}</script>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="shell">
	<CanvasCard
		{mode}
		{printing}
		{printerMessage}
		{editingText}
		bind:stageHostWidth
		{selectedId}
		{items}
		{toolbarVisible}
		{toolbarX}
		{toolbarY}
		{editId}
		bind:editValue
		{editFontSize}
		{editFontFamily}
		{editFontStyle}
		{editAlign}
		{editX}
		{editY}
		{editWidth}
		{editHeight}
		stageScale={stage?.scaleX() ?? 1}
		{bulkLines}
		onStageHost={(el) => (stageHost = el)}
		onSwitchMode={switchMode}
		onPrintCurrentLabel={printCurrentLabel}
		onPrintBulkLabels={printBulkLabels}
		onStartEditing={startEditing}
		onCommitEdit={commitEdit}
		onCycleFontSize={cycleFontSize}
		onToggleBold={toggleBold}
		onToggleItalic={toggleItalic}
		onUpdateItem={updateItem}
		onDeleteSelected={deleteSelected}
		onFocusMount={focusOnMount}
	/>

	<aside class="panel">
		{#if mode === 'basic'}
			<BasicPanel {items} {selectedId} onAddText={addText} onSelectItem={(id) => (selectedId = id)} />
		{:else}
			<BulkPanel
				{bulkList}
				{bulkFontSize}
				{bulkFontFamily}
				{bulkFontStyle}
				{bulkAlign}
				{bulkLines}
				{bulkPreviewIndex}
				onBulkListChange={(v) => (bulkList = v)}
				onBulkFontSizeChange={(s) => (bulkFontSize = s)}
				onBulkFontFamilyChange={(f) => (bulkFontFamily = f)}
				onBulkFontStyleChange={(s) => (bulkFontStyle = s)}
				onBulkAlignChange={(a) => (bulkAlign = a)}
				onUpdatePreview={updateBulkPreview}
				onSetPreviewIndex={(i) => (bulkPreviewIndex = i)}
			/>
		{/if}
		<div class="printer-info">
			<p class="printer-info-title">Printer — Niimbot B1</p>
			<p class="printer-info-text">
				Works with Chrome or Edge on desktop. Click <strong>Print label</strong> and select your printer via the Bluetooth device chooser.
			</p>
			<a class="printer-link" href="https://www.amazon.de/NIIMBOT-Etikettendrucker-Bluetooth-Etikettendrucker-Thermoetikettierer-Einzelhandel/dp/B0BCW4YMR8?th=1" target="_blank" rel="noopener noreferrer">Get a Niimbot B1</a>
		</div>
	</aside>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: Inter, system-ui, sans-serif;
		background: #f3f4f6;
		color: #111827;
	}

	.shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 260px;
		gap: 1rem;
		padding: 1rem;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 20px;
		padding: 1rem;
		min-width: 0;
		box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
		display: grid;
		gap: 0.9rem;
		align-content: start;
	}

	.printer-info {
		margin-top: 0.2rem;
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		background: #f0f9ff;
	}

	.printer-info-title {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.printer-info-text {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		color: #4b5563;
		line-height: 1.45;
	}

	.printer-link {
		font-size: 0.8rem;
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.printer-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 900px) {
		.shell {
			grid-template-columns: 1fr;
			padding: 0.75rem;
			gap: 0.75rem;
		}

		.panel {
			padding: 0.9rem;
			border-radius: 16px;
			gap: 0.75rem;
		}
	}
</style>
