<script lang="ts">
	import { GAME_NAME, DISCLAIMER } from '#lib/config';
	import { page } from '$app/state';
</script>

<svelte:head><title>Mentions, {GAME_NAME}</title></svelte:head>

<div class="doc">
	{#if !page.data.me}<a href="/" class="text-accent">Retour</a>{/if}
	<h1 class="large-title mb-4">Mentions</h1>

	<p class="alert mb-5" style="background: var(--accent-soft); color: var(--label)"><strong>{DISCLAIMER}</strong></p>

	<h2 class="title-2">Un fan-jeu gratuit</h2>
	<p>{GAME_NAME} est un jeu de cartes à collectionner créé par des fans, sans lien avec Ankama. Il est entièrement gratuit : aucun achat, aucun abonnement, aucune publicité. Les kamas du jeu se gagnent uniquement en jouant et n'ont aucune valeur réelle : ils ne s'achètent pas et ne se revendent pas.</p>

	<h2 class="title-2">Propriété intellectuelle</h2>
	<p>Dofus, le Monde des Douze, ses noms, personnages, monstres, objets et illustrations sont la propriété d'Ankama. Ils sont utilisés ici dans un cadre non commercial de fan-jeu. Aucun logo officiel d'Ankama n'est utilisé. Sur simple demande d'Ankama, tout contenu sera retiré.</p>

	<h2 class="title-2">Données</h2>
	<p>Les données des cartes (noms, niveaux, zones, panoplies, images) proviennent de <a class="text-accent" href="https://dofusdb.fr" rel="noopener">DofusDB</a>, puis sont mises en cache sur notre serveur. Les statistiques d'attaque et de défense et les raretés sont calculées par le jeu à partir de ces données.</p>

	<h2 class="title-2">Compte et vie privée</h2>
	<p>Nous ne demandons qu'un pseudo et un mot de passe (stocké chiffré avec Argon2). Aucune adresse e-mail, aucun traceur publicitaire. Un cookie de session sert uniquement à rester connecté.</p>

	<h2 class="title-2">Règles de bonne conduite</h2>
	<ul>
		<li>Reste respectueux : les insultes sont filtrées automatiquement et peuvent mener à une suspension.</li>
		<li>Un seul compte par personne, pas de robot, pas d'exploitation de bug.</li>
		<li>Les modérateurs peuvent suspendre un compte qui ne respecte pas ces règles.</li>
	</ul>

	<h2 class="title-2">Éditeur</h2>
	<p>Projet de démonstration réalisé par Hungry Nuggets (Belgique).</p>
</div>

<style>
	.doc {
		max-width: 680px;
		margin: 0 auto;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		line-height: 1.55;
	}
	.doc h2 {
		margin-top: 14px;
	}
	.doc :global(a) {
		text-decoration: underline;
	}
	.doc ul {
		padding-left: 20px;
		list-style: disc;
	}
</style>
