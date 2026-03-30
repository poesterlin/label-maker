<script lang="ts">
	import Konva from 'konva';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const BOARD_STORAGE_KEY = 'label-maker:board:v1';
	const DESIGN_WIDTH = 900;
	const DESIGN_HEIGHT = 520;
	const DEFAULT_FONT_FAMILY = 'Inter, system-ui, sans-serif';
	const FONT_OPTIONS = [
		{ label: 'Sans', value: 'Inter, system-ui, sans-serif' },
		{ label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
		{ label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
	] as const;
	const DEFAULT_FONT_STYLE = 'normal';
	const FONT_STYLE_OPTIONS = [
		{ label: 'Regular', value: 'normal' },
		{ label: 'Bold', value: 'bold' },
		{ label: 'Italic', value: 'italic' },
		{ label: 'Bold Italic', value: 'bold italic' }
	] as const;

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
			width: 320
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
			width: 260
		}
	]);

	let nextId = $state(3);
	let stage: Konva.Stage | undefined;
	let layer: Konva.Layer | undefined;
	let transformer: Konva.Transformer | undefined;
	let nodes = new SvelteMap<number, Konva.Text>();
	let printerMessage = $state('');
	let printerLogs = $state<string[]>([]);
	let printing = $state(false);
	let hasRestoredBoard = $state(false);
	const pageTitle = 'Niimbot B1 Label Maker - Web Bluetooth Editor';
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

	function pushPrinterLog(message: string) {
		const time = new Date().toLocaleTimeString();
		const entry = `${time} - ${message}`;
		printerLogs = [...printerLogs.slice(-11), entry];
	}

	type PersistedBoard = {
		selectedId: number | null;
		items: PersistedLabelItem[];
		nextId: number;
	};

	type PersistedLabelItem = Omit<LabelItem, 'fontFamily' | 'fontStyle'> & {
		fontFamily?: string;
		fontStyle?: string;
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

		return (
			typeof value.id === 'number' &&
			typeof value.text === 'string' &&
			typeof value.x === 'number' &&
			typeof value.y === 'number' &&
			typeof value.fontSize === 'number' &&
			hasValidFontFamily &&
			hasValidFontStyle &&
			typeof value.fill === 'string' &&
			typeof value.width === 'number'
		);
	}

	function normalizeLabelItem(item: PersistedLabelItem): LabelItem {
		return {
			...item,
			fontFamily: item.fontFamily ?? DEFAULT_FONT_FAMILY,
			fontStyle: item.fontStyle ?? DEFAULT_FONT_STYLE
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
			width: 240
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

	async function printCurrentLabel() {
		if (!browser) return;
		if (!stage) {
			printerMessage = 'Label canvas is not ready yet.';
			pushPrinterLog('Label canvas is not ready.');
			return;
		}

		printing = true;
		printerMessage = 'Connecting to printer...';
		pushPrinterLog('Starting print for Niimbot B1.');

		try {
			const { printerService } = await import('$lib/niimbot');

			await printerService.initialize();
			pushPrinterLog('Web Bluetooth ready.');

			if (!printerService.isConnected()) {
				pushPrinterLog('Opening printer chooser...');
			}

			if (!printerService.isConnected() && !(await printerService.connect())) {
				printerMessage = printerService.lastError ?? 'Could not connect to the printer.';
				pushPrinterLog(printerMessage);
				return;
			}

			pushPrinterLog('Connected to printer.');

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
				pushPrinterLog('Preparing label image...');
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

			pushPrinterLog('Sending label data...');
			await printerService.printCanvasLabel(canvas);
			printerMessage = 'Sent label to the printer.';
			pushPrinterLog('Print job sent.');
		} catch (error) {
			printerMessage = error instanceof Error ? error.message : 'Printing failed.';
			pushPrinterLog(`Print failed: ${printerMessage}`);
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
		if (!browser || !hasRestoredBoard) return;

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
			enabledAnchors: ['middle-left', 'middle-right']
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
				draggable: true,
				padding: 2
			});

		node.on('click tap', () => {
			selectedId = item.id;
			if (transformer) {
				transformer.nodes([node]);
				layer?.batchDraw();
			}
		});

			node.on('dragmove', () => {
				updateItem(item.id, { x: node.x(), y: node.y() });
			});

			node.on('transform', () => {
				const scaleX = node.scaleX();
				node.scaleX(1);
				node.scaleY(1);
				updateItem(item.id, {
					x: node.x(),
					y: node.y(),
					width: Math.max(90, node.width() * scaleX)
				});
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
					draggable: true,
					padding: 2
				});

				createdNode.on('click tap', () => {
					selectedId = item.id;
					if (transformer) {
						transformer.nodes([createdNode]);
						layer?.batchDraw();
					}
				});

				createdNode.on('dragmove', () => {
					updateItem(item.id, { x: createdNode.x(), y: createdNode.y() });
				});

				createdNode.on('transform', () => {
					const scaleX = createdNode.scaleX();
					createdNode.scaleX(1);
					createdNode.scaleY(1);
					updateItem(item.id, {
						x: createdNode.x(),
						y: createdNode.y(),
						width: Math.max(90, createdNode.width() * scaleX)
					});
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
		}

		if (transformer) {
			const node = currentSelectedId ? nodes.get(currentSelectedId) : undefined;
			transformer.nodes(node ? [node] : []);
		}
		layer.batchDraw();
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

<div class="shell">
	<section class="canvas-card">
		<div class="header">
			<div>
				<p class="eyebrow">Label Maker - Niimbot B1</p>
				<h1>Basic label editor</h1>
			</div>
			<div class="actions">
				<button class="secondary" onclick={printCurrentLabel} disabled={printing}>
					{printing ? 'Printing...' : 'Print label'}
				</button>
			</div>
		</div>
		{#if printerMessage}
			<p class="status">{printerMessage}</p>
		{/if}
		{#if printerLogs.length > 0}
			<div class="log-panel">
				<p class="log-title">Print log</p>
				<ul class="log-list">
					{#each printerLogs as log, index (`${index}-${log}`)}
						<li>{log}</li>
					{/each}
				</ul>
			</div>
		{/if}
		<div class="stage" bind:this={stageHost} bind:clientWidth={stageHostWidth}></div>
	</section>

	<aside class="panel">
		<h2>Properties</h2>
		<button class="primary" onclick={addText}>Add text</button>
		{#each items as item (item.id)}
			<button class:selected={selectedId === item.id} class="item" onclick={() => (selectedId = item.id)}>
				<strong>{item.text}</strong>
				<span>{Math.round(item.x)}, {Math.round(item.y)}</span>
			</button>
		{/each}
		{#if selectedId}
			{@const selected = items.find((item) => item.id === selectedId)}
			{#if selected}
				<label>
					<span>Text</span>
					<input value={selected.text} oninput={(e) => updateItem(selected.id, { text: e.currentTarget.value })} />
				</label>
				<label>
					<span>Size</span>
					<input type="range" min="12" max="180" value={selected.fontSize} oninput={(e) => updateItem(selected.id, { fontSize: Number(e.currentTarget.value) })} />
				</label>
				<label>
					<span>Font</span>
					<select
						value={selected.fontFamily}
						onchange={(e) => updateItem(selected.id, { fontFamily: e.currentTarget.value })}
					>
						{#each FONT_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Style</span>
					<select
						value={selected.fontStyle}
						onchange={(e) => updateItem(selected.id, { fontStyle: e.currentTarget.value })}
					>
						{#each FONT_STYLE_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
			<div class="panel-actions">
				<button class="ghost" onclick={duplicateSelected}>Duplicate element</button>
				<button class="danger" onclick={deleteSelected}>Delete element</button>
			</div>
		{/if}
	{/if}
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
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 1rem;
		padding: 1rem;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.canvas-card, .panel {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 20px;
		padding: 1rem;
		min-width: 0;
		box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.12em;
		color: #6b7280;
	}

	h1, h2 {
		margin: 0;
	}

	.stage {
		width: 100%;
		max-width: 100%;
		overflow: hidden;
		border-radius: 16px;
		background: linear-gradient(135deg, #e5e7eb, #f8fafc);
	}

	.panel {
		display: grid;
		gap: 0.9rem;
		align-content: start;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.9rem;
	}

	input, select, button {
		font: inherit;
		min-height: 44px;
	}

	input,
	select {
		padding: 0.7rem 0.8rem;
		border: 1px solid #d1d5db;
		border-radius: 12px;
		background: white;
	}

	.primary {
		border: 0;
		border-radius: 999px;
		padding: 0.8rem 1rem;
		background: #111827;
		color: white;
	}

	.secondary {
		border: 1px solid #cbd5e1;
		border-radius: 999px;
		padding: 0.8rem 1rem;
		background: white;
		color: #111827;
	}

	.ghost {
		border: 1px solid #d1d5db;
		border-radius: 12px;
		padding: 0.8rem 1rem;
		background: #f9fafb;
		color: #1f2937;
	}

	.status {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: #4b5563;
	}

	.log-panel {
		margin: 0 0 0.75rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		background: #f9fafb;
	}

	.log-title {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.log-list {
		margin: 0;
		padding: 0 0 0 1rem;
		font-size: 0.85rem;
		color: #4b5563;
		display: grid;
		gap: 0.2rem;
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.danger {
		border: 1px solid #fecaca;
		border-radius: 12px;
		padding: 0.8rem 1rem;
		background: #fef2f2;
		color: #991b1b;
	}

	.item {
		text-align: left;
		padding: 0.8rem;
		border-radius: 14px;
		border: 1px solid #e5e7eb;
		background: #fafafa;
	}

	.item strong {
		display: block;
		overflow-wrap: anywhere;
	}

	.item.selected {
		border-color: #111827;
		background: #eef2ff;
	}

	.item span {
		display: block;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.panel-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	@media (max-width: 900px) {
		.shell {
			grid-template-columns: 1fr;
			padding: 0.75rem;
			gap: 0.75rem;
		}

		.canvas-card,
		.panel {
			padding: 0.9rem;
			border-radius: 16px;
		}

		.header {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}

		.actions {
			width: 100%;
			justify-content: stretch;
		}

		.actions button {
			flex: 1 1 12rem;
		}

		.panel {
			gap: 0.75rem;
		}

		.panel-actions {
			grid-template-columns: 1fr;
		}
	}
</style>
