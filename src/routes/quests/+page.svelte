<script lang="ts">
	import QuestList from '#lib/components/QuestList.svelte';
	import StreakCalendar from '#lib/components/StreakCalendar.svelte';
	import ChestCard from '#lib/components/ChestCard.svelte';
	import { duration } from '#lib/format';
	let { data } = $props();
	const R = $derived(data.retention);
	const day = $derived(R.quests.filter((q) => q.period === 'day'));
	const week = $derived(R.quests.filter((q) => q.period === 'week'));
	const starter = $derived(R.quests.filter((q) => q.period === 'starter'));
</script>

<svelte:head><title>Quêtes</title></svelte:head>

<h1 class="large-title mb-1">Quêtes</h1>
<p class="text-label-2 mb-4">Nouvelles quêtes du jour dans {duration(R.nextMidnight - R.now)} (minuit, heure de Bruxelles).</p>

<div class="cols">
	<div class="flex flex-col gap-5">
		{#if starter.length}
			<section>
				<h2 class="section-label">Objectifs de bienvenue</h2>
				<QuestList quests={starter} />
			</section>
		{/if}
		<section>
			<h2 class="section-label">Du jour</h2>
			<QuestList quests={day} />
		</section>
		<section>
			<h2 class="section-label">De la semaine (jusqu'à lundi, dans {duration(R.nextMonday - R.now)})</h2>
			<QuestList quests={week} />
		</section>
	</div>
	<div class="flex flex-col gap-5">
		<ChestCard chest={R.chest} nextMonday={R.nextMonday} now={R.now} />
		<StreakCalendar daily={R.daily} />
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: 20px;
	}
	@media (min-width: 900px) {
		.cols {
			grid-template-columns: 1.2fr 1fr;
			align-items: start;
		}
	}
</style>
