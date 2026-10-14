<script lang="ts">
	import { imgUrl } from '#lib/format';
	/** Avatar = une carte de la collection recadrée en cercle (point focal réglable). */
	let {
		name,
		image = null,
		x = 50,
		y = 40,
		size = 36
	}: { name: string; image?: string | null; x?: number; y?: number; size?: number } = $props();
	const hue = $derived([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
</script>

<span class="av" style="width:{size}px;height:{size}px;--h:{hue};font-size:{Math.round(size * 0.42)}px" aria-hidden="true">
	{#if image}
		<img src={imgUrl(image)} alt="" style="object-position:{x}% {y}%" loading="lazy" />
	{:else}
		{name.slice(0, 1).toUpperCase()}
	{/if}
</span>

<style>
	.av {
		flex: none;
		display: inline-grid;
		place-items: center;
		border-radius: 999px;
		overflow: hidden;
		font-family: var(--font-display);
		font-weight: 700;
		color: #fbf1d6;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
		/* Médaillon : teinte terreuse propre au pseudo, cerclé de laiton */
		background: radial-gradient(circle at 50% 30%, hsl(var(--h) 38% 44%), hsl(var(--h) 42% 24%));
		border: 2px solid var(--gold-deep);
		box-shadow:
			0 0 0 1px var(--panel-edge),
			inset 0 1px 2px rgba(0, 0, 0, 0.4);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.6);
		background: radial-gradient(circle, var(--card-parch-2), var(--card-parch));
	}
</style>
