<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	import { ago } from '#lib/format';

	let { data, form } = $props();
	const t = $derived(data.trade);
	const me = $derived(page.data.me);
	const incoming = $derived(t.to_id === me?.id);
	const STATUS: Record<string, string> = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé', cancelled: 'Annulé', failed: 'Échoué' };
</script>

<svelte:head><title>Échange</title></svelte:head>

<a href="/trades" class="back"><Icon name="chevron-left" size={20} />Échanges</a>
<h1 class="large-title">Échange</h1>
<p class="text-label-2 mb-4">{incoming ? `Proposé par ${t.from_name}` : `Proposé à ${t.to_name}`}, {ago(t.created_at)}. Statut : <strong>{STATUS[t.status]}</strong></p>

{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if t.message}<p class="group p-4 mb-4 italic">« {t.message} »</p>{/if}

<div class="sides">
	<section class="group p-4">
		<h2 class="headline mb-3">{incoming ? 'Tu reçois' : 'Tu donnes'}</h2>
		<div class="cards">{#each data.offer as c, i (i)}<a href="/card/{c.id}"><Card card={c} size="sm" /></a>{/each}</div>
		{#if t.offer_kamas}<p class="mt-3">+ <Kamas value={t.offer_kamas} /></p>{/if}
	</section>
	<div class="swap"><Icon name="repeat" size={22} /></div>
	<section class="group p-4">
		<h2 class="headline mb-3">{incoming ? 'Tu donnes' : 'Tu reçois'}</h2>
		<div class="cards">{#each data.request as c, i (i)}<a href="/card/{c.id}"><Card card={c} size="sm" /></a>{/each}</div>
	</section>
</div>

{#if t.status === 'pending'}
	<div class="flex gap-3 mt-5">
		{#if incoming}
			<form method="POST" action="?/accept" use:enhance class="flex-1"><button class="btn btn-block" data-testid="accept-trade"><Icon name="check" size={18} />Accepter</button></form>
			<form method="POST" action="?/decline" use:enhance class="flex-1"><button class="btn btn-danger btn-block">Refuser</button></form>
		{:else}
			<form method="POST" action="?/cancel" use:enhance class="flex-1"><button class="btn btn-danger btn-block">Annuler la proposition</button></form>
		{/if}
	</div>
{/if}

<style>
	.back {
		display: inline-flex;
		align-items: center;
		color: var(--accent);
		text-decoration: none;
		margin: 0 0 8px -6px;
		font-size: 17px;
	}
	.sides {
		display: grid;
		gap: 12px;
	}
	.swap {
		display: grid;
		place-items: center;
		color: var(--label-3);
	}
	@media (min-width: 768px) {
		.sides {
			grid-template-columns: 1fr auto 1fr;
			align-items: start;
		}
		.swap {
			align-self: center;
		}
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
</style>
