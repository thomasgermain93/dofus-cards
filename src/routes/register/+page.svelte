<script lang="ts">
	import { enhance } from '$app/forms';
	import Logo from '#lib/components/Logo.svelte';
	import { GAME_NAME } from '#lib/config';
	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Inscription, {GAME_NAME}</title></svelte:head>

<div class="auth">
	<div class="hero"><Logo size={56} text={false} /></div>
	<h1 class="large-title text-center">Créer un compte</h1>
	<p class="text-center text-label-2 mb-6">Choisis un pseudo et c'est parti : 3 paquets offerts.</p>

	<form method="POST" class="flex flex-col gap-3" use:enhance={() => { busy = true; return async ({ update }) => { busy = false; await update(); }; }}>
		{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
		<input class="field" name="username" placeholder="Pseudo (3 à 20 caractères)" autocomplete="username" autocapitalize="none" minlength="3" maxlength="20" value={form?.username ?? ''} required />
		<input class="field" name="password" type="password" placeholder="Mot de passe (8 caractères min.)" autocomplete="new-password" minlength="8" required />
		<input class="field" name="confirm" type="password" placeholder="Confirme le mot de passe" autocomplete="new-password" minlength="8" required />
		<label class="flex items-start gap-3 footnote text-label-2 px-1">
			<input type="checkbox" name="rules" class="mt-1" required />
			<span>Je m'engage à rester respectueux (pas d'insultes, pas de triche). Les comptes abusifs peuvent être suspendus.</span>
		</label>
		<button class="btn btn-block mt-2" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
	</form>
	<p class="text-center mt-6 text-label-2">Déjà inscrit ? <a class="text-accent font-semibold" href="/login">Se connecter</a></p>
</div>

<style>
	.auth {
		width: 100%;
		max-width: 380px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 40px) 20px 0;
		flex: 1;
	}
	.hero {
		display: grid;
		place-items: center;
		margin-bottom: 12px;
	}
</style>
