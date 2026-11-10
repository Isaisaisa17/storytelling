import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('German and English mobile participants complete a round, refresh, discuss, admit late arrivals, remove and leave', async ({ browser }) => {
  const german = await browser.newContext({ locale: 'de-DE', viewport: { width: 320, height: 740 } });
  const english = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } });
  const late = await browser.newContext({ locale: 'de-AT', viewport: { width: 320, height: 740 } });
  const a = await german.newPage(); const b = await english.newPage(); const c = await late.newPage();
  await a.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        Object.assign(window, { __testSocket: this });
      }
    };
  });
  try {
    await a.goto('/'); await expect(a.locator('html')).toHaveAttribute('lang', 'de');
    await expect(a.getByRole('status')).toHaveText('Verbunden');
    expect((await new AxeBuilder({ page: a }).analyze()).violations).toEqual([]);
    await a.getByLabel('Dein Spitzname').fill('Alex'); await a.getByRole('button', { name: 'Raum erstellen' }).click();
    await expect(a.getByRole('heading', { name: 'Wie schätzt du den Aufwand?' })).toBeVisible();
    await a.screenshot({ path: test.info().outputPath('german-mobile-voting.png'), fullPage: true });
    expect(await a.locator('.cards').evaluate(container => [...container.children].every(card => card.getBoundingClientRect().right <= container.getBoundingClientRect().right + 1))).toBe(true);
    const invite = a.url(); await a.getByRole('button', { name: 'Mit 8 abstimmen', exact: true }).click();
    await expect(a.getByRole('button', { name: 'Mit 8 abstimmen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await a.reload(); await expect(a.getByRole('button', { name: 'Mit 8 abstimmen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await a.evaluate(() => (window as unknown as { __testSocket: WebSocket }).__testSocket.close());
    await expect(a.locator('.connection')).toHaveText('Getrennt — Verbindung wird wiederhergestellt…');
    await expect(a.getByRole('button', { name: 'Mit 8 abstimmen', exact: true })).toBeDisabled();
    await expect(a.locator('.connection')).toHaveText('Verbunden');
    await expect(a.getByRole('button', { name: 'Mit 8 abstimmen', exact: true })).toBeEnabled();
    await expect(a.getByRole('button', { name: 'Mit 8 abstimmen', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await b.goto(invite); await b.getByLabel('Your nickname').fill('Bea'); await b.getByRole('button', { name: 'Join a room' }).click();
    await expect(a.getByText('1 Stimme fehlt noch', { exact: true })).toBeVisible();
    await expect(a.getByRole('button', { name: 'Karten aufdecken' })).toBeDisabled();
    await expect(b.getByRole('button', { name: 'Vote 8', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await b.getByRole('button', { name: 'Vote 13', exact: true }).click();
    await expect(a.getByText('Alle sind bereit', { exact: true })).toBeVisible();
    await a.getByRole('button', { name: 'Karten aufdecken' }).click();
    await expect(a.locator('.mean strong')).toHaveText('10,5'); await expect(b.locator('.mean strong')).toHaveText('10.5');
    await expect(a.locator('.anonymous-votes')).toHaveText('813');
    await a.screenshot({ path: test.info().outputPath('german-mobile-average.png'), fullPage: true });
    expect((await new AxeBuilder({ page: a }).analyze()).violations).toEqual([]);
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await a.getByLabel('Sprache', { exact: true }).selectOption('en'); await a.reload();
    await expect(a.locator('html')).toHaveAttribute('lang', 'en'); await expect(a.locator('.mean strong')).toHaveText('10.5');
    await expect(b.locator('html')).toHaveAttribute('lang', 'en');
    await b.getByRole('button', { name: 'New round' }).click(); await expect(b.getByRole('dialog')).toBeVisible();
    await b.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(b.locator('.mean')).toBeVisible();
    await b.getByRole('button', { name: 'New round' }).click(); await b.getByRole('button', { name: 'Confirm', exact: true }).click();
    await a.getByRole('button', { name: 'Vote 1', exact: true }).click(); await b.getByRole('button', { name: 'Vote 20', exact: true }).click();
    await a.getByRole('button', { name: 'Reveal cards' }).click(); await expect(a.getByRole('heading', { name: 'Discussion time' })).toBeVisible();
    await expect(a.locator('.discussion-votes')).toContainText('Alex'); await expect(a.locator('.discussion-votes')).toContainText('Bea');
    await c.goto(invite); await c.getByLabel('Dein Spitzname').fill('Chris'); await c.getByRole('button', { name: 'Raum beitreten' }).click();
    await expect(c.getByText('Dein Platz in der nächsten Runde ist bereit.')).toBeVisible(); await expect(c.locator('.cards')).toHaveCount(0);
    await expect(c.getByRole('heading', { name: 'Diskussionsrunde' })).toBeVisible();
    expect(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page: c }).analyze()).violations).toEqual([]);
    await c.screenshot({ path: test.info().outputPath('german-mobile-discussion.png'), fullPage: true });
    await c.getByRole('button', { name: 'Neue Runde' }).click(); await c.getByRole('button', { name: 'Bestätigen', exact: true }).click();
    await expect(c.getByText('3 Stimmen fehlen noch', { exact: true })).toBeVisible();
    await b.getByRole('button', { name: 'Remove Chris', exact: true }).click(); await b.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(c.getByRole('alert')).toContainText('Du wurdest aus dem Raum entfernt.');
    await expect(a.getByText('2 votes still missing', { exact: true })).toBeVisible();
    await a.getByRole('button', { name: 'Leave room', exact: true }).click(); await a.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(a.getByRole('button', { name: 'Create a room' })).toBeVisible();
    await b.getByRole('button', { name: 'Leave room', exact: true }).click(); await b.getByRole('button', { name: 'Confirm', exact: true }).click();
    await c.goto(invite); await c.getByLabel('Dein Spitzname').fill('Chris'); await c.getByRole('button', { name: 'Raum beitreten' }).click();
    await expect(c.getByRole('alert')).toContainText('Dieser Raum existiert nicht.');
  } finally { await german.close(); await english.close(); await late.close(); }
});

test('saved language overrides browser preference; errors follow selected language; duplicate names rejected', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 320, height: 740 } });
  const second = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage(); const other = await second.newPage();
  try {
    await page.goto('/'); await page.getByLabel('Language', { exact: true }).selectOption('de'); await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await page.getByLabel('Dein Spitzname').fill('Alex'); await page.getByRole('button', { name: 'Raum erstellen' }).click();
    await expect(page.locator('.room-name')).toBeVisible();
    await other.goto(page.url()); await other.getByLabel('Your nickname').fill('aLeX'); await other.getByRole('button', { name: 'Join a room' }).click();
    await expect(other.getByRole('alert')).toContainText('That nickname is already in use');
    await other.getByLabel('Language', { exact: true }).selectOption('de');
    await expect(other.getByRole('alert')).toContainText('Dieser Spitzname wird in diesem Raum bereits verwendet.');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const originalRoom = page.url();
    await page.getByRole('button', { name: 'Mit 3 abstimmen', exact: true }).click();
    await other.getByLabel('Dein Spitzname').fill('Bea'); await other.getByRole('button', { name: 'Raum erstellen' }).click();
    await expect(other.locator('.room-name')).toBeVisible();
    await page.goto(other.url());
    await expect(page.getByRole('button', { name: 'Raum beitreten' })).toBeVisible();
    await page.getByLabel('Dein Spitzname').fill('Alex'); await page.getByRole('button', { name: 'Raum beitreten' }).click();
    await expect(page.locator('.room-name')).toHaveText(await other.locator('.room-name').innerText());
    await page.goto(originalRoom);
    await expect(page.getByRole('button', { name: 'Mit 3 abstimmen', exact: true })).toHaveAttribute('aria-pressed', 'true');
  } finally { await context.close(); await second.close(); }
});
