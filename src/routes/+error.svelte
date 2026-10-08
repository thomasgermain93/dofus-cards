<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
</script>

<svelte:head><title>Oups</title></svelte:head>

<div class="empty" role="alert">
	<Icon name="info" size={40} />
	<h1 class="title-2">{page.status === 404 ? 'Page introuvable' : 'Une erreur est survenue'}</h1>
	<p class="max-w-sm">{page.error?.message ?? 'Réessaie dans un instant.'}</p>
	<div class="flex gap-2 mt-2">
		<a class="btn" href="/">Accueil</a>
		<button class="btn btn-secondary" onclick={() => history.back()}>Retour</button>
	</div>
</div>
