<script lang="ts">
	import { RARITY, rarityColor } from '#lib/rarity';
	import { fmt, imgUrl } from '#lib/format';
	import type { CardView } from '#lib/types';
	import Icon from './Icon.svelte';

	let {
		card,
		size = 'md',
		missing = false,
		count = 0,
		favorite = false
	}: {
		card: CardView;
		size?: 'sm' | 'md' | 'lg';
		missing?: boolean;
		count?: number;
		favorite?: boolean;
	} = $props();

	const r = $derived(RARITY[card.rarity]);
	const src = $derived(imgUrl(card.image));
</script>

<article
	class="card size-{size}"
	class:missing
	class:shiny={card.rarity >= 4 && !missing}
	class:legendary={card.rarity === 5 && !missing}
	style="--rc: {rarityColor(card.rarity)}"
	aria-label="{card.name}, {r.name}"
>
	<div class="inner">
		<header>
			<span class="code">{r.code}</span>
			<h3>{missing ? '???' : card.name}</h3>
			{#if favorite}<Icon name="star" size={14} fill class="fav" />{/if}
		</header>
		<div class="art">
			{#if src}
				<img {src} alt="" loading="lazy" decoding="async" draggable="false" />
			{:else}
				<Icon name="sparkles" size={40} />
			{/if}
			{#if count > 1}<span class="count">x{count}</span>{/if}
		</div>
		<div class="meta">
			<span class="sub">{card.subtype}{#if card.category !== 'class'}, niv. {card.level}{/if}</span>
			{#if size !== 'sm' && !missing}
				{#if card.info1}<span class="info">{card.info1}</span>{/if}
				{#if card.info2 && size === 'lg'}<span class="info">{card.info2}</span>{/if}
			{/if}
		</div>
		<footer>
			<span class="stat" title="Attaque"><Icon name="sword" size={size === 'sm' ? 12 : 15} />{missing ? '?' : fmt(card.attack)}</span>
			<span class="stat" title="Défense"><Icon name="shield" size={size === 'sm' ? 12 : 15} />{missing ? '?' : fmt(card.defense)}</span>
		</footer>
	</div>
</article>

<style>
	.card {
		--pad: 10px;
		--name: 13px;
		--small: 11px;
		position: relative;
		aspect-ratio: 5 / 7;
		border-radius: var(--radius-card);
		padding: 2px;
		background: var(--rc);
		box-shadow: var(--shadow-card);
		container-type: inline-size;
		user-select: none;
		touch-action: manipulation;
		width: 100%;
		color: var(--label);
		text-align: left;
	}
	.size-sm {
		--pad: 7px;
		--name: 11.5px;
		--small: 10px;
		border-radius: 14px;
	}
	.size-lg {
		--pad: 16px;
		--name: 20px;
		--small: 14px;
		border-radius: 26px;
		padding: 3px;
	}
	.inner {
		height: 100%;
		border-radius: calc(var(--radius-card) - 2px);
		background: var(--surface);
		display: flex;
		flex-direction: column;
		padding: var(--pad);
		gap: calc(var(--pad) * 0.6);
		overflow: hidden;
	}
	.size-sm .inner {
		border-radius: 12px;
	}
	.size-lg .inner {
		border-radius: 23px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.code {
		flex: none;
		font-size: var(--small);
		font-weight: 800;
		color: white;
		background: var(--rc);
		border-radius: 6px;
		padding: 1px 5px;
		letter-spacing: 0.02em;
	}
	h3 {
		margin: 0;
		font-size: var(--name);
		line-height: 1.2;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}
	:global(.fav) {
		color: var(--r-legendary);
		flex: none;
	}
	.art {
		position: relative;
		flex: 1;
		min-height: 0;
		border-radius: calc(var(--radius-md) - 2px);
		background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--rc) 22%, transparent), color-mix(in srgb, var(--rc) 6%, var(--surface-2)) 70%);
		display: grid;
		place-items: center;
		color: var(--rc);
		overflow: hidden;
	}
	.art img {
		width: 82%;
		height: 82%;
		object-fit: contain;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18));
	}
	.missing .art img {
		filter: brightness(0) opacity(0.18);
	}
	.missing .inner {
		background: var(--surface-2);
	}
	.missing {
		background: var(--surface-3);
		box-shadow: none;
	}
	.missing .code {
		background: var(--label-3);
	}
	.count {
		position: absolute;
		right: 6px;
		bottom: 6px;
		font-size: var(--small);
		font-weight: 700;
		background: var(--label);
		color: var(--bg);
		border-radius: 999px;
		padding: 1px 7px;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.sub,
	.info {
		font-size: var(--small);
		color: var(--label-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.info {
		color: var(--label);
	}
	footer {
		display: flex;
		gap: 6px;
	}
	.stat {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		font-size: var(--small);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		background: var(--surface-2);
		border-radius: 999px;
		padding: 3px 4px;
	}
	.size-sm .stat {
		gap: 2px;
		padding: 2px;
	}

	/* Reflet animé discret pour Ultra rare et Légendaire */
	.shiny {
		background: linear-gradient(135deg, var(--rc), color-mix(in srgb, var(--rc) 40%, white), var(--rc));
	}
	.legendary {
		background: conic-gradient(from var(--angle, 0deg), var(--r-legendary), var(--r-legendary-2), #ffe680, var(--r-legendary));
		animation: spin 6s linear infinite;
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--r-legendary) 40%, transparent),
			0 8px 30px color-mix(in srgb, var(--r-legendary) 35%, transparent);
	}
	.shiny .art::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.45) 45%, transparent 60%);
		background-size: 250% 100%;
		animation: sheen 4.5s var(--ease-ios) infinite;
		pointer-events: none;
		mix-blend-mode: overlay;
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
	@keyframes sheen {
		0% {
			background-position: 150% 0;
		}
		60%,
		100% {
			background-position: -50% 0;
		}
	}
</style>
