<script lang="ts">
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

	let { items, selectedId, onAddText, onSelectItem }: {
		items: LabelItem[];
		selectedId: number | null;
		onAddText: () => void;
		onSelectItem: (id: number) => void;
	} = $props();
</script>

<div class="instructions">
	<p>Click <strong>Add text</strong> to place a new label element.</p>
	<p>Drag to move, resize from edges, double-click to edit.</p>
</div>

<button class="primary" onclick={onAddText}>Add text</button>
{#each items as item (item.id)}
	<button class:selected={selectedId === item.id} class="item" onclick={() => onSelectItem(item.id)}>
		<strong>{item.text}</strong>
	</button>
{/each}

<style>
	.instructions {
		font-size: 0.8rem;
		color: #6b7280;
		line-height: 1.5;
		padding: 0.5rem 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		background: #f9fafb;
	}

	.instructions p {
		margin: 0;
	}

	.instructions p + p {
		margin-top: 0.3rem;
	}

	.primary {
		border: 0;
		border-radius: 999px;
		padding: 0.8rem 1rem;
		background: #111827;
		color: white;
		cursor: pointer;
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

	button {
		cursor: pointer;
	}
</style>
