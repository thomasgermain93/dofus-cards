<script lang="ts">
	import { page } from '$app/state';
	import { duration, fmt } from '#lib/format';
	let { data } = $props();
	const me = $derived(page.data.me);
</script>

<svelte:head><title>Classement</title></svelte:head>

<h1 class="large-title mb-1">Classement</h1>
<p class="text-label-2 mb-4">{data.tab === 'collection' ? 'Score de collection total' : `Fin de la semaine dans ${duration(data.weekEnds - data.now)}`}</p>

<nav class="segmented mb-4">
	<a href="?tab=week" aria-current={data.tab === 'week' ? 'page' : undefined}>Semaine</a>
	<a href="?tab=guilds" aria-current={data.tab === 'guilds' ? 'page' : undefined}>Guildes</a>
	<a href="?tab=collection" aria-current={data.tab === 'collection' ? 'page' : undefined}>Collection</a>
</nav>

{#if data.tab === 'week'}
	<p class="footnote text-label-2 mb-3 px-1">Points de la semaine : nouvelles cartes obtenues en paquet (1 à 100 selon la rareté) et victoires en duel (50 contre un ami, 10 contre l'ordinateur).</p>
{/if}

<div class="group">
	{#if data.tab === 'week'}
		{#each data.players as p, i (p.id)}
			<a class="cell text-inherit no-underline" class:me={p.id === me?.id} href="/u/{p.username}">
				<span class="rank r{i}">{i + 1}</span>
				<span class="flex-1 min-w-0"><span class="font-semibold">{p.username}</span>{#if p.guild_tag} <span class="footnote text-label-2">[{p.guild_tag}]</span>{/if}
					<span class="block footnote text-label-2">{fmt(p.card_points)} cartes, {fmt(p.duel_points)} duels</span></span>
				<span class="font-bold tabular-nums">{fmt(p.score)}</span>
			</a>
		{:else}<p class="cell text-label-2">Personne n'a encore marqué de points cette semaine.</p>{/each}
	{:else if data.tab === 'guilds'}
		{#each data.guilds as g, i (g.id)}
			<a class="cell text-inherit no-underline" href="/guilds/{g.id}">
				<span class="rank r{i}">{i + 1}</span>
				<span class="flex-1 min-w-0"><span class="font-semibold">{g.name}</span> <span class="footnote text-label-2">[{g.tag}], {g.members} membre{g.members > 1 ? 's' : ''}</span></span>
				<span class="font-bold tabular-nums">{fmt(g.score)}</span>
			</a>
		{:else}<p class="cell text-label-2">Aucune guilde classée.</p>{/each}
	{:else}
		{#each data.collection as p, i (p.id)}
			<a class="cell text-inherit no-underline" class:me={p.id === me?.id} href="/u/{p.username}">
				<span class="rank r{i}">{i + 1}</span>
				<span class="flex-1 min-w-0"><span class="font-semibold">{p.username}</span>{#if p.guild_tag} <span class="footnote text-label-2">[{p.guild_tag}]</span>{/if}
					<span class="block footnote text-label-2">{fmt(p.distinct_cards)} cartes différentes</span></span>
				<span class="font-bold tabular-nums">{fmt(p.score)}</span>
			</a>
		{:else}<p class="cell text-label-2">Aucun joueur.</p>{/each}
	{/if}
</div>

<style>
	.rank {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 13px;
		background: var(--surface-3);
		flex: none;
	}
	.rank.r0 {
		background: #ffd60a;
		color: #5c4300;
	}
	.rank.r1 {
		background: #d1d1d6;
		color: #3a3a3c;
	}
	.rank.r2 {
		background: #e3a76f;
		color: #4a2600;
	}
	.me {
		background: var(--accent-soft);
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
