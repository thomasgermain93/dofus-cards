<script lang="ts">
	/** Feuille iOS pour étiqueter une ou plusieurs cartes. */
	let {
		existing = [],
		count = 1,
		onsubmit,
		oncancel
	}: { existing?: string[]; count?: number; onsubmit: (tag: string) => void; oncancel: () => void } = $props();
	let tag = $state('');
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />
<div class="backdrop" role="presentation" onclick={oncancel}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Étiqueter">
<form
	class="flex flex-col gap-3"
	onsubmit={(e) => {
		e.preventDefault();
		if (tag.trim().length >= 2) onsubmit(tag.trim());
	}}
>
	<span class="grabber self-center" aria-hidden="true"></span>
	<p class="headline">Étiqueter {count} carte{count > 1 ? 's' : ''}</p>
	<input class="field" bind:value={tag} maxlength="24" placeholder="Nouvelle étiquette (ex. Boss d'Otomaï)" aria-label="Étiquette" />
	{#if existing.length}
		<div class="chips">{#each existing as t (t)}<button type="button" class="chip" aria-pressed={tag === t} onclick={() => (tag = t)}>{t}</button>{/each}</div>
	{/if}
	<button class="btn btn-block" disabled={tag.trim().length < 2} data-testid="tag-submit">Étiqueter</button>
	<button type="button" class="btn btn-plain btn-block" onclick={oncancel}>Annuler</button>
</form>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-sheet);
		background: var(--scrim);
	}
	.sheet {
		position: fixed;
		z-index: calc(var(--z-sheet) + 1);
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0 auto;
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
		background: var(--surface);
		border-radius: 20px 20px 0 0;
		box-shadow: var(--shadow-float);
		animation: up var(--dur) var(--ease-ios);
	}
	.grabber {
		align-self: center;
		width: 36px;
		height: 5px;
		border-radius: 999px;
		background: var(--surface-3);
		margin-bottom: var(--space-1);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	@keyframes up {
		from {
			transform: translateY(100%);
		}
	}
</style>
