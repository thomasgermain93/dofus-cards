<script lang="ts">
	/** Feuille de confirmation façon iOS (action sheet). */
	let {
		title,
		message = '',
		confirmLabel,
		destructive = false,
		onconfirm,
		oncancel
	}: { title: string; message?: string; confirmLabel: string; destructive?: boolean; onconfirm: () => void; oncancel: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && oncancel()} />

<div class="backdrop" role="presentation" onclick={oncancel}></div>
<div class="sheet" role="alertdialog" aria-modal="true" aria-label={title}>
	<div class="box">
		<div class="head">
			<p class="t">{title}</p>
			{#if message}<p class="m">{message}</p>{/if}
		</div>
		<button class="act" class:destructive onclick={onconfirm} data-testid="confirm-sheet">{confirmLabel}</button>
	</div>
	<button class="box cancel" onclick={oncancel}>Annuler</button>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(0, 0, 0, 0.35);
		animation: fade var(--dur) var(--ease-ios);
	}
	.sheet {
		position: fixed;
		z-index: 201;
		left: 50%;
		bottom: calc(10px + env(safe-area-inset-bottom));
		width: min(420px, calc(100% - 20px));
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 8px;
		animation: up var(--dur) var(--ease-ios);
	}
	.box {
		background: var(--material);
		-webkit-backdrop-filter: saturate(180%) blur(24px);
		backdrop-filter: saturate(180%) blur(24px);
		border-radius: 14px;
		overflow: hidden;
		border: 0;
		color: var(--label);
	}
	.head {
		padding: 14px 16px;
		text-align: center;
		border-bottom: 0.5px solid var(--separator);
	}
	.t {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--label-2);
	}
	.m {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--label-2);
	}
	.act,
	.cancel {
		width: 100%;
		min-height: 56px;
		font-size: 19px;
		background: transparent;
		border: 0;
		color: var(--accent);
		cursor: pointer;
	}
	.cancel {
		background: var(--surface);
		font-weight: 600;
	}
	.destructive {
		color: var(--danger);
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes up {
		from {
			transform: translate(-50%, 110%);
		}
	}
</style>
