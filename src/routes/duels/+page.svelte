<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { ago } from '#lib/format';

	let { data } = $props();
	const me = $derived(page.data.me);

	function label(d: (typeof data.duels)[number]) {
		const other = d.vs_bot ? data.botName : d.challenger_id === me?.id ? d.opponent : d.challenger;
		return other ?? '?';
	}
	function state(d: (typeof data.duels)[number]) {
		if (d.status === 'pending') return d.opponent_id === me?.id ? { text: 'Défi reçu : choisis tes cartes', tone: 'accent' } : { text: 'En attente de réponse', tone: 'muted' };
		if (d.status === 'active') return d.todo ? { text: `À toi de jouer (${d.todo} question${d.todo > 1 ? 's' : ''})`, tone: 'accent' } : { text: "En attente de l'adversaire", tone: 'muted' };
		if (d.status === 'declined') return { text: 'Refusé', tone: 'muted' };
		if (d.result === 'draw') return { text: 'Match nul', tone: 'muted' };
		return d.winner_id === me?.id ? { text: 'Victoire', tone: 'success' } : { text: 'Défaite', tone: 'danger' };
	}
</script>

<svelte:head><title>Duels</title></svelte:head>

<h1 class="large-title mb-1">Duels</h1>
<nav class="segmented my-3">
	<a href="/duels" aria-current="page">Duels</a>
	<a href="/battle">Bataille de groupe</a>
</nav>
<p class="text-label-2 mb-4">{data.stats.wins ?? 0} victoire{(data.stats.wins ?? 0) > 1 ? 's' : ''} sur {data.stats.played} duel{data.stats.played > 1 ? 's' : ''}</p>

<div class="grid grid-cols-2 gap-3 mb-5">
	<a href="/duels/new" class="action"><span class="ic bg-a"><Icon name="swords" size={24} /></span><span class="headline">Défier un ami</span><span class="footnote text-label-2">Chacun répond à son rythme</span></a>
	<a href="/duels/new?vs=bot" class="action"><span class="ic bg-b"><Icon name="bot" size={24} /></span><span class="headline">Entraînement</span><span class="footnote text-label-2">Contre l'ordinateur</span></a>
</div>

<details class="group p-4 mb-5 rules">
	<summary class="headline">Règles du duel</summary>
	<ul class="footnote text-label-2 mt-2 flex flex-col gap-1 list-disc pl-5">
		<li>Chaque joueur choisit 3 cartes. Ses points de vie = la somme de leurs défenses.</li>
		<li>Tu réponds à 3 questions sur chaque carte adverse (9 au total), tirées des vraies données du jeu.</li>
		<li>Chaque carte attaque une fois : dégâts = son attaque x le taux de mauvaises réponses de l'adversaire sur cette carte.</li>
		<li>Le gagnant est celui qui garde la plus grande part de ses points de vie.</li>
		<li>Astuce : des cartes obscures en attaque, c'est plus de questions difficiles pour l'autre !</li>
	</ul>
</details>

<h2 class="section-label">Mes duels</h2>
<div class="group">
	{#each data.duels as d (d.id)}
		{@const s = state(d)}
		<a class="cell text-inherit no-underline" href="/duels/{d.id}">
			<span class="avatar">{#if d.vs_bot}<Icon name="bot" size={18} />{:else}{label(d).slice(0, 1).toUpperCase()}{/if}</span>
			<span class="flex-1 min-w-0">
				<span class="block font-semibold truncate">{label(d)}</span>
				<span class="footnote tone-{s.tone}">{s.text}</span>
			</span>
			<span class="footnote text-label-3">{ago(d.finished_at ?? d.created_at)}</span>
			<Icon name="chevron-right" size={16} class="text-label-3" />
		</a>
	{:else}
		<p class="cell text-label-2">Aucun duel pour l'instant.</p>
	{/each}
</div>

<style>
	.action {
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: inherit;
		text-decoration: none;
		transition: transform var(--dur-fast) var(--ease-ios);
	}
	.action:active {
		transform: scale(0.97);
	}
	.ic {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: white;
		margin-bottom: 6px;
	}
	.bg-a {
		background: linear-gradient(135deg, var(--pink), var(--orange));
	}
	.bg-b {
		background: linear-gradient(135deg, var(--green), var(--blue));
	}
	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: var(--surface-3);
		font-weight: 700;
		flex: none;
	}
	.tone-accent {
		color: var(--accent);
		font-weight: 600;
	}
	.tone-success {
		color: var(--success);
		font-weight: 600;
	}
	.tone-danger {
		color: var(--danger);
	}
	.tone-muted {
		color: var(--label-2);
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
	.rules summary {
		cursor: pointer;
		list-style: none;
	}
</style>
