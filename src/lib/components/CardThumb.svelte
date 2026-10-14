<script lang="ts">
	import { RARITY, rarityColor } from '#lib/rarity';
	import { imgUrl } from '#lib/format';
	import type { CardView } from '#lib/types';
	let { card, size = 48 }: { card: CardView; size?: number } = $props();
</script>

<span class="thumb" style="--rc: {rarityColor(card.rarity)}; width: {size}px; height: {size}px" title="{card.name} ({RARITY[card.rarity].name})">
	{#if card.image}<img src={imgUrl(card.image)} alt="" loading="lazy" />{/if}
	<span class="code">{RARITY[card.rarity].code}</span>
</span>

<style>
	.thumb {
		position: relative;
		display: inline-grid;
		place-items: center;
		flex: none;
		border-radius: var(--radius-md);
		border: 2px solid var(--rc);
		background: radial-gradient(circle, var(--card-parch-2), var(--card-parch));
		box-shadow: 0 0 0 1px var(--panel-edge);
	}
	img {
		width: 80%;
		height: 80%;
		object-fit: contain;
	}
	.code {
		position: absolute;
		left: -4px;
		bottom: -4px;
		font-size: 9px;
		font-weight: 800;
		color: white;
		background: var(--rc);
		border-radius: 5px;
		padding: 0 3px;
	}
</style>
