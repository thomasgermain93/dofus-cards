<script lang="ts">
	import { GAME_NAME } from '#lib/config';
	let { size = 28, text = true, compact = false }: { size?: number; text?: boolean; compact?: boolean } = $props();
	const uid = $props.id();
	const gid = $derived(`logo-${uid}`);
</script>

<!-- Emblème dessiné main : une carte parchemin et un œuf moucheté (aucun logo Ankama) -->
<span class="logo" class:compact>
	<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
		<defs>
			<linearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
				<stop offset="0" stop-color="#c4e06a" />
				<stop offset="0.55" stop-color="#7fa82c" />
				<stop offset="1" stop-color="#3f5614" />
			</linearGradient>
		</defs>
		<g transform="rotate(-11 12 15)">
			<rect x="4.5" y="3.5" width="15" height="21" rx="2" fill="#f3e8cc" stroke="#2a1f14" stroke-width="1.3" />
			<rect x="7" y="6" width="10" height="9" rx="1" fill="none" stroke="#c99a1c" stroke-width="1.2" />
		</g>
		<path d="M21.5 8.5c-3.9 0-6.9 5.6-6.9 10.1 0 4.2 3 7.4 6.9 7.4s6.9-3.2 6.9-7.4c0-4.5-3-10.1-6.9-10.1z" fill="url(#{gid})" stroke="#1d2a06" stroke-width="1.3" />
		<ellipse cx="19.4" cy="15.2" rx="1.3" ry="1.7" fill="#e3f2a8" opacity="0.9" />
		<ellipse cx="23.6" cy="19.6" rx="1.1" ry="1.3" fill="#e3f2a8" opacity="0.75" />
		<ellipse cx="20.3" cy="22.4" rx="0.9" ry="1" fill="#e3f2a8" opacity="0.6" />
	</svg>
	{#if text}<span class="name">{GAME_NAME}</span>{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	@media (max-width: 420px) {
		.compact .name {
			display: none;
		}
	}
	.name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 22px;
		line-height: 1;
		color: var(--title);
		text-shadow: var(--title-shadow);
	}
</style>
