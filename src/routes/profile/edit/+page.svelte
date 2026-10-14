<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import CardPicker from '#lib/components/CardPicker.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let { data, form } = $props();
	const me = $derived(page.data.me);

	let avatarPick = $state<number[]>([]);
	let ax = $state(50);
	let ay = $state(40);
	$effect.pre(() => {
		avatarPick = data.avatar.avatar_card_id ? [data.avatar.avatar_card_id] : [];
		ax = data.avatar.avatar_x;
		ay = data.avatar.avatar_y;
	});
	const avatarImage = $derived(data.mine.find((c) => c.id === avatarPick[0])?.image ?? null);

	// Édition d'une vitrine : null = fermée, 0 = nouvelle
	let editing = $state<number | null>(null);
	let name = $state('');
	let picks = $state<number[]>([]);
	function edit(s: { id: number; name: string; cardIds: number[] } | null) {
		editing = s ? s.id : 0;
		name = s ? s.name : `Vitrine ${data.showcases.length + 1}`;
		picks = s ? [...s.cardIds] : [];
	}
	const nameOf = (id: number) => data.mine.find((c) => c.id === id)?.name ?? '?';
</script>

<svelte:head><title>Personnaliser mon profil</title></svelte:head>

<a href="/u/{me?.username}" class="back-link"><Icon name="chevron-left" size={20} />Mon profil</a>
<h1 class="large-title mb-4">Personnaliser</h1>
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if form?.saved}<p class="alert alert-ok mb-3">Enregistré.</p>{/if}

<section class="group p-4 mb-6">
	<h2 class="title-2 mb-1">Avatar</h2>
	<p class="footnote text-label-2 mb-3">Choisis une carte de ta collection et règle le cadrage.</p>
	<div class="flex items-center gap-5 mb-4">
		<Avatar name={me?.username ?? '?'} image={avatarImage} x={ax} y={ay} size={96} />
		<div class="flex-1 flex flex-col gap-3">
			<label class="flex items-center gap-3 footnote">Horizontal <input type="range" min="0" max="100" bind:value={ax} class="flex-1" /></label>
			<label class="flex items-center gap-3 footnote">Vertical <input type="range" min="0" max="100" bind:value={ay} class="flex-1" /></label>
		</div>
	</div>
	<CardPicker cards={data.mine} bind:selected={avatarPick} max={1} />
	<form method="POST" action="?/avatar" use:enhance class="mt-3">
		<input type="hidden" name="card" value={avatarPick[0] ?? ''} />
		<input type="hidden" name="x" value={ax} />
		<input type="hidden" name="y" value={ay} />
		<button class="btn btn-block" data-testid="save-avatar">Enregistrer l'avatar</button>
	</form>
</section>

<section id="vitrines">
	<div class="flex items-center justify-between mb-2">
		<h2 class="title-2">Vitrines</h2>
		{#if data.showcases.length < data.max}<button class="btn btn-secondary btn-sm" onclick={() => edit(null)} data-testid="new-showcase"><Icon name="plus" size={16} />Nouvelle vitrine</button>{/if}
	</div>
	<p class="footnote text-label-2 mb-3">Jusqu'à {data.slots} cartes par vitrine, {data.max} vitrines. La vitrine principale apparaît dans le classement, ta guilde, la liste d'amis et les duels.</p>

	{#if editing !== null}
		<form method="POST" action="?/showcase" use:enhance={() => async ({ result, update }) => { if (result.type === 'success') editing = null; await update(); }} class="group p-4 mb-4 flex flex-col gap-3">
			<input type="hidden" name="id" value={editing || ''} />
			<input type="hidden" name="cards" value={JSON.stringify(picks)} />
			<input class="field" name="name" bind:value={name} maxlength="30" placeholder="Nom de la vitrine" />
			<p class="footnote text-label-2">{picks.length} / {data.slots} cartes{picks.length ? ` : ${picks.map(nameOf).join(', ')}` : ''}</p>
			<CardPicker cards={data.mine} bind:selected={picks} max={data.slots} />
			<div class="flex gap-2">
				<button class="btn flex-1" data-testid="save-showcase">Enregistrer</button>
				<button type="button" class="btn btn-plain" onclick={() => (editing = null)}>Annuler</button>
			</div>
		</form>
	{/if}

	<div class="group">
		{#each data.showcases as s (s.id)}
			<div class="cell flex-wrap">
				<span class="flex-1 min-w-0">
					<span class="font-semibold">{s.name}</span>{#if s.is_main}<span class="main">principale</span>{/if}
					<span class="block footnote text-label-2 truncate">{s.cardIds.length} carte{s.cardIds.length > 1 ? 's' : ''}{s.cardIds.length ? ` : ${s.cardIds.map(nameOf).join(', ')}` : ''}</span>
				</span>
				<button class="btn btn-secondary btn-sm" onclick={() => edit(s)}>Modifier</button>
				{#if !s.is_main}<form method="POST" action="?/main" use:enhance><input type="hidden" name="id" value={s.id} /><button class="btn btn-plain btn-sm">Principale</button></form>{/if}
				<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={s.id} /><button class="btn btn-plain btn-sm text-danger" aria-label="Supprimer"><Icon name="trash" size={16} /></button></form>
			</div>
		{:else}
			<p class="cell text-label-2">Aucune vitrine. Crée la première pour te montrer !</p>
		{/each}
	</div>
</section>

<style>
	.main {
		margin-left: 8px;
		font-size: 11px;
		font-weight: 700;
		color: var(--title-ink);
		background: var(--title-bg);
		border-radius: 999px;
		padding: 1px 8px;
	}
	input[type='range'] {
		accent-color: var(--accent);
	}
</style>
