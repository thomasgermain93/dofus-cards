<script lang="ts">
	import type { CardView } from '#lib/types';
	import CardThumb from './CardThumb.svelte';
	/** Aperçu compact de la vitrine principale (classement, amis, guilde, duel). */
	let { cards, size = 30 }: { cards: CardView[]; size?: number } = $props();
</script>

{#if cards.length}
	<span class="strip" title="Vitrine">{#each cards as c (c.id)}<CardThumb card={c} {size} />{/each}</span>
{/if}

<style>
	.strip {
		display: inline-flex;
		gap: 4px;
		flex: none;
	}
</style>
