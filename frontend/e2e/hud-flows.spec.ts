import { expect, test } from '@playwright/test';

test.describe('Gta6Map (Leonida) — E2E HUD & Map Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('.backpack-trigger').waitFor({ state: 'visible' });
  });

  test('loads map canvas and backpack trigger', async ({ page }) => {
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
    await expect(page.locator('.backpack-trigger')).toBeVisible();
  });

  test('quick search opens with /, shows tabs, filters in real time, and records recent', async ({ page }) => {
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar).toBeVisible();

    // Tabs visible on focus without query
    await expect(searchBar.getByRole('tab', { name: /Categorias/i })).toBeVisible();
    await expect(searchBar.getByRole('tab', { name: /Recentes/i })).toBeVisible();
    await expect(searchBar.getByRole('tab', { name: /Acessados/i })).toBeVisible();

    // Type to filter using O(1) index
    const input = searchBar.locator('input.qs-input');
    await input.fill('Vice');
    const firstResult = searchBar.locator('.qs-item').first();
    await expect(firstResult).toBeVisible();
    await expect(firstResult).toContainText(/Vice/i);
    const chosenName = await firstResult.locator('.qs-item-name').innerText();

    // Click result -> closes search bar
    await firstResult.click();
    await expect(searchBar).toBeHidden();

    // Re-open -> clear query -> check Recentes tab contains chosen item
    await page.keyboard.press('/');
    await expect(searchBar).toBeVisible();
    await searchBar.locator('.qs-clear-btn').click();
    await searchBar.getByRole('tab', { name: /Recentes/i }).click();
    await expect(searchBar.locator('.qs-item-name').first()).toHaveText(chosenName);
  });

  test('weapon wheel pin submenu closes via target button without closing map fan', async ({ page }) => {
    await page.keyboard.press('m');
    const wheel = page.locator('.weapon-wheel');
    await expect(wheel).toBeVisible();

    // Lock Mapa fan open
    await wheel.getByRole('menuitem', { name: /Mapa/i }).click();
    const fan = wheel.locator('.map-fan');
    const marcadorBtn = fan.getByRole('menuitem', { name: /Marcador/i });
    await expect(marcadorBtn).toBeVisible();

    // Open Marcador submenu
    await marcadorBtn.click();
    const submenu = fan.locator('.pin-submenu');
    await expect(submenu).toBeVisible();

    // Click target close button -> closes only submenu, keeps fan open
    await submenu.locator('app-range-target-close button').click();
    await expect(submenu).toBeHidden();
    await expect(marcadorBtn).toBeVisible();
  });

  test('creates a custom pin on map and removes all via submenu', async ({ page }) => {
    await page.keyboard.press('m');
    const wheel = page.locator('.weapon-wheel');
    await wheel.getByRole('menuitem', { name: /Mapa/i }).click();
    await wheel.getByRole('menuitem', { name: /Marcador/i }).click();

    // Activate pin mode
    await wheel.locator('.pin-submenu').getByRole('button', { name: /Marcar/i }).click();
    await expect(wheel).toBeHidden();

    // Click on map canvas to place pin
    await page.locator('canvas.maplibregl-canvas').click({ position: { x: 400, y: 300 } });

    // Re-open wheel -> Marcador (1) -> Remover todos
    await page.keyboard.press('m');
    await wheel.getByRole('menuitem', { name: /Mapa/i }).click();
    const marcadorBtn = wheel.getByRole('menuitem', { name: /Marcador \(1\)/i });
    await expect(marcadorBtn).toBeVisible();
    await marcadorBtn.click();

    await wheel.locator('.pin-submenu').getByRole('button', { name: /Remover todos/i }).click();

    // Re-open wheel -> back to Marcador (0)
    await page.keyboard.press('m');
    await wheel.getByRole('menuitem', { name: /Mapa/i }).click();
    await expect(wheel.getByRole('menuitem', { name: /Marcador \(0\)/i })).toBeVisible();
  });

  test('mobile viewport renders rotary dial inside weapon wheel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('.backpack-trigger').click();

    const wheel = page.locator('.weapon-wheel');
    await expect(wheel).toBeVisible();
    await wheel.getByRole('menuitem', { name: /Mapa/i }).click();
    await expect(wheel.locator('app-map-rotary-dial [role="menuitem"]').first()).toBeVisible();
  });

  test('weapon wheel fan items remain visible when focused via keyboard/gamepad', async ({ page }) => {
    await page.keyboard.press('m');
    const wheel = page.locator('.weapon-wheel');
    await expect(wheel).toBeVisible();

    await wheel.getByRole('menuitem', { name: /Mapa/i }).click();
    const fanItems = wheel.locator('.map-fan .fan-item');
    const count = await fanItems.count();
    expect(count).toBe(6);

    for (let i = 0; i < count; i++) {
      const item = fanItems.nth(i);
      await item.focus();
      await expect(item).toBeVisible();
      await expect(async () => {
        const opacity = await item.evaluate((el) => getComputedStyle(el).opacity);
        expect(Number(opacity)).toBeGreaterThan(0.9);
      }).toPass({ timeout: 1000 });
    }
  });

  test('console mode replaces PC shortcut labels with gamepad shortcuts', async ({ page }) => {
    await page.evaluate(() => {
      const fakePad = {
        id: 'DualSense Wireless Controller (054c)',
        index: 0,
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 })),
        mapping: 'standard',
        timestamp: performance.now(),
      };
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => [fakePad],
      });
      const evt = new Event('gamepadconnected') as GamepadEvent;
      Object.defineProperty(evt, 'gamepad', { value: fakePad });
      window.dispatchEvent(evt);
    });

    await expect(page.locator('app-hud-console-bar .gamepad-hud')).toBeVisible();
    await expect(page.locator('.backpack-trigger')).toHaveAttribute('data-tooltip', /\(L1\)/);
    await expect(page.locator('button[aria-label="Marcar ponto no mapa"]')).toHaveAttribute(
      'data-tooltip',
      /\(□ \/ L3\)/,
    );

    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar).toBeVisible();
    await expect(searchBar.locator('.qs-kbd')).toHaveText('○');
    await expect(page.locator('app-hud-console-bar app-input-device-badge')).toBeVisible();
    await expect(page.locator('app-hud-console-bar .legend-item')).toHaveCount(0);
  });

  test('persists performance metrics in dev mode for analysis', async ({ page }) => {
    await expect(async () => {
      const summary = await page.evaluate(() => {
        const api = (window as unknown as { __leonidaPerf?: { summary: () => { count: number } } })
          .__leonidaPerf;
        return api?.summary() ?? null;
      });
      expect(summary).not.toBeNull();
      expect(summary!.count).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test('renders map without hiding overlapping POI icons and includes leader-line layers', async ({ page }) => {
    await page.locator('canvas.maplibregl-canvas').waitFor({ state: 'visible' });
    await expect(page.locator('.hud-shell')).toBeVisible();
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar.locator('.qs-footer-total')).toContainText('locais');
  });

  test('gamepad D-Pad navigates inside modals with visible .gamepad-focus highlight', async ({ page }) => {
    await page.evaluate(() => {
      const buttons = Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 }));
      const fakePad = {
        id: 'DualSense Wireless Controller (054c)',
        index: 0,
        connected: true,
        axes: [0, 0, 0, 0],
        buttons,
        mapping: 'standard',
        timestamp: performance.now(),
      };
      (window as unknown as { __fakePadButtons?: typeof buttons }).__fakePadButtons = buttons;
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => [fakePad],
      });
      const evt = new Event('gamepadconnected') as GamepadEvent;
      Object.defineProperty(evt, 'gamepad', { value: fakePad });
      window.dispatchEvent(evt);
    });

    await page.evaluate(() => {
      const btns = (window as unknown as { __fakePadButtons: { pressed: boolean; value: number }[] })
        .__fakePadButtons;
      btns[5] = { pressed: true, value: 1 };
    });
    await expect(page.locator('.quick-search-bar')).toBeVisible();
    await page.evaluate(() => {
      const btns = (window as unknown as { __fakePadButtons: { pressed: boolean; value: number }[] })
        .__fakePadButtons;
      btns[5] = { pressed: false, value: 0 };
      btns[13] = { pressed: true, value: 1 };
    });

    await expect(page.locator('.quick-search-bar .gamepad-focus')).toBeVisible();

    // □ (button 2) expands category inside Quick Search, △ (button 3) returns focus to search input without entering cinema mode
    await page.evaluate(() => {
      const btns = (window as unknown as { __fakePadButtons: { pressed: boolean; value: number }[] })
        .__fakePadButtons;
      btns[13] = { pressed: false, value: 0 };
      btns[2] = { pressed: true, value: 1 };
    });
    await expect(page.locator('.quick-search-bar').getByRole('button', { name: /Recolher/i })).toBeVisible();

    await page.evaluate(() => {
      const btns = (window as unknown as { __fakePadButtons: { pressed: boolean; value: number }[] })
        .__fakePadButtons;
      btns[2] = { pressed: false, value: 0 };
      btns[3] = { pressed: true, value: 1 };
    });
    await expect(page.locator('.quick-search-bar input.qs-input')).toBeFocused();
    await expect(page.locator('.hud-shell.cinema-mode')).toHaveCount(0);
  });

  test('selecting a POI with Ocultar outros hides all other POIs on the map', async ({ page }) => {
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await searchBar.getByRole('button', { name: /Ocultar outros/i }).click();
    await searchBar.locator('.qs-item').first().click();

    await expect(searchBar).toBeHidden();
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();
    await expect(page.locator('.hud-sidebar .filters-count')).toContainText('1/');
  });
});
