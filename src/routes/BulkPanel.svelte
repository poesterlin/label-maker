<script lang="ts">
	const FONT_OPTIONS = [
		{ label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
		{ label: 'Sans', value: 'Inter, system-ui, sans-serif' },
		{ label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
	] as const;

	const FONT_STYLE_OPTIONS = [
		{ label: 'Regular', value: 'normal' },
		{ label: 'Bold', value: 'bold' },
		{ label: 'Italic', value: 'italic' },
		{ label: 'Bold Italic', value: 'bold italic' }
	] as const;

	const TEXT_ALIGN_OPTIONS = [
		{ label: 'Left', value: 'left' },
		{ label: 'Center', value: 'center' },
		{ label: 'Right', value: 'right' }
	] as const;

	let {
		bulkList,
		bulkFontSize,
		bulkFontFamily,
		bulkFontStyle,
		bulkAlign,
		bulkLines,
		bulkPreviewIndex,
		onBulkListChange,
		onBulkFontSizeChange,
		onBulkFontFamilyChange,
		onBulkFontStyleChange,
		onBulkAlignChange,
		onUpdatePreview,
		onSetPreviewIndex
	}: {
		bulkList: string;
		bulkFontSize: number;
		bulkFontFamily: string;
		bulkFontStyle: string;
		bulkAlign: 'left' | 'center' | 'right';
		bulkLines: string[];
		bulkPreviewIndex: number;
		onBulkListChange: (value: string) => void;
		onBulkFontSizeChange: (size: number) => void;
		onBulkFontFamilyChange: (family: string) => void;
		onBulkFontStyleChange: (style: string) => void;
		onBulkAlignChange: (align: 'left' | 'center' | 'right') => void;
		onUpdatePreview: () => void;
		onSetPreviewIndex: (index: number) => void;
	} = $props();
</script>

<div class="bulk-section">
	<label class="bulk-label" for="bulk-list">Labels</label>
	<textarea
		id="bulk-list"
		class="bulk-textarea"
		placeholder="One label per paragraph (separate with blank line)..."
		rows={8}
		value={bulkList}
		oninput={(e) => {
			onBulkListChange(e.currentTarget.value);
			onSetPreviewIndex(0);
			onUpdatePreview();
		}}
	></textarea>
	<p class="bulk-count">{bulkLines.length} label{bulkLines.length !== 1 ? 's' : ''}</p>
</div>

<div class="bulk-section">
	<span class="bulk-label">Font size</span>
	<div class="bulk-row">
		<button class="bulk-btn" onclick={() => { onBulkFontSizeChange(Math.max(12, bulkFontSize - 2)); onUpdatePreview(); }} disabled={bulkFontSize <= 12}>-</button>
		<span class="bulk-value">{bulkFontSize}</span>
		<button class="bulk-btn" onclick={() => { onBulkFontSizeChange(Math.min(180, bulkFontSize + 2)); onUpdatePreview(); }} disabled={bulkFontSize >= 180}>+</button>
	</div>
</div>

<div class="bulk-section">
	<label class="bulk-label" for="bulk-font">Font</label>
	<select id="bulk-font" class="bulk-select" value={bulkFontFamily} onchange={(e) => { onBulkFontFamilyChange(e.currentTarget.value); onUpdatePreview(); }}>
		{#each FONT_OPTIONS as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>

<div class="bulk-section">
	<label class="bulk-label" for="bulk-style">Style</label>
	<select id="bulk-style" class="bulk-select" value={bulkFontStyle} onchange={(e) => { onBulkFontStyleChange(e.currentTarget.value); onUpdatePreview(); }}>
		{#each FONT_STYLE_OPTIONS as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>

<div class="bulk-section">
	<span class="bulk-label">Alignment</span>
	<div class="bulk-row">
		{#each TEXT_ALIGN_OPTIONS as opt (opt.value)}
			<button
				class="bulk-btn"
				class:bulk-btn-active={bulkAlign === opt.value}
				onclick={() => { onBulkAlignChange(opt.value); onUpdatePreview(); }}
				title="Align {opt.label}"
			>{opt.label}</button>
		{/each}
	</div>
</div>

{#if bulkLines.length > 1}
	<div class="bulk-section">
		<span class="bulk-label">Preview ({bulkPreviewIndex + 1} / {bulkLines.length})</span>
		<div class="bulk-row">
			<button class="bulk-btn" disabled={bulkPreviewIndex === 0} onclick={() => { onSetPreviewIndex(bulkPreviewIndex - 1); onUpdatePreview(); }}>Prev</button>
			<button class="bulk-btn" disabled={bulkPreviewIndex >= bulkLines.length - 1} onclick={() => { onSetPreviewIndex(bulkPreviewIndex + 1); onUpdatePreview(); }}>Next</button>
		</div>
	</div>
{/if}

<style>
	.bulk-section {
		display: grid;
		gap: 0.4rem;
	}

	.bulk-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #5c4a3a;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.bulk-textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #e0d0bd;
		border-radius: 10px;
		padding: 0.6rem 0.75rem;
		font-size: 0.85rem;
		resize: vertical;
		min-height: 120px;
		background: #fdfaf4;
		color: #3d2c20;
		line-height: 1.6;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.bulk-textarea::placeholder {
		color: #b8a894;
	}

	.bulk-textarea:focus {
		outline: none;
		border-color: #b85c38;
		box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
	}

	.bulk-count {
		margin: 0;
		font-size: 0.78rem;
		color: #8c7b6f;
		font-variant-numeric: tabular-nums;
	}

	.bulk-row {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.bulk-btn {
		border: 1px solid #e0d0bd;
		border-radius: 8px;
		padding: 0.4rem 0.75rem;
		background: #fffdfa;
		color: #3d2c20;
		font-size: 0.85rem;
		cursor: pointer;
		min-width: 36px;
		text-align: center;
		transition: background 0.12s, border-color 0.12s;
	}

	.bulk-btn:hover:not(:disabled) {
		background: #f5efe4;
		border-color: #d0c4b0;
	}

	.bulk-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.bulk-btn-active {
		background: #3d2c20;
		color: #fff;
		border-color: #3d2c20;
	}

	.bulk-btn-active:hover {
		background: #5c4230;
		border-color: #5c4230;
	}

	.bulk-value {
		font-size: 0.9rem;
		font-weight: 700;
		color: #3d2c20;
		min-width: 36px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.bulk-select {
		width: 100%;
		border: 1px solid #e0d0bd;
		border-radius: 10px;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
		background: #fdfaf4;
		color: #3d2c20;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.bulk-select:focus {
		outline: none;
		border-color: #b85c38;
		box-shadow: 0 0 0 3px rgba(184, 92, 56, 0.12);
	}

	button {
		cursor: pointer;
		font-family: Georgia, "Times New Roman", serif;
	}
</style>
