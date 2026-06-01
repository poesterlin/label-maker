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
					{printing ? 'Printing...' : 'Print label'}
				</button>
			{:else}
				<button class="print-btn" onclick={onPrintBulkLabels} disabled={printing || bulkLines.length === 0}>
					<IconPrinter size={16} />
					{printing ? 'Printing...' : `Print all (${bulkLines.length})`}
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

	h1 {
		margin: 0;
	}

	.stage-wrap {
		position: relative;
	}

	.stage {
		width: 100%;
		max-width: 100%;
		overflow: hidden;
		border-radius: 16px;
		background: linear-gradient(135deg, #e5e7eb, #f8fafc);
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
		gap: 0.4rem;
		border: 0;
		border-radius: 999px;
		padding: 0.7rem 1.4rem;
		background: #111827;
		color: white;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.print-btn:hover:not(:disabled) {
		background: #1f2937;
	}

	.status {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: #4b5563;
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.toolbar {
		position: absolute;
		transform: translate(-50%, -100%);
		z-index: 10;
		background: #1e293b;
		border-radius: 10px;
		padding: 6px 8px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
		display: grid;
		gap: 4px;
		pointer-events: auto;
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.tb-btn {
		border: 0;
		border-radius: 6px;
		padding: 5px 10px;
		min-height: 30px;
		background: transparent;
		color: #cbd5e1;
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
	}

	.tb-btn:hover {
		background: #334155;
		color: #f1f5f9;
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
		background: #475569;
		color: #fff;
	}

	.tb-label {
		font-size: 0.75rem;
		color: #94a3b8;
		min-width: 22px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.tb-sep {
		width: 1px;
		height: 20px;
		background: #475569;
		margin: 0 3px;
	}

	.tb-del:hover {
		background: #b91c1c;
		color: #fff;
	}

	.edit-input {
		position: absolute;
		z-index: 20;
		border: 2px solid #3b82f6;
		border-radius: 6px;
		padding: 2px;
		background: rgba(255, 255, 255, 0.95);
		color: #111827;
		resize: none;
		overflow: hidden;
		line-height: 1.2;
		outline: none;
		box-sizing: border-box;
		box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
	}

	.mode-tabs {
		display: flex;
		border: 1px solid #e5e7eb;
		border-radius: 999px;
		overflow: hidden;
	}

	.mode-tab {
		border: 0;
		padding: 0.5rem 1.2rem;
		font-size: 0.85rem;
		font-weight: 500;
		background: transparent;
		color: #6b7280;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.mode-tab.active {
		background: #111827;
		color: white;
	}

	.mode-tab:hover:not(.active) {
		background: #f3f4f6;
	}

	@media (max-width: 900px) {
		.canvas-card {
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
	}
</style>
