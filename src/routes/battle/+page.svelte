<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { ago } from '#lib/format';
	let { data, form } = $props();
	let code = $state('');
</script>

<svelte:head><title>Bataille de groupe</title></svelte:head>

<h1 class="large-title mb-1">Bataille de groupe</h1>
<p class="text-label-2 mb-4">De 3 à 50 joueurs sur les mêmes questions Dofus. Chacun amène 3 cartes, 15 secondes par question, plus de points quand peu de joueurs trouvent.</p>
<nav class="segmented mb-4">
	<a href="/duels">Duels</a>
	<a href="/battle" aria-current="page">Bataille de groupe</a>
</nav>
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

<div class="grid gap-3 sm:grid-cols-2 mb-5">
	<form method="POST" action="?/create" use:enhance class="group p-4 flex flex-col gap-3">
		<span class="ic"><Icon name="users" size={24} /></span>
		<p class="headline">Créer un salon</p>
		<p class="footnote text-label-2">Tu reçois un code à 6 caractères à partager (Discord, stream, entre amis).</p>
		<button class="btn" data-testid="create-battle">Créer une bataille</button>
	</form>
	<form method="POST" action="?/join" use:enhance class="group p-4 flex flex-col gap-3">
		<span class="ic b"><Icon name="swords" size={24} /></span>
		<p class="headline">Rejoindre avec un code</p>
		<input class="field code" name="code" bind:value={code} maxlength="6" placeholder="EX. 2VBC8B" autocapitalize="characters" autocomplete="off" required />
		<button class="btn btn-secondary" disabled={code.length < 6} data-testid="join-battle">Rejoindre</button>
	</form>
</div>

<div class="group p-4 mb-5">
	<p class="headline mb-1">Barème</p>
	<p class="footnote text-label-2">Bonne réponse : 10 points. Trouvée par moins de la moitié des joueurs : 20. Par moins de 10 % : 30. Pas de points sur sa propre carte. Podium : 150, 100 et 60 kamas, 20 pour les autres.</p>
</div>

<h2 class="section-label">Mes batailles</h2>
<div class="group">
	{#each data.history as h (h.code)}
		<a class="cell text-inherit no-underline" href="/battle/{h.code}">
			<span class="font-mono font-bold">{h.code}</span>
			<span class="flex-1 footnote text-label-2">{h.players} joueurs, {ago(h.created_at)}</span>
			<span class="footnote font-semibold">{h.status === 'done' ? `${h.rank}e, ${h.score} pts` : h.status === 'lobby' ? 'En attente' : h.status === 'running' ? 'En cours' : 'Annulée'}</span>
		</a>
	{:else}
		<p class="cell text-label-2">Aucune bataille pour l'instant.</p>
	{/each}
</div>

<style>
	.ic {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: white;
		background: linear-gradient(135deg, var(--indigo), var(--purple));
	}
	.ic.b {
		background: linear-gradient(135deg, var(--pink), var(--orange));
	}
	.code {
		text-transform: uppercase;
		letter-spacing: 0.3em;
		font-weight: 800;
		text-align: center;
		font-size: 22px;
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
