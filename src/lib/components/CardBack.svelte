<script lang="ts">
	import Logo from './Logo.svelte';
</script>

<div class="back-link" aria-hidden="true">
	<div class="bshell"><div class="inner">
		<div class="ring"><Logo size={64} text={false} /></div>
	</div></div>
</div>

<style>
	.bshell {
		position: absolute;
		inset: 0;
		border-radius: 5.5cqw;
		padding: 2.6cqw;
		background: var(--card-edge);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
	}
	.inner {
		height: 100%;
		border-radius: 3.8cqw;
		display: grid;
		place-items: center;
		background:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cpath d='M30 4l6 20 20 6-20 6-6 20-6-20-20-6 20-6z' fill='%23ffffff' fill-opacity='.05'/%3E%3C/svg%3E") 0 0 / 22cqw 22cqw,
			var(--card-back);
		box-shadow:
			inset 0 0 0 0.9cqw var(--card-back-line),
			inset 0 0 0 1.8cqw rgba(0, 0, 0, 0.35);
	}
	.ring {
		width: 46cqw;
		height: 46cqw;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.02) 70%);
		box-shadow: 0 0 0 0.9cqw rgba(201, 164, 92, 0.8);
	}
</style>
