<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { ago, fmt } from '#lib/format';
	import PushToggle from '#lib/components/PushToggle.svelte';

	const REASONS: [string, string][] = [
		['sell:', 'Vente au jeu'], ['discard:', 'Vente au jeu'], ['sale:', 'Carte vendue aux enchères'], ['bid:', 'Enchère placée'],
		['refund:', 'Enchère remboursée'], ['trade:', 'Échange'], ['daily', 'Récompense du jour'], ['achievement:', 'Succès'],
		['recycle:', 'Recyclage'], ['craft:', 'Fabrication'], ['quest:', 'Quête'], ['chest:', 'Coffre de la semaine'], ['collection:', 'Collection complétée']
	];
	const isFragments = (r: string) => r.startsWith('recycle:') || r.startsWith('craft:');
	const reasonLabel = (r: string) => REASONS.find(([k]) => r.startsWith(k))?.[1] ?? 'Autre';

	let { data, form } = $props();
	const p = $derived(data.profile);
	let editing = $state(false);
</script>

<svelte:head><title>{p.username}</title></svelte:head>

<div class="head">
	<span class="avatar">{p.username.slice(0, 1).toUpperCase()}</span>
	<div class="min-w-0">
		<h1 class="large-title truncate">{p.username}</h1>
		{#if p.title}<p class="title-tag">{p.title}</p>{/if}
		<p class="text-label-2">
			Niveau {p.level}{#if p.guild}, guilde <a class="text-accent" href="/guilds/{p.guild_id}">{p.guild} [{p.tag}]</a>{/if}{#if p.role === 'admin'}, modérateur{/if}
		</p>
	</div>
</div>
{#if p.banned}<p class="alert alert-error mb-3">Ce compte est suspendu.</p>{/if}
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if form?.requested}<p class="alert alert-ok mb-3">Demande d'ami envoyée.</p>{/if}

{#if data.isMe && editing}
	<form method="POST" action="?/bio" use:enhance={() => async ({ update }) => { editing = false; await update(); }} class="flex gap-2 mb-4">
		<input class="field flex-1" name="bio" maxlength="160" value={p.bio ?? ''} placeholder="Une phrase sur toi" />
		<button class="btn">OK</button>
	</form>
{:else if p.bio || data.isMe}
	<p class="mb-4 {p.bio ? '' : 'text-label-3'}">
		{p.bio ?? 'Ajoute une phrase de présentation.'}
		{#if data.isMe}<button class="btn btn-plain btn-sm" onclick={() => (editing = true)}>Modifier</button>{/if}
	</p>
{/if}

{#if !data.isMe}
	<div class="flex flex-wrap gap-2 mb-5">
		{#if data.relation === 'none'}
			<form method="POST" action="?/friend" use:enhance><button class="btn btn-sm"><Icon name="plus" size={16} />Ajouter en ami</button></form>
		{:else if data.relation === 'sent'}
			<span class="btn btn-secondary btn-sm" aria-disabled="true">Demande envoyée</span>
		{:else if data.relation === 'received'}
			<form method="POST" action="?/friend" use:enhance><button class="btn btn-sm">Accepter sa demande</button></form>
		{:else}
			<a class="btn btn-secondary btn-sm" href="/messages/{p.username}"><Icon name="message" size={16} />Message</a>
			<a class="btn btn-secondary btn-sm" href="/duels/new?vs={encodeURIComponent(p.username)}"><Icon name="swords" size={16} />Défier</a>
		{/if}
		<a class="btn btn-secondary btn-sm" href="/trades/new?to={encodeURIComponent(p.username)}"><Icon name="repeat" size={16} />Échanger</a>
	</div>
{/if}

<div class="stats mb-5">
	<div class="stat"><span class="v">{fmt(data.stats.distinct)}</span><span class="l">cartes</span></div>
	<div class="stat"><span class="v">{fmt(data.stats.score)}</span><span class="l">score</span></div>
	<div class="stat"><span class="v">{data.stats.legendary}</span><span class="l">légendaires</span></div>
	<div class="stat"><span class="v">{data.stats.duelWins}</span><span class="l">victoires</span></div>
	<div class="stat"><span class="v">{data.stats.unlocked}/{data.stats.totalAchievements}</span><span class="l">succès</span></div>
	<div class="stat"><span class="v">{p.daily_streak}</span><span class="l">jours de série</span></div>
</div>

<h2 class="section-label">{data.favorites ? 'Vitrine (favoris)' : 'Meilleures cartes'}</h2>
<div class="showcase mb-5">
	{#each data.cards as c (c.id)}<a href="/card/{c.id}"><Card card={c} size="sm" /></a>{:else}<p class="text-label-2">Aucune carte pour l'instant.</p>{/each}
</div>

{#if data.isMe && data.ledger.length}
	<h2 class="section-label">Mouvements de kamas{data.soldTotal ? `, ${fmt(data.soldTotal)} gagnés en ventes au jeu` : ''}</h2>
	<div class="group mb-5" data-testid="ledger">
		{#each data.ledger as l, i (i)}
			<div class="cell">
				<span class="flex-1 min-w-0">{reasonLabel(l.reason)}<span class="block footnote text-label-2">{ago(l.created_at)}</span></span>
				<span class="font-semibold tabular-nums {l.delta > 0 ? 'text-success' : 'text-danger'}">{l.delta > 0 ? '+' : ''}{fmt(l.delta)}{isFragments(l.reason) ? ' fr.' : ''}</span>
			</div>
		{/each}
	</div>
{/if}

{#if data.isMe}
	<div class="mb-3"><PushToggle /></div>
	<div class="group">
		<a class="cell text-inherit no-underline" href="/achievements"><Icon name="award" class="text-accent" /><span class="flex-1">Mes succès</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		<a class="cell text-inherit no-underline" href="/leaderboard"><Icon name="trophy" class="text-warning" /><span class="flex-1">Classement</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		<a class="cell text-inherit no-underline" href="/mentions"><Icon name="info" class="text-label-2" /><span class="flex-1">Mentions et règles</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		<form method="POST" action="/logout" class="contents">
			<button class="cell w-full text-left text-danger bg-transparent border-0 cursor-pointer"><Icon name="logout" /><span class="flex-1">Se déconnecter</span></button>
		</form>
	</div>
{/if}

<style>
	.title-tag {
		display: inline-block;
		margin: 2px 0 0;
		font-size: 13px;
		font-weight: 700;
		color: #8a5a00;
		background: linear-gradient(90deg, #fff1b8, #ffd76a);
		border-radius: 999px;
		padding: 2px 10px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 12px;
	}
	.avatar {
		width: 64px;
		height: 64px;
		flex: none;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-size: 28px;
		font-weight: 800;
		color: white;
		background: linear-gradient(135deg, #5ac8fa, #007aff);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		row-gap: 12px;
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 12px 4px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.v {
		font-weight: 800;
		font-size: 18px;
		font-variant-numeric: tabular-nums;
	}
	.l {
		font-size: 11px;
		color: var(--label-2);
	}
	.showcase {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	@media (min-width: 768px) {
		.showcase {
			grid-template-columns: repeat(6, 1fr);
		}
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
