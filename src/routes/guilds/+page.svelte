<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { fmt } from '#lib/format';

	let { data, form } = $props();
	let showCreate = $state(false);
</script>

<svelte:head><title>Guildes</title></svelte:head>

<h1 class="large-title mb-3">Social</h1>
<nav class="segmented mb-4">
	<a href="/social?tab=friends">Amis</a>
	<a href="/social?tab=messages">Messages</a>
	<a href="/guilds" aria-current="page">Guilde</a>
</nav>

{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

{#if !data.inGuild}
	<div class="group p-4 mb-5">
		<p class="headline">Tu n'as pas encore de guilde</p>
		<p class="footnote text-label-2 mb-3">Rejoins une guilde pour discuter avec ses membres et grimper ensemble au classement hebdomadaire.</p>
		<button class="btn btn-secondary btn-sm" onclick={() => (showCreate = !showCreate)}><Icon name="plus" size={16} />Créer une guilde</button>
		{#if showCreate}
			<form method="POST" action="?/create" use:enhance class="flex flex-col gap-3 mt-4">
				<input class="field" name="name" placeholder="Nom (3 à 24 caractères)" minlength="3" maxlength="24" required />
				<input class="field" name="tag" placeholder="Tag (2 à 4 lettres, ex. BFT)" minlength="2" maxlength="4" required />
				<textarea class="field" name="description" rows="2" maxlength="300" placeholder="Description (facultatif)"></textarea>
				<button class="btn">Créer</button>
			</form>
		{/if}
	</div>
{/if}

{#if data.weekly.length}
	<h2 class="section-label">Classement de la semaine</h2>
	<div class="group mb-5">
		{#each data.weekly.slice(0, 5) as g, i (g.id)}
			<a class="cell text-inherit no-underline" href="/guilds/{g.id}">
				<span class="rank r{i}">{i + 1}</span>
				<span class="flex-1 min-w-0"><span class="font-semibold">{g.name}</span> <span class="footnote text-label-2">[{g.tag}], {g.members} membre{g.members > 1 ? 's' : ''}</span></span>
				<span class="font-semibold tabular-nums">{fmt(g.score)} pts</span>
			</a>
		{/each}
	</div>
{/if}

<h2 class="section-label">Toutes les guildes</h2>
<div class="group">
	{#each data.guilds as g (g.id)}
		<div class="cell">
			<span class="tag">{g.tag}</span>
			<a class="flex-1 min-w-0 text-inherit no-underline" href="/guilds/{g.id}">
				<span class="block font-semibold truncate">{g.name}</span>
				<span class="footnote text-label-2">{g.members} membre{g.members > 1 ? 's' : ''}, chef : {g.leader}</span>
			</a>
			{#if !data.inGuild}
				<form method="POST" action="?/join" use:enhance><input type="hidden" name="id" value={g.id} /><button class="btn btn-sm">Rejoindre</button></form>
			{/if}
		</div>
	{:else}
		<p class="cell text-label-2">Aucune guilde pour l'instant : crée la première !</p>
	{/each}
</div>

<style>
	.tag {
		font-size: 12px;
		font-weight: 800;
		padding: 4px 8px;
		border-radius: 8px;
		background: var(--accent-soft);
		color: var(--accent);
		flex: none;
	}
	.rank {
		width: 26px;
		height: 26px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 13px;
		background: var(--surface-3);
		flex: none;
	}
	.rank.r0 {
		background: var(--gold);
		color: var(--medal-1-ink);
	}
	.rank.r1 {
		background: var(--medal-2);
		color: var(--medal-2-ink);
	}
	.rank.r2 {
		background: var(--medal-3);
		color: var(--medal-3-ink);
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
