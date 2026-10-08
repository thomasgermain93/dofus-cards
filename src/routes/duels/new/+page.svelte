<script lang="ts">
	import { enhance } from '$app/forms';
	import CardPicker from '#lib/components/CardPicker.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { fmt } from '#lib/format';

	let { data, form } = $props();
	let vs = $state('');
	$effect(() => {
		if (!vs) vs = data.vs || (data.friends[0]?.username ?? 'bot');
	});
	let cards = $state<number[]>([]);
	const chosen = $derived(cards.map((id) => data.mine.find((c) => c.id === id)!).filter(Boolean));
	const hp = $derived(chosen.reduce((s, c) => s + c.defense, 0));
	const atk = $derived(chosen.reduce((s, c) => s + c.attack, 0));
</script>

<svelte:head><title>Nouveau duel</title></svelte:head>

<a href="/duels" class="back"><Icon name="chevron-left" size={20} />Duels</a>
<h1 class="large-title mb-4">Nouveau duel</h1>

<form method="POST" use:enhance class="flex flex-col gap-5">
	<input type="hidden" name="cards" value={JSON.stringify(cards)} />
	{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}

	<section>
		<h2 class="section-label">Adversaire</h2>
		<div class="group">
			<label class="cell cursor-pointer">
				<input type="radio" name="vs" value="bot" bind:group={vs} />
				<Icon name="bot" class="text-success" /><span class="flex-1">Ordinateur (entraînement)</span>
			</label>
			{#each data.friends as f (f.id)}
				<label class="cell cursor-pointer">
					<input type="radio" name="vs" value={f.username} bind:group={vs} />
					<Icon name="user" class="text-accent" /><span class="flex-1">{f.username}</span>
				</label>
			{/each}
		</div>
		{#if !data.friends.length}<p class="footnote text-label-2 mt-2 px-1">Ajoute des amis dans l'onglet <a class="text-accent" href="/social">Social</a> pour les défier.</p>{/if}
	</section>

	<section>
		<h2 class="title-2 mb-1">Ton équipe</h2>
		<p class="footnote text-label-2 mb-3">Choisis 3 cartes. Leur défense fait tes points de vie, leur attaque tes dégâts potentiels.</p>
		<CardPicker cards={data.mine} bind:selected={cards} max={3} empty="Ouvre d'abord quelques paquets !" />
	</section>

	<div class="sticky-bar material">
		<div class="flex justify-between footnote text-label-2 mb-2">
			<span class="flex items-center gap-1"><Icon name="heart" size={14} />PV {fmt(hp)}</span>
			<span class="flex items-center gap-1"><Icon name="sword" size={14} />Attaque totale {fmt(atk)}</span>
		</div>
		<button class="btn btn-block" disabled={cards.length !== 3} data-testid="start-duel"><Icon name="swords" size={18} />{vs === 'bot' ? "Lancer l'entraînement" : `Défier ${vs}`}</button>
	</div>
</form>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		color: var(--accent);
		text-decoration: none;
		margin: 0 0 8px -6px;
		font-size: 17px;
	}
	input[type='radio'] {
		accent-color: var(--accent);
		width: 18px;
		height: 18px;
	}
	.sticky-bar {
		position: sticky;
		bottom: calc(64px + env(safe-area-inset-bottom));
		padding: 10px 16px;
		margin: 0 -16px;
	}
	@media (min-width: 1024px) {
		.sticky-bar {
			bottom: 0;
		}
	}
</style>
