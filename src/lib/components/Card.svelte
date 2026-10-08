<script lang="ts" module>
	/** Libellé de type affiché dans le bandeau (façon TCG Dofus 2005). */
	export function typeLabel(c: { category: string; subtype: string }) {
		if (c.category === 'monster') return c.subtype === 'Boss' ? 'BOSS' : c.subtype === 'Archimonstre' ? 'ARCHIMONSTRE' : 'MONSTRE';
		if (c.category === 'item') return c.subtype === 'Dofus' || c.subtype === 'Prysmaradite' ? 'DOFUS' : 'OBJET';
		if (c.category === 'mount') return 'MONTURE';
		return 'CLASSE';
	}
	const nf = new Intl.NumberFormat('fr-FR');
	const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k` : String(n));
</script>

<script lang="ts">
	import { RARITY, rarityColor } from '#lib/rarity';
	import { imgUrl } from '#lib/format';
	import type { CardView } from '#lib/types';
	import Icon from './Icon.svelte';

	let {
		card,
		size = 'md',
		missing = false,
		count = 0,
		favorite = false,
		holo = true,
		foil = false,
		quiz = false
	}: {
		card: CardView;
		size?: 'sm' | 'md' | 'lg';
		missing?: boolean;
		count?: number;
		favorite?: boolean;
		/** reflet holographique (Rare et au-dessus) */
		holo?: boolean;
		/** version brillante (rare) : reflet renforcé et liseré doré, quelle que soit la rareté */
		foil?: boolean;
		/** pendant un quiz : niveau et infos masqués (la réponse ne doit pas se lire sur la carte) */
		quiz?: boolean;
	} = $props();

	const r = $derived(RARITY[card.rarity]);
	const src = $derived(imgUrl(card.image));
	const shiny = $derived(!missing && (foil || (holo && card.rarity >= 2)));
	const subtitle = $derived(card.category === 'class' ? card.info1 : card.subtype);
	// Les descriptions DofusDB sont parfois déjà entre guillemets : on évite « "…" »
	const flavor = $derived(card.flavor?.replace(/^[\s"«“]+|[\s"»”]+$/g, '') || null);
</script>

<article
	class="card size-{size} r{card.rarity}"
	class:missing
	class:shiny
	class:legendary={card.rarity === 5 && !missing}
	class:foil={foil && !missing}
	style="--rc: {rarityColor(card.rarity)}"
	aria-label="{missing ? 'Carte manquante' : card.name}, {r.name}"
>
	<div class="shell">
	<div class="frame">
		<header>
			<div class="titles">
				<span class="type">{typeLabel(card)}</span>
				<h3 title={missing ? undefined : card.name}>{missing ? '???' : card.name}</h3>
			</div>
			{#if foil && !missing}<span class="foil-tag" title="Carte brillante"><Icon name="sparkles" size={12} fill /></span>{/if}
			<span class="gem" title={r.name}><span>{r.code}</span></span>
		</header>

		<div class="art">
			{#if src}
				<img {src} alt="" loading="lazy" decoding="async" draggable="false" />
			{:else}
				<Icon name="sparkles" size={40} />
			{/if}
			{#if shiny}<span class="holo" aria-hidden="true"></span>{/if}
			{#if favorite}<span class="fav"><Icon name="star" size={12} fill /></span>{/if}
			{#if count > 1}<span class="count">x{count}</span>{/if}
			<span class="heart" title="Défense">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.6 3 5 6.5 5c2 0 3.5 1.1 4.5 2.6C12 6.1 13.5 5 15.5 5 19 5 21.1 8.6 19.6 11.8 17.5 16.4 12 21 12 21z" /></svg>
				<span class="hv full">{missing ? '?' : nf.format(card.defense)}</span><span class="hv short">{missing ? '?' : compact(card.defense)}</span>
			</span>
		</div>

		<div class="quote">
			{#if missing}
				<p>Carte encore inconnue.</p>
			{:else if quiz}
				<p>Réponds vite !</p>
			{:else if flavor}
				<p>« {flavor} »</p>
			{:else}
				<p>{subtitle}</p>
			{/if}
		</div>
		<p class="sub">{quiz ? typeLabel(card).toLowerCase() : `${subtitle}${card.category !== 'class' ? `, niv. ${card.level}` : ''}`}</p>
	</div>

	<footer>
		<span class="token atk" title="Attaque"><Icon name="sword" size={10} stroke={2.6} /><b class="full">{missing ? '?' : nf.format(card.attack)}</b><b class="short">{missing ? '?' : compact(card.attack)}</b></span>
		<span class="token lvl" title="Niveau"><small>NIV</small><b>{card.category === 'class' || quiz ? '?' : card.level}</b></span>
		<span class="token rar" title={r.name}><b>{r.code}</b></span>
	</footer>
	</div>
</article>

<style>
	/* Toutes les tailles sont relatives à la largeur de la carte (cqw) : même rendu en petit et en grand. */
	.card {
		--ink: var(--card-ink);
		--parch: var(--card-parch);
		--parch-2: var(--card-parch-2);
		--edge: var(--card-edge);
		container-type: inline-size;
		position: relative;
		width: 100%;
		aspect-ratio: 5 / 7;
		user-select: none;
		touch-action: manipulation;
		text-align: left;
		color: var(--ink);
		font-family: var(--font-sans);
	}
	/* Les unités cqw ci-dessous se rapportent à .card (le conteneur) */
	.shell {
		position: absolute;
		inset: 0;
		border-radius: 5.5cqw;
		padding: 2.6cqw 2.6cqw 0;
		background: var(--edge);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.15),
			0 6px 18px rgba(0, 0, 0, 0.12);
		display: flex;
		flex-direction: column;
	}
	.frame {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 2cqw;
		padding: 3cqw 3cqw 2.4cqw;
		border-radius: 3.8cqw;
		/* Parchemin crème avec volutes discrètes (motif SVG maison) */
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23b8986a' stroke-opacity='.22' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M10 60c0-14 12-22 22-16s6 22-6 20-8-14 0-12'/%3E%3Cpath d='M70 20c10-10 28-6 30 8s-14 18-20 10 4-14 10-8'/%3E%3Cpath d='M60 100c12 6 28 0 30-12s-12-16-16-8 6 12 12 6'/%3E%3Cpath d='M0 30c10 2 18-4 20-12M120 90c-10-2-18 4-20 12'/%3E%3C/g%3E%3C/svg%3E") 0 0 / 46cqw 46cqw,
			radial-gradient(ellipse at 50% 40%, var(--parch-2), var(--parch) 70%);
		box-shadow:
			inset 0 0 0 0.9cqw color-mix(in srgb, var(--rc) 75%, #6b4f2a),
			inset 0 0 0 1.6cqw rgba(255, 255, 255, 0.55),
			inset 0 0 6cqw rgba(140, 100, 50, 0.18);
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 2cqw;
		padding: 0.6cqw 1cqw 0;
	}
	.titles {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.type {
		font-size: 4.3cqw;
		line-height: 1.1;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--card-ink-2);
	}
	h3 {
		margin: 0;
		font-size: 7.6cqw;
		line-height: 1.12;
		font-weight: 800;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--ink);
	}
	.gem {
		flex: none;
		width: 9cqw;
		height: 9cqw;
		margin-top: 1cqw;
		transform: rotate(45deg);
		border-radius: 1.8cqw;
		background: linear-gradient(135deg, color-mix(in srgb, var(--rc) 55%, white), var(--rc) 55%, color-mix(in srgb, var(--rc) 70%, black));
		box-shadow:
			0 0 0 0.6cqw rgba(0, 0, 0, 0.35),
			inset 0 0.6cqw 0.8cqw rgba(255, 255, 255, 0.6);
		display: grid;
		place-items: center;
	}
	.gem span {
		transform: rotate(-45deg);
		font-size: 3.2cqw;
		font-weight: 900;
		color: white;
		text-shadow: 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.45);
	}
	.art {
		position: relative;
		flex: 1;
		min-height: 0;
		border-radius: 2.8cqw;
		background: radial-gradient(circle at 50% 42%, #ffffff, color-mix(in srgb, var(--rc) 14%, #f7f1e2) 75%);
		box-shadow:
			inset 0 0 0 0.6cqw rgba(110, 80, 40, 0.28),
			inset 0 -3cqw 6cqw rgba(110, 80, 40, 0.08);
		display: grid;
		place-items: center;
		overflow: hidden;
		color: var(--rc);
	}
	.art img {
		width: 80%;
		height: 80%;
		object-fit: contain;
		filter: drop-shadow(0 2cqw 2cqw rgba(60, 40, 20, 0.25));
		transform: translateZ(0);
	}
	.heart {
		position: absolute;
		right: 1.6cqw;
		bottom: 1.6cqw;
		min-width: 15cqw;
		height: 11cqw;
		padding: 0 2.6cqw 0 1.4cqw;
		border-radius: 999px;
		background: white;
		box-shadow:
			0 0 0 0.7cqw var(--card-heart),
			0 1cqw 2cqw rgba(0, 0, 0, 0.18);
		display: inline-flex;
		align-items: center;
		gap: 0.8cqw;
		color: var(--card-heart);
		font-weight: 900;
		font-size: 5.2cqw;
		font-variant-numeric: tabular-nums;
	}
	.heart svg {
		width: 5.4cqw;
		height: 5.4cqw;
		fill: var(--card-heart);
	}
	.fav {
		position: absolute;
		left: 2cqw;
		top: 2cqw;
		color: var(--r-legendary);
		filter: drop-shadow(0 0.4cqw 0.6cqw rgba(0, 0, 0, 0.3));
	}
	.count {
		position: absolute;
		left: 2cqw;
		bottom: 2cqw;
		font-size: 4.6cqw;
		font-weight: 800;
		color: white;
		background: rgba(42, 31, 20, 0.82);
		border-radius: 999px;
		padding: 0.4cqw 2.4cqw;
	}
	.quote {
		flex: none;
		min-height: 15cqw;
		display: grid;
		place-items: center;
		border-radius: 2.4cqw;
		padding: 1.6cqw 3cqw;
		background: rgba(255, 252, 242, 0.85);
		box-shadow: inset 0 0 0 0.5cqw rgba(150, 115, 65, 0.45);
	}
	.quote p {
		margin: 0;
		font-size: 4.2cqw;
		line-height: 1.3;
		font-style: italic;
		text-align: center;
		color: var(--card-ink);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.sub {
		margin: 0;
		font-size: 3.6cqw;
		text-align: center;
		color: var(--card-ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	footer {
		flex: none;
		height: 15cqw;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5cqw;
	}
	.token {
		height: 11cqw;
		min-width: 11cqw;
		padding: 0 2.2cqw;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.8cqw;
		font-size: 4.4cqw;
		font-variant-numeric: tabular-nums;
		color: var(--card-ink);
		box-shadow:
			inset 0 0 0 0.7cqw rgba(0, 0, 0, 0.25),
			inset 0 1.2cqw 1.6cqw rgba(255, 255, 255, 0.55);
	}
	.token :global(svg) {
		width: 3.8cqw;
		height: 3.8cqw;
	}
	.token small {
		font-size: 2.8cqw;
		font-weight: 800;
		opacity: 0.75;
	}
	.atk {
		background: var(--card-token-atk);
	}
	.lvl {
		background: var(--card-token-lvl);
	}
	.rar {
		color: white;
		background: radial-gradient(circle at 40% 30%, color-mix(in srgb, var(--rc) 40%, white), var(--rc) 60%, color-mix(in srgb, var(--rc) 65%, black));
		text-shadow: 0 0.3cqw 0.6cqw rgba(0, 0, 0, 0.4);
	}
	.short {
		display: none;
	}

	/* Grandes cartes : le nom peut tenir sur 2 lignes */
	@container (min-width: 260px) {
		h3 {
			white-space: normal;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
		}
	}
	/* Petites cartes (grille de l'album) : on simplifie */
	@container (max-width: 170px) {
		.quote,
		.sub {
			display: none;
		}
		.full {
			display: none;
		}
		.short {
			display: inline;
		}
		h3 {
			font-size: 8.6cqw;
		}
		.type {
			font-size: 5cqw;
		}
		.heart {
			font-size: 6.6cqw;
			height: 13cqw;
		}
		.token {
			height: 13cqw;
			font-size: 5.6cqw;
		}
		.lvl small {
			display: none;
		}
		footer {
			height: 17cqw;
			gap: 3cqw;
		}
	}

	/* Carte manquante : silhouette */
	.missing .frame {
		filter: grayscale(1);
		opacity: 0.7;
	}
	.missing .art img {
		filter: brightness(0) opacity(0.22);
	}
	.missing footer {
		opacity: 0.5;
	}

	/* Reflet holographique (Rare et plus) : suit la souris ou l'inclinaison (variables --mx / --my) */
	.holo {
		position: absolute;
		inset: 0;
		pointer-events: none;
		mix-blend-mode: color-dodge;
		opacity: calc(var(--holo-o, 0.35) * var(--holo-k, 1));
		background:
			radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255, 255, 255, 0.55), transparent 45%),
			linear-gradient(
				115deg,
				transparent 20%,
				hsl(330 90% 70% / 0.55) 36%,
				hsl(50 95% 65% / 0.55) 44%,
				hsl(150 80% 60% / 0.5) 52%,
				hsl(210 90% 65% / 0.55) 60%,
				transparent 76%
			);
		background-size:
			100% 100%,
			250% 250%;
		background-position:
			0 0,
			var(--mx, 50%) var(--my, 50%);
		transition: opacity var(--dur);
	}
	.r2 .holo {
		--holo-o: 0.22;
	}
	.r3 .holo {
		--holo-o: 0.32;
	}
	.r4 .holo,
	.r5 .holo {
		--holo-o: 0.45;
	}
	.shiny.r4,
	.shiny.r5 {
		--edge: #241b10;
	}
	.legendary .shell {
		background: var(--legendary-ring);
		animation: spin 7s linear infinite;
		box-shadow:
			0 0 0 1px rgba(224, 168, 0, 0.5),
			0 8px 28px rgba(224, 168, 0, 0.35);
	}
	/* Brillante : reflet arc-en-ciel fort et liseré doré */
	.foil .holo {
		--holo-o: 0.75 !important;
		animation: foilshift 5s linear infinite;
	}
	.foil .frame {
		box-shadow:
			inset 0 0 0 0.9cqw var(--foil-line),
			inset 0 0 0 1.6cqw rgba(255, 245, 200, 0.8),
			inset 0 0 6cqw rgba(224, 180, 0, 0.35);
	}
	.foil .shell {
		box-shadow:
			0 0 0 0.5cqw var(--foil-light),
			0 6px 22px rgba(224, 180, 0, 0.35);
	}
	.foil-tag {
		flex: none;
		width: 8cqw;
		height: 8cqw;
		margin-top: 1.4cqw;
		border-radius: 999px;
		display: grid;
		place-items: center;
		color: var(--foil-ink);
		background: radial-gradient(circle, var(--foil-pale), var(--foil-light));
	}
	.foil-tag :global(svg) {
		width: 5cqw;
		height: 5cqw;
	}
	@keyframes foilshift {
		from {
			filter: hue-rotate(0deg);
		}
		to {
			filter: hue-rotate(360deg);
		}
	}
	@property --angle {
		syntax: '<angle>';
		initial-value: 0deg;
		inherits: false;
	}
	@keyframes spin {
		to {
			--angle: 360deg;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.legendary .shell {
			animation: none;
		}
	}
</style>
