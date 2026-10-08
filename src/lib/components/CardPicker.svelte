<script lang="ts">
	import type { CardView } from '#lib/types';
	import { CATEGORIES } from '#lib/rarity';
	import Card from './Card.svelte';
	import Icon from './Icon.svelte';

	let {
		cards,
		selected = $bindable([]),
		max = 6,
		repeat = false,
		empty = 'Aucune carte.'
	}: {
		cards: (CardView & { free?: number })[];
		selected?: number[];
		max?: number;
		/** autorise plusieurs exemplaires de la même carte (dans la limite de `free`) */
		repeat?: boolean;
		empty?: string;
	} = $props();

	let q = $state('');
	let cat = $state('all');
	const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
	const filtered = $derived(
		cards.filter((c) => (cat === 'all' || c.category === cat) && (!q || norm(c.name).includes(norm(q)))).slice(0, 150)
	);
	const countOf = (id: number) => selected.filter((s) => s === id).length;

	function toggle(c: CardView & { free?: number }) {
		const n = countOf(c.id);
		const free = c.free ?? 1;
		if (repeat && n > 0 && n < free && selected.length < max) {
			selected = [...selected, c.id];
		} else if (n > 0) {
			selected = selected.filter((s) => s !== c.id);
		} else if (selected.length < max) {
			selected = [...selected, c.id];
		}
	}
</script>

<div class="picker">
	<div class="flex gap-2 mb-2">
		<label class="relative flex-1 flex items-center">
			<span class="absolute left-2.5 text-label-3 pointer-events-none"><Icon name="search" size={16} /></span>
			<input class="field search pl-8" type="search" placeholder="Rechercher" bind:value={q} aria-label="Rechercher une carte" />
		</label>
		<select class="field search w-auto" bind:value={cat} aria-label="Type">
			<option value="all">Tout</option>
			{#each CATEGORIES as c}<option value={c.key}>{c.name}</option>{/each}
		</select>
	</div>
	<p class="footnote text-label-2 mb-2">{selected.length} / {max} sélectionnée{max > 1 ? 's' : ''}</p>
	<div class="grid">
		{#each filtered as c (c.id)}
			{@const n = countOf(c.id)}
			<button type="button" class="pick" class:on={n > 0} onclick={() => toggle(c)} aria-pressed={n > 0} aria-label={c.name}>
				<Card card={c} size="sm" count={c.free ?? 0} />
				{#if n > 0}<span class="check">{repeat && n > 1 ? n : ''}{#if !(repeat && n > 1)}<Icon name="check" size={14} stroke={3} />{/if}</span>{/if}
			</button>
		{:else}
			<p class="text-label-2 col-span-full text-center py-6">{empty}</p>
		{/each}
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 8px;
		max-height: 420px;
		overflow-y: auto;
		padding: 4px;
		margin: -4px;
	}
	.pick {
		position: relative;
		border: 0;
		background: none;
		padding: 0;
		cursor: pointer;
		border-radius: 14px;
		transition: transform var(--dur-fast) var(--ease-ios);
	}
	.pick.on {
		transform: scale(0.94);
		outline: 3px solid var(--accent);
		outline-offset: 1px;
	}
	.check {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 24px;
		height: 24px;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 13px;
		box-shadow: 0 0 0 2px var(--surface);
	}
</style>
