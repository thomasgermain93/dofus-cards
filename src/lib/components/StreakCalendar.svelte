<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from './Icon.svelte';

	type Reward = { kamas: number; fragments?: number; booster?: string };
	let {
		daily
	}: {
		daily: {
			available: boolean;
			streak: number;
			best: number;
			nextStreak: number;
			willUseJoker: boolean;
			jokerAvailable: boolean;
			missedYesterday: boolean;
			todayIndex: number;
			calendar: Reward[];
		};
	} = $props();

	const BOOSTER: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };
	// Jour du calendrier déjà récupéré aujourd'hui = todayIndex ; s'il reste à prendre, les jours avant sont faits.
	const doneUpTo = $derived(daily.available ? daily.todayIndex - 1 : daily.todayIndex);
	let busy = $state(false);
	let got = $state<string | null>(null);
</script>

<section class="group p-4" data-testid="streak">
	<div class="flex items-center gap-3 mb-3">
		<span class="flame"><Icon name="sparkles" size={22} /></span>
		<div class="flex-1 min-w-0">
			<h2 class="headline">Série de {daily.available ? daily.streak : daily.streak} jour{daily.streak > 1 ? 's' : ''}</h2>
			<p class="footnote text-label-2">
				{#if daily.available && daily.willUseJoker}Ton joker de la semaine sauve ta série !
				{:else if daily.available && daily.missedYesterday}Bon retour ! Ta série repart à {daily.nextStreak}.
				{:else if daily.available}Récupère ta récompense pour passer à {daily.nextStreak} jours.
				{:else}Reviens demain pour le jour {daily.todayIndex === 7 ? 1 : daily.todayIndex + 1}.{/if}
				{daily.jokerAvailable ? ' Joker disponible.' : ''}
			</p>
		</div>
	</div>
	<ol class="days">
		{#each daily.calendar as r, i (i)}
			{@const day = i + 1}
			<li class:done={day <= doneUpTo} class:today={daily.available && day === daily.todayIndex} class:big={!!r.booster}>
				<span class="d">J{day}</span>
				<span class="k">{r.kamas}</span>
				<span class="x">{r.booster ? BOOSTER[r.booster] : r.fragments ? `+${r.fragments} fr.` : 'kamas'}</span>
				{#if day <= doneUpTo}<span class="check"><Icon name="check" size={12} stroke={3.2} /></span>{/if}
			</li>
		{/each}
	</ol>
	{#if daily.available}
		<form
			method="POST"
			action="/?/daily"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'success' && result.data?.daily) {
						const d = result.data.daily as { kamas: number; fragments: number; booster: string | null };
						got = `+${d.kamas} kamas${d.fragments ? `, +${d.fragments} fragments` : ''}${d.booster ? `, Booster ${BOOSTER[d.booster]}` : ''}, +1 paquet`;
					}
					await update();
				};
			}}
		>
			<button class="btn btn-block mt-3" disabled={busy} data-testid="claim-daily"><Icon name="gift" size={18} />Récupérer le jour {daily.todayIndex}</button>
		</form>
	{/if}
	{#if got}<p class="footnote text-success mt-2 text-center">{got}</p>{/if}
	<p class="footnote text-label-3 mt-2">Record : {daily.best} jours. Un jour manqué ? Le joker hebdomadaire garde ta série ; au-delà, elle est divisée par deux, jamais remise à zéro.</p>
</section>

<style>
	.flame {
		width: 44px;
		height: 44px;
border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		color: var(--emblem-ink);
		background: var(--emblem-red);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		flex: none;
	}
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 5px;
	}
	.days li {
		position: relative;
		border-radius: var(--radius-md);
		background: var(--slot);
		box-shadow: var(--slot-inset);
		padding: 6px 2px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		border: 1px solid var(--slot-edge);
	}
	.days li.big {
		background: color-mix(in srgb, var(--gold) 14%, var(--slot));
	}
	.days li.today {
		border-color: var(--gold-deep);
		background: color-mix(in srgb, var(--gold) 20%, var(--slot));
		animation: glow 1.6s ease-in-out infinite alternate;
	}
	.days li.done {
		opacity: 0.75;
	}
	.d {
		font-size: 10px;
		font-weight: 700;
		color: var(--label-2);
	}
	.k {
		font-size: 14px;
		font-weight: 800;
		color: var(--kamas);
		font-variant-numeric: tabular-nums;
	}
	.x {
		font-size: 9.5px;
		color: var(--label-2);
		white-space: nowrap;
	}
	.check {
		position: absolute;
		top: -5px;
		right: -5px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: var(--emblem-green);
		border: 1px solid var(--panel-edge);
		color: var(--emblem-ink);
		display: grid;
		place-items: center;
	}
	@keyframes glow {
		to {
			box-shadow: var(--slot-inset), 0 0 10px -1px color-mix(in srgb, var(--gold) 60%, transparent);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.days li.today {
			animation: none;
		}
	}
</style>
