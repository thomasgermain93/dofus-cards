<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { ago } from '#lib/format';

	let { data, form } = $props();
	let body = $state('');
	let list: HTMLDivElement;

	async function scroll() {
		await tick();
		list?.scrollTo({ top: list.scrollHeight });
	}
	onMount(() => {
		scroll();
		const t = setInterval(() => invalidateAll().then(scroll), 8000);
		return () => clearInterval(t);
	});
</script>

<svelte:head><title>Messages avec {data.other.username}</title></svelte:head>

<a href="/social?tab=messages" class="back-link"><Icon name="chevron-left" size={20} />Messages</a>
<h1 class="title-2 mb-3"><a class="text-inherit" href="/u/{data.other.username}">{data.other.username}</a></h1>

<div class="chat" bind:this={list}>
	{#each data.messages as m (m.id)}
		<div class="bubble" class:mine={m.from_id !== data.other.id}>
			<p>{m.body}</p>
			<span>{ago(m.created_at)}</span>
		</div>
	{:else}
		<p class="text-label-2 text-center py-8">Dis bonjour !</p>
	{/each}
</div>

{#if form?.error}<p class="alert alert-error my-2">{form.error}</p>{/if}
{#if data.friends}
	<form method="POST" class="composer material" use:enhance={() => async ({ update }) => { body = ''; await update(); scroll(); }}>
		<input class="field flex-1" name="body" placeholder="Message" maxlength="500" bind:value={body} autocomplete="off" required />
		<button class="btn" aria-label="Envoyer" disabled={!body.trim()}><Icon name="send" size={18} /></button>
	</form>
{:else}
	<p class="footnote text-label-2 text-center mt-3">Vous devez être amis pour vous écrire.</p>
{/if}

<style>
	.text-inherit {
		color: inherit;
		text-decoration: none;
	}
	.chat {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: calc(100dvh - 300px);
		min-height: 240px;
		overflow-y: auto;
		padding: 4px 0;
	}
	.bubble {
		max-width: 78%;
		align-self: flex-start;
		background: var(--surface);
		border-radius: 18px 18px 18px 6px;
		padding: 8px 12px;
	}
	.bubble.mine {
		align-self: flex-end;
		background: var(--accent-fill);
		color: white;
		border-radius: 18px 18px 6px 18px;
	}
	.bubble p {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.bubble span {
		font-size: 11px;
		opacity: 0.6;
	}
	.composer {
		position: sticky;
		bottom: calc(64px + env(safe-area-inset-bottom));
		display: flex;
		gap: 8px;
		padding: 10px 16px;
		margin: 8px -16px 0;
	}
	@media (min-width: 1024px) {
		.composer {
			bottom: 0;
		}
	}
</style>
