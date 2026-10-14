<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
</script>

<svelte:head><title>{page.status === 404 ? 'Page introuvable' : 'Erreur'}</title></svelte:head>

<div class="empty" role="alert">
	<span class="lost"><Icon name="search" size={30} /></span>
	<h1 class="title-2">{page.status === 404 ? 'Page introuvable' : 'Une erreur est survenue'}</h1>
	<p class="max-w-sm">{page.status === 404 ? 'Ce chemin ne mène nulle part, même avec une carte du Monde des Douze.' : page.error?.message && page.error.message !== 'Internal Error' ? page.error.message : 'Réessaie dans un instant.'}</p>
	<div class="flex gap-2 mt-2">
		<a class="btn" href="/">Accueil</a>
		<button class="btn btn-secondary" onclick={() => history.back()}>Retour</button>
	</div>

<style>
	.lost {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		background: var(--emblem-wood);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		color: var(--gold);
	}
</style>
</div>

<style>
	.lost {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		background: var(--emblem-wood);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		color: var(--gold);
	}
</style>
