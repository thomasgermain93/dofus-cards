<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import Card from '#lib/components/Card.svelte';
	import CardPicker from '#lib/components/CardPicker.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { play } from '#lib/sfx';
	import type { CardView } from '#lib/types';

	let { data, form } = $props();
	let bs = $state(untrack(() => structuredClone(data.state)));
	let clockOffset = $state(0);
	let now = $state(Date.now());
	$effect.pre(() => {
		bs = data.state;
		clockOffset = data.state.serverNow - Date.now();
	});

	// Sondage court : l'état vient toujours du serveur (reconnexion transparente)
	let lastKey = '';
	onMount(() => {
		let stop = false;
		const tick = setInterval(() => (now = Date.now()), 200);
		async function poll() {
			if (stop) return;
			try {
				const res = await fetch(`/api/battle/${bs.code}`, { cache: 'no-store' });
				if (res.ok) {
					const s = await res.json();
					const key = `${s.phase.kind}:${'index' in s.phase ? s.phase.index : ''}`;
					if (key !== lastKey) {
						if (s.phase.kind === 'question') play('flip', 0.4);
						if (s.phase.kind === 'reveal') play(s.question?.myAnswer === s.question?.correct ? 'rare' : 'place', 0.45);
						if (lastKey.startsWith('lobby') && s.status !== 'lobby') invalidateAll();
						lastKey = key;
					}
					bs = s;
					clockOffset = s.serverNow - Date.now();
				}
			} catch {
				/* réseau coupé : on réessaie */
			}
			setTimeout(poll, bs.status === 'lobby' ? 1500 : 800);
		}
		poll();
		return () => {
			stop = true;
			clearInterval(tick);
		};
	});

	const serverNow = $derived(now + clockOffset);
	const ph = $derived(bs.phase);
	const remaining = $derived('endsAt' in ph ? Math.max(0, ph.endsAt - serverNow) : 0);
	const q = $derived(bs.question);
	let deck = $state<number[]>([]);
	$effect.pre(() => {
		if (!deck.length && bs.myCards.length) deck = [...bs.myCards];
	});
	const readyCount = $derived(bs.players.filter((p) => p.ready && !p.left).length);
	const playerOf = (uid: number) => bs.players.find((p) => p.userId === uid);
	let sending = $state(false);
	let answerError = $state<string | null>(null);

	async function answer(i: number) {
		if (!q || q.myAnswer != null || sending || q.isMine) return;
		sending = true;
		answerError = null;
		const res = await fetch(`/api/battle/${bs.code}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ index: q.index, choice: i })
		});
		sending = false;
		if (res.ok) bs = { ...bs, question: { ...q, myAnswer: i, answered: q.answered + 1 } };
		else answerError = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Erreur';
	}
	async function copyCode() {
		try {
			await navigator.clipboard.writeText(bs.code);
		} catch {
			/* ignore */
		}
	}
</script>

<svelte:head><title>Bataille {bs.code}</title></svelte:head>

<a href="/battle" class="back-link"><Icon name="chevron-left" size={20} />Batailles</a>
{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

{#if ph.kind === 'lobby'}
	<section class="code-box group">
		<p class="footnote text-label-2">Code du salon</p>
		<button class="code" onclick={copyCode} title="Copier" data-testid="battle-code">{bs.code}<Icon name="repeat" size={16} class="opacity-40" /></button>
		<p class="footnote text-label-2">Partage ce code : on peut rejoindre tant que la partie n'a pas commencé.</p>
		<p class="mt-2 headline">{bs.players.filter((p) => !p.left).length} / {bs.rules.max} joueurs, {readyCount} prêt{readyCount > 1 ? 's' : ''}</p>
		{#if readyCount < bs.rules.min}<p class="footnote text-warning">Il faut au moins {bs.rules.min} joueurs avec leurs 3 cartes.</p>{/if}
	</section>

	<div class="players">
		{#each bs.players.filter((p) => !p.left) as p (p.userId)}
			<span class="pl" class:ready={p.ready}>
				<Avatar name={p.username} image={p.avatar} x={p.avatarX} y={p.avatarY} size={34} />
				<span class="truncate">{p.username}</span>
				{#if p.userId === bs.hostId}<Icon name="crown" size={14} class="text-warning" />{/if}
				{#if p.ready}<Icon name="check" size={14} stroke={3} class="text-success" />{/if}
			</span>
		{/each}
	</div>

	{#if !bs.joined}
		<form method="POST" action="?/join" use:enhance><button class="btn btn-block" data-testid="battle-join">Rejoindre le salon</button></form>
	{:else}
		<section class="group p-4 mb-4">
			<p class="headline mb-1">Tes 3 cartes</p>
			<p class="footnote text-label-2 mb-3">Elles serviront de sujets de questions pour les autres. Une carte obscure, c'est plus dur à deviner !</p>
			<CardPicker cards={data.mine} bind:selected={deck} max={3} />
			<form method="POST" action="?/cards" use:enhance class="mt-3">
				<input type="hidden" name="cards" value={JSON.stringify(deck)} />
				<button class="btn btn-secondary btn-block" disabled={deck.length !== 3} data-testid="battle-cards">{bs.myCards.length === 3 ? 'Mettre à jour mes cartes' : 'Valider mes cartes'}</button>
			</form>
		</section>
		<div class="flex gap-3">
			{#if bs.isHost}
				<form method="POST" action="?/start" use:enhance class="flex-1"><button class="btn btn-block" disabled={readyCount < bs.rules.min} data-testid="battle-start"><Icon name="swords" size={18} />Lancer la partie</button></form>
			{:else}
				<p class="flex-1 footnote text-label-2 self-center">En attente de l'hôte…</p>
			{/if}
			<form method="POST" action="?/leave" use:enhance><button class="btn btn-plain">Quitter</button></form>
		</div>
	{/if}
{:else if ph.kind === 'countdown'}
	<div class="countdown" data-testid="battle-countdown">
		<p class="footnote text-label-2">La partie commence dans</p>
		<p class="big">{Math.ceil(remaining / 1000)}</p>
		<p class="text-label-2">{bs.players.filter((p) => !p.left).length} joueurs, {readyCount * 3} cartes en jeu</p>
	</div>
{:else if (ph.kind === 'question' || ph.kind === 'reveal') && q}
	<div class="game">
		<div class="main">
			<div class="qhead">
				<span class="footnote text-label-2">Question {q.index + 1} / {q.total}</span>
				<span class="footnote font-semibold tabular-nums {ph.kind === 'question' && remaining < 5000 ? 'text-danger' : ''}">{ph.kind === 'question' ? `${Math.ceil(remaining / 1000)} s` : 'Réponse'}</span>
			</div>
			<div class="timer"><span style="width: {ph.kind === 'question' ? (remaining / bs.rules.questionMs) * 100 : 0}%"></span></div>
			<div class="subject">
				<div class="w-28 flex-none"><Card card={q.card as CardView} size="sm" quiz={bs.phase.kind === 'question'} /></div>
				<div class="min-w-0">
					<p class="footnote text-label-2">{q.isMine ? 'Ta carte : pas de points pour toi sur celle-ci' : q.owner ? `Carte amenée par ${q.owner}` : ''}</p>
					<h1 class="question" data-testid="battle-question">{q.prompt}</h1>
				</div>
			</div>
			{#if answerError}<p class="alert alert-error">{answerError}</p>{/if}
			<div class="choices">
				{#each q.choices as c, i}
					{@const total = q.counts ? q.counts.reduce((a, b) => a + b, 0) : 0}
					<button
						class="choice"
						class:picked={q.myAnswer === i}
						class:right={q.correct === i}
						class:wrong={q.correct != null && q.myAnswer === i && q.correct !== i}
						disabled={ph.kind !== 'question' || q.myAnswer != null || q.isMine || sending}
						onclick={() => answer(i)}
						data-testid="battle-choice"
					>
						{#if q.counts && total}<span class="fill" style="width: {(q.counts[i] / total) * 100}%"></span>{/if}
						<span class="letter">{'ABCD'[i]}</span><span class="flex-1 text-left">{c}</span>
						{#if q.counts}<span class="footnote tabular-nums">{q.counts[i]}</span>{/if}
					</button>
				{/each}
			</div>
			<p class="footnote text-label-2 text-center mt-2">
				{ph.kind === 'question' ? (q.myAnswer != null ? `Réponse envoyée. ${q.answered} joueur${q.answered > 1 ? 's ont' : ' a'} répondu.` : 'Choisis vite : les réponses rares rapportent plus !') : 'Question suivante dans un instant…'}
			</p>
		</div>
		<aside class="board group">
			<p class="headline px-4 pt-3 pb-1">Classement</p>
			{#each bs.scores.slice(0, 10) as s, i (s.userId)}
				{@const pl = playerOf(s.userId)}
				<div class="cell" class:left={s.left}>
					<span class="rank r{i}">{i + 1}</span>
					<Avatar name={s.username} image={pl?.avatar} x={pl?.avatarX} y={pl?.avatarY} size={26} />
					<span class="flex-1 truncate">{s.username}</span>
					<span class="font-bold tabular-nums">{s.score}</span>
				</div>
			{/each}
		</aside>
	</div>
{:else}
	<section class="results" data-testid="battle-results">
		<h1 class="large-title text-center">Résultats</h1>
		<div class="podium">
			{#each [1, 0, 2] as i}
				{@const s = bs.scores[i]}
				{#if s}
					{@const pl = playerOf(s.userId)}
					<div class="step s{i}">
						<Avatar name={s.username} image={pl?.avatar} x={pl?.avatarX} y={pl?.avatarY} size={i === 0 ? 72 : 56} />
						<span class="font-semibold truncate max-w-full">{s.username}</span>
						<span class="footnote">{s.score} pts</span>
						<span class="block-step">{i + 1}</span>
					</div>
				{/if}
			{/each}
		</div>
		<div class="group">
			{#each bs.scores as s, i (s.userId)}
				<div class="cell">
					<span class="rank r{i}">{i + 1}</span>
					<span class="flex-1">{s.username}{s.left ? ' (parti)' : ''}</span>
					<span class="footnote text-label-2">{s.correct} bonne{s.correct > 1 ? 's' : ''} réponse{s.correct > 1 ? 's' : ''}</span>
					<span class="font-bold tabular-nums w-14 text-right">{s.score}</span>
					<span class="footnote text-kamas w-16 text-right">+{i < bs.rules.rewards.length && s.score > 0 ? bs.rules.rewards[i] : bs.rules.participation}</span>
				</div>
			{/each}
		</div>
		<form method="POST" action="/battle?/create" use:enhance class="mt-4"><button class="btn btn-block"><Icon name="users" size={18} />Nouvelle bataille</button></form>
	</section>
{/if}

<style>
	.code-box {
		text-align: center;
		padding: 20px 16px;
		margin-bottom: 14px;
	}
	.code {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		margin: 8px 0;
		font-size: 44px;
		font-weight: 900;
		letter-spacing: 0.18em;
		color: var(--accent);
		background: var(--accent-soft);
		border: 0;
		border-radius: 16px;
		padding: 8px 20px;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
	.players {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 16px;
	}
	.pl {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 180px;
		padding: 4px 12px 4px 4px;
		border-radius: 999px;
		background: var(--surface);
		font-weight: 600;
		font-size: 14px;
		opacity: 0.7;
	}
	.pl.ready {
		opacity: 1;
		box-shadow: 0 0 0 1.5px var(--success);
	}
	.countdown {
		text-align: center;
		padding: 60px 0;
	}
	.big {
		font-size: 120px;
		font-weight: 900;
		line-height: 1;
		margin: 10px 0;
		background: linear-gradient(135deg, var(--indigo), var(--pink));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		animation: pulse 1s ease-in-out infinite;
	}
	.game {
		display: grid;
		gap: 16px;
	}
	@media (min-width: 900px) {
		.game {
			grid-template-columns: 1fr 300px;
			align-items: start;
		}
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.qhead {
		display: flex;
		justify-content: space-between;
	}
	.timer {
		height: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.timer span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--pink), var(--orange), var(--green));
		transition: width 0.2s linear;
	}
	.subject {
		display: flex;
		gap: 14px;
		align-items: center;
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 12px;
	}
	.question {
		font-size: 21px;
		line-height: 27px;
		font-weight: 700;
		margin: 4px 0 0;
	}
	.choices {
		display: grid;
		gap: 10px;
	}
	@media (min-width: 640px) {
		.choices {
			grid-template-columns: 1fr 1fr;
		}
	}
	.choice {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 12px 16px;
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 1.5px solid transparent;
		font-size: 16px;
		color: var(--label);
		cursor: pointer;
	}
	.choice > * {
		position: relative;
	}
	.fill {
		position: absolute !important;
		inset: 0 auto 0 0;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.letter {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: var(--surface-3);
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 14px;
		flex: none;
	}
	.picked {
		border-color: var(--accent);
	}
	.right {
		border-color: var(--success);
		background: var(--success-soft);
	}
	.wrong {
		border-color: var(--danger);
		background: var(--danger-soft);
	}
	.choice:disabled {
		cursor: default;
	}
	.board .left {
		opacity: 0.5;
	}
	.rank {
		width: 24px;
		height: 24px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 12px;
		background: var(--surface-3);
		flex: none;
	}
	.rank.r0 {
		background: var(--gold);
		color: var(--medal-1-ink);
	}
	.rank.r1 {
		background: var(--medal-2);
		color: var(--medal-2-ink);
	}
	.rank.r2 {
		background: var(--medal-3);
		color: var(--medal-3-ink);
	}
	.podium {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		align-items: end;
		gap: 10px;
		margin: 20px 0;
	}
	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 0;
		animation: rise 0.6s var(--ease-ios) both;
	}
	.block-step {
		width: 100%;
		display: grid;
		place-items: center;
		color: white;
		font-weight: 900;
		font-size: 22px;
		border-radius: 12px 12px 0 0;
		margin-top: 6px;
	}
	.s0 .block-step {
		height: 110px;
		background: linear-gradient(180deg, var(--gold), var(--r-legendary));
	}
	.s1 .block-step {
		height: 80px;
		background: linear-gradient(180deg, var(--medal-2), var(--r-common));
	}
	.s2 .block-step {
		height: 60px;
		background: linear-gradient(180deg, var(--medal-3), #b0703a);
	}
	.s0 {
		animation-delay: 0.3s;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.08);
		}
	}
	@keyframes rise {
		from {
			transform: translateY(30px);
			opacity: 0;
		}
	}
</style>
