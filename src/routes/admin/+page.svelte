<script lang="ts">
	import { enhance } from '$app/forms';
	import { ago, fmt } from '#lib/format';
	let { data, form } = $props();
</script>

<svelte:head><title>Modération</title></svelte:head>

<h1 class="large-title mb-4">Modération</h1>
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if form?.done}<p class="alert alert-ok mb-3">C'est fait.</p>{/if}

<div class="stats mb-5">
	{#each [['Joueurs', data.stats.users], ['Bannis', data.stats.banned], ['Cartes', data.stats.cards], ['Paquets ouverts', data.stats.packs], ['Enchères en cours', data.stats.auctions], ['Duels joués', data.stats.duels]] as [l, v]}
		<div class="group p-3"><p class="title-2 tabular-nums">{fmt(Number(v))}</p><p class="footnote text-label-2">{l}</p></div>
	{/each}
</div>

<form method="GET" class="flex gap-2 mb-3">
	<input class="field flex-1" name="q" value={data.q} placeholder="Rechercher un joueur" />
	<button class="btn">Chercher</button>
</form>

<div class="group mb-6">
	{#each data.users as u (u.id)}
		<div class="cell flex-wrap">
			<a class="flex-1 min-w-[140px] text-inherit" href="/u/{u.username}">
				<span class="font-semibold">{u.username}</span>
				{#if u.role === 'admin'}<span class="footnote text-accent"> admin</span>{/if}
				{#if u.banned}<span class="footnote text-danger"> banni{u.ban_reason ? ` (${u.ban_reason})` : ''}</span>{/if}
				<span class="block footnote text-label-2">inscrit {ago(u.created_at)}, {fmt(u.kamas)} kamas</span>
			</a>
			{#if u.role !== 'admin'}
				{#if u.banned}
					<form method="POST" action="?/unban" use:enhance><input type="hidden" name="id" value={u.id} /><button class="btn btn-secondary btn-sm">Débannir</button></form>
				{:else}
					<form method="POST" action="?/ban" use:enhance class="flex gap-2">
						<input type="hidden" name="id" value={u.id} />
						<input class="field search w-36" name="reason" placeholder="Motif" />
						<button class="btn btn-danger btn-sm">Bannir</button>
					</form>
				{/if}
			{/if}
		</div>
	{/each}
</div>

<h2 class="section-label">Derniers messages privés</h2>
<div class="group">
	{#each data.messages as m (m.id)}
		<div class="cell">
			<span class="flex-1 min-w-0"><span class="footnote text-label-2">{m.sender} à {m.recipient}, {ago(m.created_at)}</span><span class="block">{m.body}</span></span>
			<form method="POST" action="?/deleteMessage" use:enhance><input type="hidden" name="id" value={m.id} /><button class="btn btn-plain btn-sm text-danger">Masquer</button></form>
		</div>
	{:else}<p class="cell text-label-2">Aucun message.</p>{/each}
</div>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
	}
	.text-inherit {
		color: inherit;
		text-decoration: none;
	}
</style>
