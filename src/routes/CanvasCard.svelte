<script lang="ts">
	import {
		IconAlignLeft,
		IconAlignCenter,
		IconAlignRight,
		IconArrowUp,
		IconArrowsVertical,
		IconArrowDown,
		IconBold,
		IconItalic,
		IconPencil,
		IconPlus,
		IconMinus,
		IconTrash,
		IconPrinter
	} from '@tabler/icons-svelte';

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

	const TEXT_ALIGN_OPTIONS = [
		{ label: 'Left', value: 'left' },
		{ label: 'Center', value: 'center' },
		{ label: 'Right', value: 'right' }
	] as const;

	let {
		mode,
		printing,
		printerMessage,
		editingText,
		stageHostWidth = $bindable(0),
		selectedId,
		items,
		toolbarVisible,
		toolbarX,
		toolbarY,
		editId,
		editValue = $bindable(''),
		editFontSize,
		editFontFamily,
		editFontStyle,
		editAlign,
		editX,
		editY,
		editWidth,
		editHeight,
		stageScale,
		bulkLines,
		onStageHost,
		onSwitchMode,
		onPrintCurrentLabel,
		onPrintBulkLabels,
		onStartEditing,
		onCommitEdit,
		onCycleFontSize,
		onToggleBold,
		onToggleItalic,
		onUpdateItem,
		onDeleteSelected,
		onFocusMount
	}: {
		mode: 'basic' | 'bulk';
		printing: boolean;
		printerMessage: string;
		editingText: boolean;
		stageHostWidth: number;
		selectedId: number | null;
		items: LabelItem[];
		toolbarVisible: boolean;
		toolbarX: number;
		toolbarY: number;
		editId: number | null;
		editValue: string;
		editFontSize: number;
		editFontFamily: string;
		editFontStyle: string;
		editAlign: string;
		editX: number;
		editY: number;
		editWidth: number;
		editHeight: number;
		stageScale: number;
		bulkLines: string[];
		onStageHost: (el: HTMLDivElement) => void;
		onSwitchMode: (mode: 'basic' | 'bulk') => void;
		onPrintCurrentLabel: () => void;
		onPrintBulkLabels: () => void;
		onStartEditing: (item: LabelItem) => void;
		onCommitEdit: () => void;
		onCycleFontSize: (delta: number) => void;
		onToggleBold: () => void;
		onToggleItalic: () => void;
		onUpdateItem: (id: number, patch: Partial<LabelItem>) => void;
		onDeleteSelected: () => void;
		onFocusMount: (el: HTMLTextAreaElement) => void;
	} = $props();

	let stageDiv = $state<HTMLDivElement>();

	$effect(() => {
		if (stageDiv) {
			onStageHost(stageDiv);
		}
	});
</script>

