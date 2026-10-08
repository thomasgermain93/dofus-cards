<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { ago, fmt } from '#lib/format';
	import { levelOf } from '#lib/level';
	import Avatar from '#lib/components/Avatar.svelte';
	import ShowcaseStrip from '#lib/components/ShowcaseStrip.svelte';

	let { data, form } = $props();
	const me = $derived(page.data.me);
	const g = $derived(data.guild);
	const isLeader = $derived(g.leader_id === me?.id);
	let body = $state('');
</script>

<svelte:head><title>{g.name}</title></svelte:head>

<a href="/guilds?all" class="back"><Icon name="chevron-left" size={20} />Guildes</a>

<div class="flex items-center gap-3 mb-1">
	<span class="tag">{g.tag}</span>
	<h1 class="large-title truncate">{g.name}</h1>
</div>
<p class="text-label-2 mb-4">{data.members.length} membre{data.members.length > 1 ? 's' : ''}, chef : {g.leader}</p>
{#if g.description}<p class="mb-4">{g.description}</p>{/if}
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

{#if !data.isMember && data.canJoin}
	<form method="POST" action="?/join" use:enhance class="mb-5"><button class="btn btn-block">Rejoindre la guilde</button></form>
{/if}

<div class="cols">
	{#if data.isMember}
		<section>
			<h2 class="section-label">Discussion de guilde</h2>
			<div class="group p-3 chat">
				{#each data.chat as m (m.id)}
					<div class="msg" class:mine={m.username === me?.username}>
						<span class="footnote font-semibold">{m.username} <span class="text-label-3 font-normal">{ago(m.created_at)}</span></span>
						<p>{m.body}</p>
					</div>
				{:else}
					<p class="text-label-2 text-center py-6">Lance la discussion !</p>
				{/each}
			</div>
			<form method="POST" action="?/post" use:enhance={() => async ({ update }) => { body = ''; await update(); }} class="flex gap-2 mt-2">
				<input class="field flex-1" name="body" placeholder="Écrire à la guilde" maxlength="500" bind:value={body} autocomplete="off" required />
				<button class="btn" aria-label="Envoyer"><Icon name="send" size={18} /></button>
			</form>
		</section>
	{/if}

	<section>
		<h2 class="section-label">Membres (points de la semaine)</h2>
		<div class="group">
			{#each data.members as m (m.id)}
				<div class="cell">
					{#if m.id === g.leader_id}<Icon name="crown" size={18} class="text-warning" />{:else}<span class="w-[18px]"></span>{/if}
					<Avatar name={m.username} image={m.brief?.avatar} x={m.brief?.avatarX} y={m.brief?.avatarY} size={30} />
					<a class="flex-1 min-w-0 text-inherit no-underline" href="/u/{m.username}"><span class="font-semibold">{m.username}</span> <span class="footnote text-label-2">niv. {levelOf(m.xp)}</span></a>
					<ShowcaseStrip cards={m.brief?.showcase ?? []} size={22} />
					<span class="footnote font-semibold tabular-nums">{fmt(m.week)} pts</span>
					{#if isLeader && m.id !== me?.id}
						<form method="POST" action="?/promote" use:enhance><input type="hidden" name="id" value={m.id} /><button class="btn btn-plain btn-sm" title="Nommer chef"><Icon name="crown" size={16} /></button></form>
						<form method="POST" action="?/kick" use:enhance><input type="hidden" name="id" value={m.id} /><button class="btn btn-plain btn-sm text-danger" title="Exclure"><Icon name="x" size={16} /></button></form>
					{/if}
				</div>
			{/each}
		</div>
		{#if data.isMember}
			<form method="POST" action="?/leave" use:enhance class="mt-4"><button class="btn btn-danger btn-sm">Quitter la guilde</button></form>
		{/if}
	</section>
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		color: var(--accent);
		text-decoration: none;
		margin: 0 0 8px -6px;
		font-size: 17px;
	}
	.tag {
		font-size: 14px;
		font-weight: 800;
		padding: 4px 10px;
		border-radius: 10px;
		background: var(--accent-soft);
		color: var(--accent);
		flex: none;
	}
	.cols {
		display: grid;
		gap: 20px;
	}
	@media (min-width: 900px) {
		.cols {
			grid-template-columns: 1.3fr 1fr;
			align-items: start;
		}
	}
	.chat {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 420px;
		overflow-y: auto;
	}
	.msg p {
		margin: 2px 0 0;
		background: var(--surface-2);
		border-radius: 14px;
		padding: 7px 11px;
		display: inline-block;
		word-break: break-word;
	}
	.msg.mine p {
		background: var(--accent-soft);
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
