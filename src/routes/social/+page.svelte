<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { ago } from '#lib/format';
	import { levelOf } from '#lib/level';
	import Avatar from '#lib/components/Avatar.svelte';
	import ShowcaseStrip from '#lib/components/ShowcaseStrip.svelte';

	let { data, form } = $props();
	const me = $derived(page.data.me);
	const tab = $derived(page.url.searchParams.get('tab') ?? 'friends');
	const friends = $derived(data.friends.filter((f) => f.status === 'accepted'));
	const received = $derived(data.friends.filter((f) => f.status === 'pending' && f.requester !== me?.id));
	const sent = $derived(data.friends.filter((f) => f.status === 'pending' && f.requester === me?.id));
	const unread = $derived(data.inbox.reduce((s, c) => s + c.unread, 0));
</script>

<svelte:head><title>Social</title></svelte:head>

<h1 class="large-title mb-3">Social</h1>
<nav class="segmented mb-4">
	<a href="?tab=friends" aria-current={tab === 'friends' ? 'page' : undefined}>Amis{#if received.length}&nbsp;<span class="badge">{received.length}</span>{/if}</a>
	<a href="?tab=messages" aria-current={tab === 'messages' ? 'page' : undefined}>Messages{#if unread}&nbsp;<span class="badge">{unread}</span>{/if}</a>
	<a href="/guilds">Guilde</a>
</nav>

{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if form?.added}<p class="alert alert-ok mb-3">Demande envoyée.</p>{/if}

{#if tab === 'friends'}
	<form method="POST" action="?/add" use:enhance class="flex gap-2 mb-5">
		<input class="field flex-1" name="username" placeholder="Ajouter un ami par pseudo" autocapitalize="none" required />
		<button class="btn"><Icon name="plus" size={18} />Ajouter</button>
	</form>

	{#if received.length}
		<h2 class="section-label">Demandes reçues</h2>
		<div class="group mb-5">
			{#each received as f (f.id)}
				<div class="cell">
					<span class="avatar">{f.username.slice(0, 1).toUpperCase()}</span>
					<a class="flex-1 font-semibold text-inherit no-underline" href="/u/{f.username}">{f.username}</a>
					<form method="POST" action="?/accept" use:enhance><input type="hidden" name="id" value={f.id} /><button class="btn btn-sm" data-testid="accept-friend">Accepter</button></form>
					<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={f.id} /><button class="btn btn-plain btn-sm" aria-label="Refuser"><Icon name="x" size={18} /></button></form>
				</div>
			{/each}
		</div>
	{/if}

	<h2 class="section-label">Mes amis ({friends.length})</h2>
	<div class="group mb-5">
		{#each friends as f (f.id)}
			<div class="cell">
				<Avatar name={f.username} image={f.brief?.avatar} x={f.brief?.avatarX} y={f.brief?.avatarY} size={40} />
				<a class="flex-1 min-w-0 text-inherit no-underline friend-link" href="/u/{f.username}">
					<span class="block font-semibold truncate">{f.username}</span>
					<span class="footnote text-label-2 truncate block">{f.brief?.title ?? `Niveau ${levelOf(f.xp)}`}</span>
				</a>
				<span class="hidden sm:inline-flex"><ShowcaseStrip cards={f.brief?.showcase ?? []} size={26} /></span>
				<a class="icon-act" href="/messages/{f.username}" aria-label="Message"><Icon name="message" size={20} /></a>
				<a class="icon-act" href="/duels/new?vs={encodeURIComponent(f.username)}" aria-label="Défier"><Icon name="swords" size={20} /></a>
				<a class="icon-act" href="/trades/new?to={encodeURIComponent(f.username)}" aria-label="Échanger"><Icon name="repeat" size={20} /></a>
			</div>
		{:else}
			<p class="cell text-label-2">Pas encore d'amis. Ajoute quelqu'un avec son pseudo !</p>
		{/each}
	</div>

	{#if sent.length}
		<h2 class="section-label">Demandes envoyées</h2>
		<div class="group">
			{#each sent as f (f.id)}
				<div class="cell">
					<span class="flex-1">{f.username}</span>
					<form method="POST" action="?/remove" use:enhance><input type="hidden" name="id" value={f.id} /><button class="btn btn-plain btn-sm">Annuler</button></form>
				</div>
			{/each}
		</div>
	{/if}
{:else}
	<div class="group">
		{#each data.inbox as c (c.id)}
			<a class="cell text-inherit no-underline" href="/messages/{c.username}">
				<span class="avatar">{c.username.slice(0, 1).toUpperCase()}</span>
				<span class="flex-1 min-w-0">
					<span class="flex justify-between gap-2"><span class="font-semibold truncate">{c.username}</span><span class="footnote text-label-3 flex-none">{ago(c.created_at)}</span></span>
					<span class="block footnote text-label-2 truncate">{c.body}</span>
				</span>
				{#if c.unread}<span class="badge">{c.unread}</span>{/if}
			</a>
		{:else}
			<p class="cell text-label-2">Aucune conversation. Écris à un ami depuis sa fiche.</p>
		{/each}
	</div>
{/if}

<style>
	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 700;
		color: white;
		background: linear-gradient(135deg, var(--teal), var(--indigo));
		flex: none;
	}
	.friend-link {
		min-height: var(--tap);
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.icon-act {
		width: var(--tap);
		height: var(--tap);
		display: grid;
		place-items: center;
		color: var(--accent);
		border-radius: 999px;
	}
	.icon-act:active {
		background: var(--accent-soft);
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
