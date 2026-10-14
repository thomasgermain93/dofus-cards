/**
 * Boucle 5 : premières minutes d'un nouveau joueur (inscription, tutoriel guidé, booster de bienvenue,
 * vente, quête, album, vitrine, récompense), toasts, chasse aux cartes, événement. 390 px.
 *   BASE=... OUT=... node tests/e2e/b5-onboarding.mjs
 */
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
mkdirSync(OUT, { recursive: true });
let failures = 0;
const ok = (c, m) => (console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`), c || failures++);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'fr-FR' });
const p = await ctx.newPage();
p.on('pageerror', (e) => (console.log('JS', e.message), failures++));
const go = async (u) => {
	await p.goto(BASE + u, { waitUntil: 'networkidle' });
	await p.waitForTimeout(300);
};
const shot = (n, full = false) => p.screenshot({ path: `${OUT}/b5-${n}.png`, fullPage: full });

// Inscription
const name = `nouveau${Date.now() % 100000}`;
await go('/register');
await p.fill('input[name=username]', name);
await p.fill('input[name=password]', 'Bienvenue123');
await p.fill('input[name=confirm]', 'Bienvenue123');
await p.check('input[name=rules]');
await p.click('button:has-text("Créer mon compte")');
await p.waitForURL(/\/\?welcome=1/);
await p.waitForLoadState('networkidle');
ok(!!(await p.waitForSelector('[data-testid=coach]', { timeout: 8000 }).catch(() => null)), 'tutoriel affiché après l’inscription');
await p.waitForTimeout(600);
await shot('01-tutoriel-etape-1');

// Étape 1 : booster de bienvenue
await p.click('[data-testid=open-welcome-now]');
await p.waitForSelector('[data-testid=pack]');
await p.waitForTimeout(500);
await p.click('[data-testid=pack]', { force: true });
await p.waitForSelector('[data-testid=reveal-stage]');
await p.click('[data-testid=skip]');
await p.waitForSelector('.summary');
const last = await p.locator('.summary .card').last().getAttribute('class');
ok(/r[2-5]/.test(last ?? ''), 'booster de bienvenue : dernière carte Rare ou mieux');
await p.keyboard.press('Escape');
await p.waitForTimeout(800);

// Étape 3 (préparation) : ouvrir 3 paquets gratuits pour la quête « Ouvrir 3 paquets »
for (let i = 0; i < 3; i++) {
	await go('/');
	const b = p.locator('[data-testid=open-pack]');
	if (await b.isDisabled()) break;
	await b.click();
	await p.waitForSelector('[data-testid=pack]');
	await p.waitForTimeout(500);
await p.waitForTimeout(500);
	await p.click('[data-testid=pack]', { force: true });
	await p.waitForSelector('[data-testid=reveal-stage]');
	await p.click('[data-testid=skip]');
	await p.waitForSelector('.summary');
	if (i === 0) {
		// Étape 2 : vendre une carte depuis le récapitulatif
		await p.locator('[data-testid=pack-sell]').first().click();
		const sheet = p.locator('[data-testid=confirm-sheet]');
		if (await sheet.count()) await sheet.click();
		await p.waitForTimeout(900);
		await shot('02-gain-kamas');
	}
	await p.keyboard.press('Escape');
}
await go('/');
await shot('03-tutoriel-etape-quete');
await go('/quests');
const claim = p.locator('[data-testid=claim-quest]').first();
ok((await claim.count()) > 0, 'quête « Ouvrir 3 paquets » terminée');
await claim.click();
await p.waitForTimeout(900);
await shot('04-quete-cochee-toast');

// Étape 4 : album, étape 5 : vitrine
await go('/album');
await p.waitForTimeout(800);
await go('/profile/edit');
await p.click('[data-testid=new-showcase]');
const picks = p.locator('#vitrines .pick');
for (let i = 0; i < 3; i++) await picks.nth(i).click();
await p.click('[data-testid=save-showcase]');
await p.waitForSelector('text=principale');
await go('/');
await p.waitForSelector('[data-testid=coach-finish]');
await shot('05-tutoriel-termine');
await p.click('[data-testid=coach-finish]');
await p.waitForSelector('[data-testid=toast-global]');
await p.waitForTimeout(400);
await shot('06-recompense-bienvenue');
ok((await p.locator('[data-testid=coach]').count()) === 0, 'tutoriel terminé et récompensé');
ok((await p.locator('[data-testid=starter]').count()) === 1, 'objectifs des 3 premiers jours affichés');

// Événement
ok((await p.locator('[data-testid=event]').count()) === 1, 'bannière de l’événement « Semaine des Dofus »');
await shot('07-accueil-evenement', true);

// Chasse aux cartes : chercher la carte mystère du jour
let found = false;
for (const path of ['/album', '/market', '/duels', '/social', '/collections', '/leaderboard', '/quests', '/achievements']) {
	await go(path);
	if (await p.locator('[data-testid=hunt]').count()) {
		await shot('08-carte-mystere');
		await p.click('[data-testid=hunt]');
		await p.waitForSelector('[data-testid=toast-global]');
		await p.waitForTimeout(300);
		await shot('09-carte-mystere-trouvee');
		found = true;
		break;
	}
}
ok(found, 'carte mystère trouvée');

// Transition de page (capture en plein milieu)
await go('/');
await p.click('.tabbar a[href="/album"]');
await p.waitForTimeout(140);
await shot('10-transition');

await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Boucle 5 OK.');
process.exit(failures ? 1 : 0);
