<script lang="ts">
	import { enhance } from '$app/forms';
	import { duration } from '#lib/format';
	import Icon from './Icon.svelte';

	type Tier = { tier: string; name: string; min: number; kamas: number; fragments: number; booster: string };
	let {
		chest,
		nextMonday,
		now
	}: {
		chest: {
			current: { count: number; tier: Tier | null; next: Tier | null };
			previous: { count: number; tier: Tier | null; claimed: boolean };
			tiers: Tier[];
		};
		nextMonday: number;
		now: number;
	} = $props();
	const max = $derived(chest.tiers[0].min);
	const COLORS: Record<string, string> = { bronze: '#c77d3a', silver: '#9aa3ad', gold: '#e0a800' };
	let opened = $state<string | null>(null);
</script>

<section class="group p-4" data-testid="chest">
	<div class="flex items-center gap-3 mb-3">
		<span class="box" style="--c: {COLORS[chest.current.tier?.tier ?? 'bronze']}"><Icon name="gift" size={22} /></span>
		<div class="flex-1 min-w-0">
			<h2 class="headline">Coffre de la semaine</h2>
			<p class="footnote text-label-2">
				{chest.current.count} quête{chest.current.count > 1 ? 's' : ''} récupérée{chest.current.count > 1 ? 's' : ''}{chest.current.tier ? `, ${chest.current.tier.name.toLowerCase()} assuré` : ''}.
				S'ouvre lundi (dans {duration(nextMonday - now)}).
			</p>
		</div>
	</div>
	<div class="track">
		<span class="fill" style="width: {Math.min(100, (chest.current.count / max) * 100)}%"></span>
		{#each [...chest.tiers].reverse() as t (t.tier)}
			<span class="mark" class:reached={chest.current.count >= t.min} style="left: {(t.min / max) * 100}%; --c: {COLORS[t.tier]}" title="{t.name} : {t.min} quêtes"></span>
		{/each}
	</div>
	<div class="flex justify-between footnote text-label-3 mt-1">
		{#each [...chest.tiers].reverse() as t (t.tier)}<span>{t.name.replace('Coffre en ', '')} : {t.min}</span>{/each}
	</div>
	{#if chest.previous.tier && !chest.previous.claimed}
		<form method="POST" action="/?/chest" use:enhance={() => async ({ result, update }) => { if (result.type === 'success') opened = chest.previous.tier?.name ?? null; await update(); }}>
			<button class="btn btn-block mt-3 open" data-testid="claim-chest"><Icon name="gift" size={18} />Ouvrir le {chest.previous.tier.name.toLowerCase()} de la semaine dernière</button>
		</form>
	{/if}
	{#if opened}<p class="footnote text-success mt-2 text-center">{opened} ouvert ! Tes récompenses sont dans ton inventaire.</p>{/if}
</section>

<style>
	.box {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: white;
		background: linear-gradient(135deg, color-mix(in srgb, var(--c) 60%, white), var(--c));
		flex: none;
	}
	.track {
		position: relative;
		height: 10px;
		border-radius: 999px;
		background: var(--surface-3);
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: inherit;
		background: linear-gradient(90deg, #c77d3a, #e0a800);
	}
	.mark {
		position: absolute;
		top: 50%;
		width: 16px;
		height: 16px;
		margin: -8px 0 0 -8px;
		border-radius: 999px;
		background: var(--surface);
		border: 3px solid var(--c);
	}
	.mark.reached {
		background: var(--c);
	}
	.open {
		background: linear-gradient(135deg, #ffd60a, #ff9f0a);
		color: #3d2e00;
	}
</style>
