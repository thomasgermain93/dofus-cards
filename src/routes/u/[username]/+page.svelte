<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '#lib/components/Card.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import PushToggle from '#lib/components/PushToggle.svelte';
	import { ago, fmt } from '#lib/format';
	import { tilt } from '#lib/holo';

	let { data, form } = $props();
	const p = $derived(data.profile);
	let editing = $state(false);
	let showReport = $state(false);
	let tab = $state(0);

	const REASONS: [string, string][] = [
		['sell:', 'Vente au jeu'], ['discard:', 'Vente au jeu'], ['sale:', 'Carte vendue aux enchères'], ['bid:', 'Enchère placée'],
		['refund:', 'Enchère remboursée'], ['trade:', 'Échange'], ['daily', 'Récompense du jour'], ['achievement:', 'Succès'],
		['recycle:', 'Recyclage'], ['craft:', 'Fabrication'], ['quest:', 'Quête'], ['chest:', 'Coffre de la semaine'], ['collection:', 'Collection complétée'],
		['battle:', 'Bataille de groupe']
	];
	const reasonLabel = (r: string) => REASONS.find(([k]) => r.startsWith(k))?.[1] ?? 'Autre';
	const isFragments = (r: string) => r.startsWith('recycle:') || r.startsWith('craft:');
	const since = $derived(new Date(p.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }));
	const current = $derived(!data.hidden && data.showcases.length ? data.showcases[Math.min(tab, data.showcases.length - 1)] : null);
</script>

<svelte:head><title>{p.username}</title></svelte:head>

