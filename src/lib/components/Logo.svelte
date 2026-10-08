<script lang="ts">
	import { GAME_NAME } from '#lib/config';
	let { size = 28, text = true, compact = false }: { size?: number; text?: boolean; compact?: boolean } = $props();
	const uid = $props.id();
	const gid = $derived(`logo-${uid}`);
</script>

<span class="logo" class:compact>
	<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
		<defs>
			<linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#ffcc33" />
				<stop offset="1" stop-color="#ff6a3d" />
			</linearGradient>
		</defs>
		<rect x="3" y="6" width="16" height="22" rx="4" transform="rotate(-12 11 17)" fill="var(--surface-3)" stroke="var(--separator)" />
		<rect x="11" y="4" width="16" height="22" rx="4" transform="rotate(8 19 15)" fill="url(#{gid})" />
		<path d="M19.6 10.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2z" fill="white" transform="rotate(8 19 15)" />
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
		font-family: var(--font-rounded);
		font-weight: 800;
		font-size: 19px;
		letter-spacing: -0.01em;
	}
</style>
