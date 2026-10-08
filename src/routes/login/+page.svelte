<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '#lib/components/Logo.svelte';
	import { GAME_NAME, GAME_TAGLINE } from '#lib/config';
	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Connexion, {GAME_NAME}</title></svelte:head>

<div class="auth">
	<div class="hero"><Logo size={56} text={false} /></div>
	<h1 class="large-title text-center">{GAME_NAME}</h1>
	<p class="text-center text-label-2 mb-6">{GAME_TAGLINE}</p>

	<form method="POST" class="flex flex-col gap-3" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
		{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
		<input class="field" name="username" placeholder="Pseudo" autocomplete="username" autocapitalize="none" value={form?.username ?? ''} required />
		<input class="field" name="password" type="password" placeholder="Mot de passe" autocomplete="current-password" required />
		<button class="btn btn-block mt-2" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
	</form>
	<p class="text-center mt-6 text-label-2">Pas encore de compte ? <a class="text-accent font-semibold" href="/register">Créer un compte</a></p>
	<p class="footnote text-center text-label-3 mt-2">100 % gratuit : aucun achat, aucun abonnement.</p>
</div>

<style>
	.auth {
		width: 100%;
		max-width: 380px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 56px) 20px 0;
		flex: 1;
	}
	.hero {
		display: grid;
		place-items: center;
		margin-bottom: 12px;
	}
</style>