<section class="hero">
	<Avatar name={p.username} image={p.avatar} x={p.avatar_x} y={p.avatar_y} size={84} />
	<div class="min-w-0 flex-1">
		<h1 class="large-title truncate" title={p.username}>{p.username}</h1>
		{#if p.title}<p class="title-tag">{p.title}</p>{/if}
		<p class="text-label-2 footnote mt-1">
			Niveau {p.level}, depuis {since}{#if p.guild}, guilde <a class="text-accent" href="/guilds/{p.guild_id}">{p.guild} [{p.tag}]</a>{/if}{#if p.role === 'admin'}, modérateur{/if}
		</p>
	</div>
	{#if data.isMe}<a class="btn btn-secondary btn-sm self-start" href="/profile/edit" data-testid="edit-profile"><Icon name="sparkles" size={16} />Personnaliser</a>{/if}
</section>

{#if p.banned}<p class="alert alert-error mb-3">Ce compte est suspendu.</p>{/if}
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if form?.requested}<p class="alert alert-ok mb-3">Demande d'ami envoyée.</p>{/if}
{#if form?.reported}<p class="alert alert-ok mb-3">Signalement envoyé à la modération. Merci.</p>{/if}
{#if form && 'blocked' in form}<p class="alert alert-ok mb-3">{form.blocked ? 'Joueur bloqué : il ne peut plus te contacter.' : 'Joueur débloqué.'}</p>{/if}

{#if !data.isMe}
	<div class="flex flex-wrap gap-2 mb-5">
		{#if !data.iBlocked}
			{#if data.relation === 'none'}
				<form method="POST" action="?/friend" use:enhance><button class="btn btn-sm"><Icon name="plus" size={16} />Ajouter en ami</button></form>
			{:else if data.relation === 'sent'}
				<span class="btn btn-secondary btn-sm" aria-disabled="true">Demande envoyée</span>
			{:else if data.relation === 'received'}
				<form method="POST" action="?/friend" use:enhance><button class="btn btn-sm">Accepter sa demande</button></form>
			{:else}
				<a class="btn btn-sm" href="/duels/new?vs={encodeURIComponent(p.username)}" data-testid="defy"><Icon name="swords" size={16} />Défier</a>
				<a class="btn btn-secondary btn-sm" href="/messages/{p.username}"><Icon name="message" size={16} />Message</a>
			{/if}
			<a class="btn btn-secondary btn-sm" href="/trades/new?to={encodeURIComponent(p.username)}"><Icon name="repeat" size={16} />Échanger</a>
		{/if}
		<form method="POST" action="?/block" use:enhance><button class="btn btn-plain btn-sm">{data.iBlocked ? 'Débloquer' : 'Bloquer'}</button></form>
		<button class="btn btn-plain btn-sm text-danger" onclick={() => (showReport = !showReport)}>Signaler</button>
	</div>
	{#if showReport}
		<form method="POST" action="?/report" use:enhance={() => async ({ update }) => { showReport = false; await update(); }} class="group p-4 mb-5 flex flex-col gap-3">
			<p class="headline">Signaler {p.username}</p>
			<select class="field" name="reason">{#each data.reasons as r}<option>{r}</option>{/each}</select>
			<textarea class="field" name="details" rows="3" maxlength="500" placeholder="Détails (facultatif)"></textarea>
			<button class="btn btn-danger">Envoyer le signalement</button>
		</form>
	{/if}
{/if}

{#if data.hidden}
	<div class="group p-6 text-center">
		<Icon name="shield" size={32} class="text-label-3" />
		<p class="headline mt-2">Ce profil est privé</p>
		<p class="footnote text-label-2">Seuls ses amis peuvent voir sa vitrine et ses statistiques.</p>
	</div>
{:else}
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

	{#if data.badges.length}
		<div class="badges mb-5" data-testid="badges">
			{#each data.badges as b, i (i)}
				<span class="badge-chip {b.kind}"><Icon name={b.kind === 'collection' ? 'album' : b.kind === 'tag' ? 'star' : 'award'} size={13} />{b.label}</span>
			{/each}
		</div>
	{/if}

	<!-- Vitrine -->
	<section class="vitrine mb-5" data-testid="showcase">
		<div class="vhead">
			<h2 class="title-2 flex items-center gap-2"><Icon name="trophy" size={22} class="text-warning" />Vitrine</h2>
			{#if data.showcases.length > 1}
				<div class="segmented vtabs">
					{#each data.showcases as s, i (s.id)}<button type="button" aria-pressed={i === tab} onclick={() => (tab = i)}>{s.name}</button>{/each}
				</div>
			{/if}
		</div>
		{#if current}
			{#if data.showcases.length === 1}<p class="footnote text-label-2 mb-3">{current.name}</p>{/if}
			<div class="vgrid">
				{#each current.cards as c, i (c.id)}
					<a href="/card/{c.id}" class="vcard" style="--i:{i}" use:tilt><Card card={c} size="md" foil={c.foil} /></a>
				{/each}
				{#each Array(Math.max(0, 6 - current.cards.length)) as _, i (i)}<span class="vslot"></span>{/each}
			</div>
		{:else if data.best.length}
			<p class="footnote text-label-2 mb-3">{data.isMe ? 'Aucune vitrine pour l’instant : voici tes meilleures cartes.' : 'Meilleures cartes'}</p>
			<div class="vgrid">{#each data.best as c (c.id)}<a href="/card/{c.id}" class="vcard"><Card card={c} size="md" /></a>{/each}</div>
		{:else}
			<p class="text-label-2">Aucune carte pour l'instant.</p>
		{/if}
		{#if data.isMe}<a class="btn btn-secondary btn-sm mt-4" href="/profile/edit#vitrines">Composer mes vitrines</a>{/if}
	</section>

	<div class="stats mb-5">
		<div class="stat"><span class="v">{fmt(data.stats.distinct)}</span><span class="l">cartes</span></div>
		<div class="stat"><span class="v">{fmt(data.stats.score)}</span><span class="l">score</span></div>
		<div class="stat"><span class="v">{data.stats.legendary}</span><span class="l">légendaires</span></div>
		<div class="stat"><span class="v">{data.stats.shinies}</span><span class="l">brillantes</span></div>
		<div class="stat"><span class="v">{data.stats.duelWins}</span><span class="l">victoires</span></div>
		<div class="stat"><span class="v">{data.stats.collections}</span><span class="l">collections</span></div>
		<div class="stat"><span class="v">{data.stats.unlocked}/{data.stats.totalAchievements}</span><span class="l">succès</span></div>
		<div class="stat"><span class="v">{p.daily_streak}</span><span class="l">jours de série</span></div>
		<div class="stat"><span class="v">{p.streak_best}</span><span class="l">record de série</span></div>
	</div>

	{#if data.duels.length}
		<h2 class="section-label">Derniers duels</h2>
		<div class="group mb-5">
			{#each data.duels as d (d.id)}
				<a class="cell text-inherit no-underline" href="/duels/{d.id}">
					<span class="flex-1">{d.challenger} contre {d.vs_bot ? 'l’ordinateur' : d.opponent}</span>
					<span class="footnote {d.result === 'draw' ? 'text-label-2' : d.winner_id === p.id ? 'text-success' : 'text-danger'}">{d.result === 'draw' ? 'Nul' : d.winner_id === p.id ? 'Victoire' : 'Défaite'}</span>
				</a>
			{/each}
		</div>
	{/if}

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
{/if}

{#if data.isMe}
	<div class="mb-3"><PushToggle /></div>
	<div class="group">
		<form method="POST" action="?/privacy" use:enhance class="cell">
			<Icon name="shield" class="text-label-2" />
			<span class="flex-1">Profil {p.is_private ? 'privé (amis seulement)' : 'visible de tous'}</span>
			<input type="hidden" name="private" value={p.is_private ? '0' : '1'} />
			<button class="btn btn-secondary btn-sm" data-testid="privacy">{p.is_private ? 'Rendre public' : 'Rendre privé'}</button>
		</form>
		<a class="cell text-inherit no-underline" href="/wishlist"><Icon name="star" class="text-warning" /><span class="flex-1">Ma liste de souhaits</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		<a class="cell text-inherit no-underline" href="/achievements"><Icon name="award" class="text-accent" /><span class="flex-1">Mes succès</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		<a class="cell text-inherit no-underline" href="/mentions"><Icon name="info" class="text-label-2" /><span class="flex-1">Mentions et règles</span><Icon name="chevron-right" size={16} class="text-label-3" /></a>
		<form method="POST" action="/logout" class="contents">
			<button class="cell w-full text-left text-danger bg-transparent border-0 cursor-pointer"><Icon name="logout" /><span class="flex-1">Se déconnecter</span></button>
		</form>
	</div>
{/if}

<style>
	.hero {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}
	.title-tag {
		display: inline-block;
		margin: 2px 0 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--title-ink);
		background: var(--title-bg);
		border-radius: 999px;
		padding: 2px 10px;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.badge-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12.5px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--surface);
		border: 0.5px solid var(--separator);
	}
	.badge-chip.collection {
		background: linear-gradient(90deg, color-mix(in srgb, var(--green) 14%, var(--surface)), var(--surface));
	}
	.badge-chip.achievement {
		background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 18%, var(--surface)), var(--surface));
	}
	.vitrine {
		border-radius: 24px;
		padding: 18px;
		background:
			radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--gold) 16%, transparent), transparent 60%),
			var(--showcase-bg);
		color: white;
		box-shadow: var(--shadow-card);
	}
	.vhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.vtabs {
		background: rgba(255, 255, 255, 0.12);
	}
	.vtabs button {
		border: 0;
		background: transparent;
		color: white;
		cursor: pointer;
	}
	.vtabs button[aria-pressed='true'] {
		background: rgba(255, 255, 255, 0.22);
		box-shadow: none;
	}
	.vitrine .footnote {
		color: rgba(255, 255, 255, 0.65);
	}
	.vgrid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	@media (min-width: 900px) {
		.vgrid {
			grid-template-columns: repeat(6, 1fr);
		}
	}
	.vcard {
		display: block;
		animation: rise 0.5s calc(var(--i, 0) * 70ms) var(--ease-ios) both;
		filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.45));
	}
	.vslot {
		aspect-ratio: 5 / 7;
		border-radius: 14px;
		border: 1.5px dashed rgba(255, 255, 255, 0.2);
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
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
	@keyframes rise {
		from {
			transform: translateY(16px);
			opacity: 0;
		}
	}
</style>