<section class="canvas-card">
	<div class="header">
		<div>
			<p class="eyebrow">Thermal Label Designer</p>
			<h1>{mode === 'basic' ? 'Design your label' : 'Print in bulk'}</h1>
		</div>
		<div class="actions">
			<div class="mode-tabs">
				<button class="mode-tab" class:active={mode === 'basic'} onclick={() => onSwitchMode('basic')}>Basic</button>
				<button class="mode-tab" class:active={mode === 'bulk'} onclick={() => onSwitchMode('bulk')}>Bulk</button>
			</div>
			{#if mode === 'basic'}
				<button class="print-btn" onclick={onPrintCurrentLabel} disabled={printing}>
					<IconPrinter size={16} />
					<span>{printing ? 'Printing...' : 'Print label'}</span>
				</button>
			{:else}
				<button class="print-btn" onclick={onPrintBulkLabels} disabled={printing || bulkLines.length === 0}>
					<IconPrinter size={16} />
					<span>{printing ? 'Printing...' : `Print all (${bulkLines.length})`}</span>
				</button>
			{/if}
		</div>
	</div>
	{#if printerMessage}
		<p class="status">{printerMessage}</p>
	{/if}
	<div class="stage-wrap" class:editing={editingText}>
		<div class="stage" bind:this={stageDiv} bind:clientWidth={stageHostWidth}></div>
		{#if mode === 'basic' && toolbarVisible && selectedId}
			{@const selected = items.find((i) => i.id === selectedId)}
			{#if selected}
				<div
					class="toolbar"
					style="left:{toolbarX}px;top:{toolbarY}px"
					role="toolbar"
					aria-label="Text formatting"
				>
					<div class="toolbar-row">
						<button class="tb-btn" onclick={() => onStartEditing(selected)} title="Edit text (double-click)">
							<IconPencil size={14} />
							{selected.text}
						</button>
					</div>
					<div class="toolbar-row">
						<button class="tb-btn tb-icon" onclick={() => onCycleFontSize(-2)} title="Decrease font size"><IconMinus size={16} /></button>
						<span class="tb-label">{selected.fontSize}</span>
						<button class="tb-btn tb-icon" onclick={() => onCycleFontSize(2)} title="Increase font size"><IconPlus size={16} /></button>
						<span class="tb-sep"></span>
						<button
							class="tb-btn tb-icon"
							class:tb-active={selected.fontStyle.includes('bold')}
							onclick={onToggleBold}
							title="Bold (toggle)"
						><IconBold size={16} /></button>
						<button
							class="tb-btn tb-icon"
							class:tb-active={selected.fontStyle.includes('italic')}
							onclick={onToggleItalic}
							title="Italic (toggle)"
						><IconItalic size={16} /></button>
						<span class="tb-sep"></span>
						{#each TEXT_ALIGN_OPTIONS as opt (opt.value)}
							<button
								class="tb-btn tb-icon"
								class:tb-active={selected.align === opt.value}
								onclick={() => onUpdateItem(selected.id, { align: opt.value })}
								title="Align {opt.label}"
							>
								{#if opt.value === 'left'}<IconAlignLeft size={15} />{:else if opt.value === 'center'}<IconAlignCenter size={15} />{:else}<IconAlignRight size={15} />{/if}
							</button>
						{/each}
						<span class="tb-sep"></span>
						<button
							class="tb-btn tb-icon"
							class:tb-active={selected.verticalAlign === 'top'}
							onclick={() => onUpdateItem(selected.id, { verticalAlign: 'top' })}
							title="Align top"
						><IconArrowUp size={15} /></button>
						<button
							class="tb-btn tb-icon"
							class:tb-active={selected.verticalAlign === 'middle'}
							onclick={() => onUpdateItem(selected.id, { verticalAlign: 'middle' })}
							title="Align middle"
						><IconArrowsVertical size={15} /></button>
						<button
							class="tb-btn tb-icon"
							class:tb-active={selected.verticalAlign === 'bottom'}
							onclick={() => onUpdateItem(selected.id, { verticalAlign: 'bottom' })}
							title="Align bottom"
						><IconArrowDown size={15} /></button>
						<span class="tb-sep"></span>
						<button class="tb-btn tb-icon tb-del" onclick={onDeleteSelected} title="Delete (Del)"><IconTrash size={15} /></button>
					</div>
				</div>
			{/if}
		{/if}
		{#if mode === 'basic' && editingText && editId !== null}
			<textarea
				class="edit-input"
				style="left:{editX}px;top:{editY}px;width:{editWidth}px;height:{editHeight}px;font-size:{editFontSize * stageScale}px;font-family:{editFontFamily};font-style:{editFontStyle};text-align:{editAlign}"
				bind:value={editValue}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommitEdit(); }
					if (e.key === 'Escape') { onCommitEdit(); }
				}}
				onblur={onCommitEdit}
				use:onFocusMount
			></textarea>
		{/if}
	</div>
</section>

<style>
	.canvas-card {
		background: #fffefa;
		border: 1px solid #e8e0d5;
		border-radius: 18px;
		padding: 1.25rem;
		min-width: 0;
		box-shadow: 0 2px 0 0 rgba(139, 90, 43, 0.06), 0 8px 30px rgba(61, 44, 32, 0.06);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
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
		margin: 0 0 0.2rem;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		color: #b85c38;
		font-weight: 700;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.stage-wrap {
		position: relative;
	}

	.stage {
		width: 100%;
		max-width: 100%;
		overflow: hidden;
		border-radius: 14px;
		background: #f2efe7;
	}

	.stage-wrap.editing .stage {
		opacity: 0.4;
	}

	button {
		cursor: pointer;
	}

	.print-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		border-radius: 999px;
		padding: 0.7rem 1.5rem;
		background: linear-gradient(135deg, #c26a3d, #b85c38);
		color: white;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(184, 92, 56, 0.35);
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.print-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 14px rgba(184, 92, 56, 0.4);
	}

	.print-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.status {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		color: #8b5a2b;
		font-style: italic;
	}

	button:disabled {
		opacity: 0.55;
		cursor: progress;
	}

	.toolbar {
		position: absolute;
		transform: translate(-50%, -100%);
		z-index: 10;
		background: #2d2a26;
		border-radius: 12px;
		padding: 6px 8px;
		box-shadow: 0 4px 24px rgba(45, 42, 38, 0.35);
		display: grid;
		gap: 4px;
		pointer-events: auto;
		border: 1px solid #4a4540;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.tb-btn {
		border: 0;
		border-radius: 7px;
		padding: 5px 10px;
		min-height: 30px;
		background: transparent;
		color: #d4cfc8;
		font-size: 0.8rem;
		font-weight: 500;
		white-space: nowrap;
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		transition: background 0.12s, color 0.12s;
	}

	.tb-btn:hover {
		background: #3d3832;
		color: #f5f0e9;
	}

	.tb-icon {
		width: 30px;
		min-height: 30px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.85rem;
	}

	.tb-active {
		background: #b85c38;
		color: #fff;
	}

	.tb-active:hover {
		background: #c26a3d;
		color: #fff;
	}

	.tb-label {
		font-size: 0.75rem;
		color: #a09888;
		min-width: 22px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.tb-sep {
		width: 1px;
		height: 20px;
		background: #4a4540;
		margin: 0 3px;
	}

	.tb-del:hover {
		background: #a4483b;
		color: #fff;
	}

	.edit-input {
		position: absolute;
		z-index: 20;
		border: 2px solid #b85c38;
		border-radius: 7px;
		padding: 3px 5px;
		background: rgba(255, 254, 250, 0.97);
		color: #3d2c20;
		resize: none;
		overflow: hidden;
		line-height: 1.2;
		outline: none;
		box-sizing: border-box;
		box-shadow: 0 4px 20px rgba(184, 92, 56, 0.25);
	}

	.mode-tabs {
		display: flex;
		border: 1px solid #e0d0bd;
		border-radius: 999px;
		overflow: hidden;
		background: #fffdfa;
	}

	.mode-tab {
		border: 0;
		padding: 0.45rem 1.1rem;
		font-size: 0.82rem;
		font-weight: 600;
		background: transparent;
		color: #8c7b6f;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.mode-tab.active {
		background: #3d2c20;
		color: #fff;
	}

	.mode-tab:hover:not(.active) {
		background: #f5efe4;
		color: #3d2c20;
	}

	@media (max-width: 900px) {
		.canvas-card {
			padding: 1rem;
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

		.actions .print-btn {
			flex: 1 1 12rem;
		}
	}
</style>
