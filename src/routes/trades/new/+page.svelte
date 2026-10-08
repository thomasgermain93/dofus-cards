<script lang="ts">
	import { enhance } from '$app/forms';
	import CardPicker from '#lib/components/CardPicker.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { fmt } from '#lib/format';

	let { data, form } = $props();
	let offer = $state<number[]>([]);
	let request = $state<number[]>([]);
	let kamas = $state(0);
	let toName = $state('');
	$effect(() => {
		if (data.give && data.mine.some((c) => c.id === data.give) && !offer.length) offer = [data.give];
	});
	const me = $derived(page.data.me);
</script>

<svelte:head><title>Nouvel échange</title></svelte:head>

<a href="/trades" class="back"><Icon name="chevron-left" size={20} />Échanges</a>
<h1 class="large-title mb-4">Nouvel échange</h1>

{#if !data.partner}
	<form method="GET" class="group p-4 flex flex-col gap-3 mb-4">
		<p class="headline">Avec qui ?</p>
		{#if data.notFound}<p class="alert alert-error">Aucun joueur avec ce pseudo.</p>{/if}
		{#if data.give}<input type="hidden" name="give" value={data.give} />{/if}
		<div class="flex gap-2">
			<input class="field flex-1" name="to" placeholder="Pseudo du joueur" bind:value={toName} autocapitalize="none" required />
			<button class="btn">Choisir</button>
		</div>
	</form>
	{#if data.friends.length}
		<h2 class="section-label">Tes amis</h2>
		<div class="group">
			{#each data.friends as f (f.id)}
				<a class="cell text-inherit no-underline" href="?to={encodeURIComponent(f.username)}{data.give ? `&give=${data.give}` : ''}">
					<span class="flex-1">{f.username}</span><Icon name="chevron-right" size={16} class="text-label-3" />
				</a>
			{/each}
		</div>
	{/if}
{:else}
	<form method="POST" use:enhance class="flex flex-col gap-5">
		<input type="hidden" name="to" value={data.partner.username} />
		<input type="hidden" name="offer" value={JSON.stringify(offer)} />
		<input type="hidden" name="request" value={JSON.stringify(request)} />
		<p class="text-label-2">Échange avec <a class="text-accent font-semibold" href="/u/{data.partner.username}">{data.partner.username}</a>. <a class="text-accent" href="/trades/new">Changer</a></p>
		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}

		<section>
			<h2 class="title-2 mb-2">Tu donnes</h2>
			<CardPicker cards={data.mine} bind:selected={offer} max={6} repeat empty="Tu n'as aucune carte disponible." />
			<label class="flex items-center gap-3 mt-3">
				<span class="flex-1">Kamas en plus <span class="footnote text-label-2">(tu as {fmt(me?.kamas)})</span></span>
				<input class="field w-32" type="number" name="kamas" min="0" max={me?.kamas} bind:value={kamas} />
			</label>
		</section>

		<section>
			<h2 class="title-2 mb-2">Tu demandes</h2>
			<CardPicker cards={data.theirs} bind:selected={request} max={6} repeat empty="Ce joueur n'a aucune carte disponible." />
		</section>

		<input class="field" name="message" placeholder="Message (facultatif)" maxlength="200" />
		<div class="sticky-bar material">
			<button class="btn btn-block" disabled={!request.length || (!offer.length && !kamas)}>
				<Icon name="send" size={18} />Proposer ({offer.length} carte{offer.length > 1 ? 's' : ''}{kamas ? ` + ${fmt(kamas)} kamas` : ''} contre {request.length})
			</button>
		</div>
	</form>
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
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
	.sticky-bar {
		position: sticky;
		bottom: calc(64px + env(safe-area-inset-bottom));
		padding: 10px 0;
		margin: 0 -16px;
		padding-left: 16px;
		padding-right: 16px;
	}
	@media (min-width: 1024px) {
		.sticky-bar {
			bottom: 0;
		}
	}
</style>
