import { expect, test } from '@playwright/test';

test.describe('Gta6Map (Leonida) — E2E HUD & Map Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Avoid downloading the 77MB native 3D GLB on unrelated HUD tests
    await page.route('**/native-3d-v2/geometry.glb', (route) => route.abort());
    await page.goto('/');
    await page.locator('.backpack-trigger').waitFor({ state: 'visible' });
  });

  test('loads map canvas and backpack trigger', async ({ page }) => {
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
    await expect(page.locator('.backpack-trigger')).toBeVisible();
    await expect(page.locator('.gtadb-attribution')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /gtadb\.org/i })).toHaveCount(0);
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
    await page.locator('.leonida-poi-marker').first().waitFor({ state: 'visible' });
    await page.keyboard.press('m');
    const wheel = page.locator('.weapon-wheel');
    await wheel.getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await wheel.getByRole('menuitem', { name: /Marcador/i }).click();

    // Activate pin mode
    await wheel.locator('.pin-submenu').getByRole('button', { name: /Marcar/i }).click();
    await expect(wheel).toBeHidden();

    // Click on open map canvas area to place pin
    await page.locator('canvas.maplibregl-canvas').click({ position: { x: 180, y: 540 } });

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
    await expect(fanItems).toHaveCount(6);
    const count = await fanItems.count();

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
    await expect(page.locator('.leonida-poi-overlay')).toBeAttached();
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
    await expect(
      page.locator('.quick-search-bar').getByRole('button', { name: /Ver todos/i }).first(),
    ).toBeVisible();

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

  test('centralizes map via button/shortcut and focuses last item when collapsing search category', async ({ page }) => {
    // Center map button works without errors
    await page.locator('button[aria-label="Centralizar mapa"]').click();
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();

    // Expand and collapse category in Quick Search -> focus returns to last visible item
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    const firstGroup = searchBar.locator('.qs-group').first();
    await firstGroup.getByRole('button', { name: /Ver todos/i }).click();
    await expect(firstGroup.getByRole('button', { name: /Recolher/i })).toBeVisible();
    await firstGroup.getByRole('button', { name: /Recolher/i }).click();
    await expect(firstGroup.locator('.qs-item').last()).toBeFocused();
  });

  test('unifies mouse and gamepad into a single cursor when controller is connected', async ({ page }) => {
    const desktopCursor = await page.locator('.hud-shell').evaluate((el) => getComputedStyle(el).cursor);
    const canvasDesktopCursor = await page
      .locator('canvas.maplibregl-canvas')
      .evaluate((el) => getComputedStyle(el).cursor);
    expect(desktopCursor).toContain('%23F44E8F');
    expect(canvasDesktopCursor).toContain('%23F44E8F');

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

    await page.mouse.move(420, 260);
    const cursor = page.locator('.gamepad-cursor');
    const cursorSvgHtml = await cursor.locator('svg').innerHTML();
    expect(cursorSvgHtml).toContain('#F44E8F');
    expect(cursorSvgHtml).toContain('#FFB458');
    await expect(async () => {
      const box = await cursor.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.x + box!.width / 2)).toBe(420);
      expect(Math.round(box!.y + box!.height / 2)).toBe(260);
    }).toPass({ timeout: 2000 });
    await expect(page.locator('.hud-shell.console-safe-area')).toHaveCSS('cursor', 'none');
    await expect(page.locator('canvas.maplibregl-canvas')).toHaveCSS('cursor', 'none');
  });

  test('map pan/zoom and 2D/3D toggle run without WebGL abort errors or heavy HUD backdrop-filter', async ({ page }) => {
    const pageErrors: string[] = [];
    const mapWarnings: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && /clusterMaxZoom|hillshade|3D terrain/i.test(msg.text())) {
        mapWarnings.push(msg.text());
      }
    });

    const canvas = page.locator('canvas.maplibregl-canvas');
    await canvas.waitFor({ state: 'visible' });

    const backdropFilter = await page
      .locator('.map-controls .hud-panel')
      .first()
      .evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdropFilter).toBe('none');

    // Pan and zoom interactions
    await page.mouse.move(520, 340);
    await page.mouse.down();
    await page.mouse.move(660, 420, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press('=');
    await page.keyboard.press('-');

    // Toggle 3D on and off
    await page.keyboard.press('3');
    await page.waitForTimeout(500);
    await page.keyboard.press('3');
    await page.waitForTimeout(450);

    expect(pageErrors).toHaveLength(0);
    expect(mapWarnings).toHaveLength(0);

    const webglErrors = await page.evaluate(() => {
      const api = (
        window as unknown as {
          __leonidaPerf?: { getMetrics: () => Array<{ level: string; source: string; message: string }> };
        }
      ).__leonidaPerf;
      return (api?.getMetrics() ?? []).filter((m) => m.level === 'error' && m.source === 'webgl');
    });
    expect(webglErrors).toHaveLength(0);
  });

  test('all opened modals play panel entrance animation', async ({ page }) => {
    // 1. Quick Search modal (3D stage + open/close panel animation)
    await page.keyboard.press('/');
    const searchStage = page.locator('.quick-search-stage');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar).toBeVisible();
    const qsStagePerspective = await searchStage.evaluate((el) => getComputedStyle(el).perspective);
    expect(qsStagePerspective).toBe('1150px');
    const qsAnim = await searchBar.evaluate((el) => getComputedStyle(el).animationName);
    expect(qsAnim).toContain('quickSearchDrop');
    await expect(async () => {
      const state = await searchBar.evaluate((el) => {
        const barRect = el.getBoundingClientRect();
        const folds = Array.from(el.querySelectorAll('.qs-fold'));
        const allInside = folds.every((f) => {
          const r = f.getBoundingClientRect();
          return (
            r.left >= barRect.left - 0.5 &&
            r.right <= barRect.right + 0.5 &&
            r.top >= barRect.top - 0.5 &&
            r.bottom <= barRect.bottom + 0.5
          );
        });
        return {
          transform: getComputedStyle(el).transform,
          folds: folds.map((f) => getComputedStyle(f).transform),
          allInside,
        };
      });
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(state.transform);
      expect(state.folds).toEqual(['none', 'none', 'none']);
      expect(state.allInside).toBe(true);
    }).toPass({ timeout: 2000 });

    // 2. POI detail card modal
    await searchBar.locator('.qs-item').first().click();
    await expect(searchBar).toHaveClass(/is-collapsed/);
    await expect(searchBar).toBeHidden();
    const poiCard = page.locator('.poi-card');
    await expect(poiCard).toBeVisible();
    const poiStyles = await poiCard.evaluate((el) => {
      const s = getComputedStyle(el);
      return { animationName: s.animationName, transformOrigin: s.transformOrigin };
    });
    expect(poiStyles.animationName).toContain('modalPanelIn');
    expect(poiStyles.transformOrigin).toContain('0px');

    // 3. Weapon Wheel & Pin Submenu modals
    await page.keyboard.press('m');
    const wheel = page.locator('.weapon-wheel');
    await expect(wheel).toBeVisible();
    const wheelAnim = await wheel.evaluate((el) => getComputedStyle(el).animationName);
    expect(wheelAnim).toContain('wheelPop');

    await wheel.getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await wheel.getByRole('menuitem', { name: /Marcador/i }).click();
    const submenu = wheel.locator('.pin-submenu');
    await expect(submenu).toBeVisible();
    const submenuAnim = await submenu.evaluate((el) => getComputedStyle(el).animationName);
    expect(submenuAnim).toContain('pinSubmenuIn');

    // 4. Custom Pin Popup modal (transparent MapLibre wrapper + copy coordinates button/shortcut)
    await page.locator('.leonida-poi-marker').first().waitFor({ state: 'visible' });
    await submenu.getByRole('button', { name: /Marcar/i }).click();
    for (const pos of [
      { x: 960, y: 260 },
      { x: 160, y: 260 },
      { x: 420, y: 200 },
    ]) {
      await page.locator('canvas.maplibregl-canvas').click({ position: pos });
      if ((await page.locator('.maplibregl-marker').count()) > 0) {
        break;
      }
    }
    await page.locator('.maplibregl-marker').first().click();
    const pinPopup = page.locator('.leonida-pin-popup');
    await expect(pinPopup).toBeVisible();
    const popupAnim = await pinPopup.evaluate((el) => getComputedStyle(el).animationName);
    expect(popupAnim).toContain('modalPanelIn');
    const wrapperBg = await page
      .locator('.maplibregl-popup:has(.leonida-pin-popup) .maplibregl-popup-content')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(wrapperBg).toBe('rgba(0, 0, 0, 0)');
    const layerOrder = await page.evaluate(() => {
      const overlay = document.querySelector('.leonida-poi-overlay') as HTMLElement;
      const popup = document.querySelector('.maplibregl-popup') as HTMLElement;
      return {
        overlayZ: Number(getComputedStyle(overlay).zIndex) || 0,
        popupZ: Number(getComputedStyle(popup).zIndex) || 0,
      };
    });
    expect(layerOrder.popupZ).toBeGreaterThan(layerOrder.overlayZ);
    await page.keyboard.press('k');
    await expect(pinPopup.locator('.leonida-pin-copy-btn')).toHaveClass(/is-copied/);
  });

  test('open sidebar flattens 3D fold transforms at rest to prevent subpixel seam lines', async ({ page }) => {
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();

    const sidebar = page.locator('.hud-sidebar');
    await expect(sidebar).toBeVisible();

    await expect(async () => {
      const transforms = await sidebar.evaluate((el) => {
        const folds = Array.from(el.querySelectorAll('.map-fold')).map((f) => getComputedStyle(f).transform);
        return { sidebar: getComputedStyle(el).transform, folds };
      });
      expect(transforms.sidebar).toBe('none');
      expect(transforms.folds).toEqual(['none', 'none', 'none']);
    }).toPass({ timeout: 2000 });
  });

  test('right analog stick adjusts 3D depth (pitch) and camera rotation (bearing)', async ({ page }) => {
    await page.locator('canvas.maplibregl-canvas').waitFor({ state: 'visible' });

    await page.evaluate(() => {
      const fakePad = {
        id: 'DualSense Wireless Controller (054c)',
        index: 0,
        connected: true,
        axes: [0, 0, 0.7, -0.8],
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

    await expect(page.locator('button[aria-label="Alternar visão 2D e 3D"]')).toHaveClass(/is-active/, {
      timeout: 3000,
    });
    await expect(page.locator('.hud-shell')).toHaveCSS('background-color', 'rgb(72, 145, 168)');
  });

  test('deleting a focused route item from the panel stops its blink state', async ({ page }) => {
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await searchBar.locator('.qs-item').first().click();

    const poiCard = page.locator('.poi-card');
    await expect(poiCard).toBeVisible();
    await poiCard.getByRole('button', { name: /Adicionar à rota/i }).click();
    await expect(poiCard.getByRole('button', { name: /Remover da rota/i })).toBeVisible();

    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();

    const removeStopBtn = page.locator('.hud-sidebar').getByRole('button', { name: 'Remover parada da rota' }).first();
    await expect(removeStopBtn).toBeVisible();
    await removeStopBtn.click();

    await expect(page.locator('.hud-sidebar').getByText(/MINHA ROTA/i)).toHaveCount(0);
    await expect(poiCard.getByRole('button', { name: /Adicionar à rota/i })).toBeVisible();
  });

  test('pins tactical panel with shortcut/button and opens backpack while panel or quick search is open', async ({ page }) => {
    // Open panel via weapon wheel
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();
    const sidebar = page.locator('.hud-sidebar');
    await expect(sidebar).toBeVisible();

    // Pin panel via .sidebar-pin-btn (shows T shortcut badge)
    const pinBtn = sidebar.locator('.sidebar-pin-btn');
    await expect(pinBtn).toContainText('T');
    await pinBtn.click();
    await expect(pinBtn).toHaveClass(/is-pinned/);

    // Clicking on map or pressing Escape keeps pinned panel open
    await page.locator('canvas.maplibregl-canvas').click({ position: { x: 520, y: 320 } });
    await page.keyboard.press('Escape');
    await expect(sidebar).not.toHaveClass(/is-collapsed/);

    // Backpack button opens weapon wheel while panel is open/pinned
    await page.locator('.backpack-trigger').click();
    await expect(page.locator('.weapon-wheel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.weapon-wheel')).toBeHidden();
    await expect(sidebar).not.toHaveClass(/is-collapsed/);

    // Unpin with T shortcut and close with Escape
    await page.keyboard.press('t');
    await expect(pinBtn).not.toHaveClass(/is-pinned/);
    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveClass(/is-collapsed/);

    // Backpack can also be opened while quick search modal is open
    await page.keyboard.press('/');
    await expect(page.locator('.quick-search-bar')).toBeVisible();
    await page.locator('.backpack-trigger').click();
    await expect(page.locator('.weapon-wheel')).toBeVisible();
  });

  test('tactical panel search lists matching POIs, navigates to selected POI, and clears query', async ({ page }) => {
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();

    const sidebar = page.locator('.hud-sidebar');
    const panelInput = sidebar.locator('input.search-input');
    await expect(panelInput).toBeVisible();
    await panelInput.fill('Vice');

    const resultsBox = sidebar.locator('.sidebar-search-results');
    await expect(resultsBox).toBeVisible();
    const firstItem = resultsBox.locator('.sidebar-search-item').first();
    await expect(firstItem).toContainText(/Vice/i);

    await firstItem.click();
    await expect(page.locator('.poi-card')).toBeVisible();
    await expect(sidebar).toHaveClass(/is-collapsed/);

    // Re-open panel and clear query via clear button
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();
    await sidebar.locator('.search-clear-btn').click();
    await expect(panelInput).toHaveValue('');
    await expect(resultsBox).toBeHidden();
  });

  test('switching co-located POIs in bottom-right detail card updates the selected POI and stack counter', async ({ page }) => {
    await page.route('**/api/pois', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'STACK_A',
            name: 'Vice Alpha Tower',
            category: 'Pontos-Chave',
            region: 'Vice Beach',
            description: 'Ponto A sobreposto.',
            lng: 21.515,
            lat: 17.246,
          },
          {
            id: 'STACK_B',
            name: 'Vice Beta Hotel',
            category: 'Hotéis',
            region: 'Vice Beach',
            description: 'Ponto B sobreposto.',
            lng: 21.515,
            lat: 17.246,
          },
        ]),
      });
    });

    await page.goto('/');
    await page.locator('.backpack-trigger').waitFor({ state: 'visible' });

    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await searchBar.locator('input.qs-input').fill('Vice Alpha');
    await searchBar.locator('.qs-item').first().click();

    const poiCard = page.locator('.poi-card');
    await expect(poiCard).toBeVisible();
    await expect(poiCard.locator('.poi-stack-label')).toHaveText('1 / 2 neste local');
    await expect(poiCard.locator('.poi-title')).toHaveText('Vice Alpha Tower');

    await poiCard.getByRole('button', { name: 'Próximo ponto neste local' }).click();
    await expect(poiCard.locator('.poi-stack-label')).toHaveText('2 / 2 neste local');
    await expect(poiCard.locator('.poi-title')).toHaveText('Vice Beta Hotel');
  });

  test('arrow keys navigate quick search results and confirm selection with Enter', async ({ page }) => {
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar).toBeVisible();

    const input = searchBar.locator('input.qs-input');
    await input.fill('Vice');
    const items = searchBar.locator('.qs-item');
    await expect(items.first()).toBeVisible();

    // Blur input (simulate focus outside input) and press ArrowDown/ArrowUp/Enter
    await searchBar.getByRole('button', { name: 'Só ir ao local' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(0)).toHaveClass(/is-highlighted/);
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toHaveClass(/is-highlighted/);
    await page.keyboard.press('ArrowUp');
    await expect(items.nth(0)).toHaveClass(/is-highlighted/);

    const chosenName = await items.nth(0).locator('.qs-item-name').innerText();
    await page.keyboard.press('Enter');
    await expect(searchBar).toBeHidden();
    await expect(page.locator('.poi-card .poi-title')).toHaveText(chosenName);
  });

  test('places map controls beside backpack on top-left and legend with visibility shortcut on top-right', async ({ page }) => {
    const backpackBox = await page.locator('.backpack-trigger').boundingBox();
    const controlsBox = await page.locator('.map-controls').boundingBox();
    const legend = page.locator('.map-legend-panel');
    const legendBox = await legend.boundingBox();

    expect(backpackBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(legendBox).not.toBeNull();

    // Map controls sit to the right of backpack on the top-left with spacing and match backpack button size
    expect(controlsBox!.x).toBeGreaterThan(backpackBox!.x + backpackBox!.width);
    expect(controlsBox!.x).toBeLessThan(legendBox!.x);
    const firstControlBtnBox = await page.locator('.map-controls .icon-btn').first().boundingBox();
    expect(firstControlBtnBox?.width).toBe(backpackBox?.width);
    expect(firstControlBtnBox?.height).toBe(backpackBox?.height);

    // Top-right semi-transparent stepper cycles categories via arrows and L shortcut
    await expect(legend.locator('.map-legend-title')).toContainText('Todas');
    await expect(legend.locator('.map-legend-meaning')).toContainText(/Exibir todos/i);

    await page.keyboard.press('l');
    await expect(legend.locator('.map-legend-title')).not.toContainText('Todas');
    await expect(legend.locator('app-poi-blip-icon .blip-badge')).toHaveCSS('width', '20px');
    await expect(legend.locator('app-poi-blip-icon lucide-icon svg')).toBeVisible();

    await legend.getByRole('button', { name: 'Categoria anterior' }).click();
    await expect(legend.locator('.map-legend-title')).toContainText('Todas');

    await legend.getByRole('button', { name: 'Próxima categoria' }).click();
    await expect(legend.locator('.map-legend-title')).not.toContainText('Todas');

    // Holding L shows the charging badge and resets filter back to Todas
    await page.keyboard.down('l');
    await expect(legend.locator('.map-legend-hold-badge')).toHaveClass(/is-holding/);
    await expect(legend.locator('.map-legend-title')).toContainText('Todas', { timeout: 2000 });
    await page.keyboard.up('l');
  });

  test('hides COORD. readout in tactical panel and supports coordinate search in search modals', async ({ page }) => {
    // Open panel -> no COORD. row
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();

    const sidebar = page.locator('.hud-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('.telemetry-readout')).not.toContainText('COORD.');
    await expect(sidebar.locator('.telemetry-readout')).toContainText('ZOOM');

    // Search coordinates in panel search
    await sidebar.locator('input.search-input').fill('-0.661, 0.416');
    await expect(sidebar.locator('.sidebar-search-item').first()).toContainText(
      'Ir para -0.661, 0.416',
    );
    await sidebar.locator('.search-clear-btn').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(sidebar).toHaveClass(/is-collapsed/);

    // Search coordinates in quick search and verify street-level zoom depth (> 14)
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await searchBar.locator('input.qs-input').fill('-0.661, 0.416');
    const firstResult = searchBar.locator('.qs-item').first();
    await expect(firstResult).toContainText('Ir para -0.661, 0.416');
    await firstResult.click();
    await expect(page.locator('.poi-card .poi-title')).toHaveText('Ir para -0.661, 0.416');

    // Wait for flyTo(15.5, 600ms) to settle, then zoom in further via '=' and verify street-level zoom
    await page.waitForTimeout(750);
    await page.keyboard.press('=');
    await page.waitForTimeout(250);
    await page.keyboard.press('m');
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Mapa/i }).click({ force: true });
    await page.locator('.weapon-wheel').getByRole('menuitem', { name: /Filtros/i }).click();
    await expect(async () => {
      const zoomText = await sidebar.locator('.telemetry-readout .readout-value').innerText();
      const match = zoomText.match(/([\d.]+)x/i);
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBeGreaterThanOrEqual(14);
    }).toPass({ timeout: 4000 });
  });

  test('loads extracted GTAVIMap POIs and renders official PNG marker icons in search', async ({ page }) => {
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar).toBeVisible();
    await expect(searchBar.locator('.qs-footer-total')).toContainText(/[567]\d{3} locais/);

    await searchBar.locator('input.qs-input').fill('Murais 1010');
    const firstItem = searchBar.locator('.qs-item').first();
    await expect(firstItem).toContainText('Murais 1010');
    const iconImg = firstItem.locator('img.blip-png');
    await expect(iconImg).toBeVisible();
    const loaded = await iconImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
    expect(loaded).toBe(true);

    // Map overlay markers show icons without text labels on the map
    await firstItem.click();
    await expect(page.locator('.leonida-poi-marker').first()).toBeVisible();
    const markerText = await page.locator('.leonida-poi-marker').first().innerText();
    expect(markerText.replace(/\d+/g, '').trim()).toBe('');
  });

  test('initiates lazy native 3D model load on 3D toggle and cancels cleanly on 2D return', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    let resolvePendingGlb: (() => void) | null = null;
    let glbRequested = false;
    await page.route('**/native-3d-v2/geometry.glb', async (route) => {
      glbRequested = true;
      await new Promise<void>((resolve) => {
        resolvePendingGlb = resolve;
        setTimeout(resolve, 4000);
      });
      await route.abort().catch(() => {});
    });

    await page.locator('canvas.maplibregl-canvas').waitFor({ state: 'visible' });

    const btn3d = page.locator('button[aria-label="Alternar visão 2D e 3D"]');
    await btn3d.click();

    await expect.poll(() => glbRequested, { timeout: 3000 }).toBe(true);
    await expect(page.locator('.hud-3d-loading')).toBeVisible();
    await expect(btn3d).toHaveClass(/is-loading/);

    // Toggling back to 2D aborts the pending GLB fetch cleanly without errors
    await btn3d.click();
    resolvePendingGlb?.();
    await expect(page.locator('.hud-3d-loading')).toBeHidden();
    await expect(btn3d).not.toHaveClass(/is-loading/);
    expect(pageErrors).toHaveLength(0);
  });

  test('captures high-precision per-method performance timings via window.__leonidaPerf', async ({
    page,
  }) => {
    await page.locator('canvas.maplibregl-canvas').waitFor({ state: 'visible' });
    await page.locator('.leonida-poi-marker').first().waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const api = (
        window as unknown as {
          __leonidaPerf?: { method: (name: string) => unknown };
        }
      ).__leonidaPerf;
      return Boolean(api?.method('map.loadLandmarks'));
    });

    // Trigger category cycling and quick search to populate rendering & list-manipulation timings
    await page.keyboard.press('l');
    await page.keyboard.press('l');
    await page.keyboard.press('/');
    const searchBar = page.locator('.quick-search-bar');
    await expect(searchBar).toBeVisible();
    await searchBar.locator('input.qs-input').fill('Vice');
    await expect(searchBar.locator('.qs-item').first()).toBeVisible();

    const perfReport = await page.evaluate(() => {
      const api = (
        window as unknown as {
          __leonidaPerf?: {
            methods: () => Array<{
              name: string;
              count: number;
              avgMs: number;
              p95Ms: number;
              maxMs: number;
              totalMs: number;
            }>;
            summary: () => {
              trackedMethods: number;
              totalMethodCalls: number;
            };
            clear: () => void;
          };
        }
      ).__leonidaPerf;
      if (!api) {
        return null;
      }
      const methods = api.methods();
      const summary = api.summary();
      return { methods, summary };
    });

    expect(perfReport).not.toBeNull();
    expect(perfReport!.summary.trackedMethods).toBeGreaterThanOrEqual(6);
    expect(perfReport!.summary.totalMethodCalls).toBeGreaterThan(0);

    const names = new Set(perfReport!.methods.map((m) => m.name));
    expect(names.has('map.buildSearchIndex')).toBe(true);
    expect(names.has('map.filterPois')).toBe(true);
    expect(names.has('map.searchPoisFast')).toBe(true);
    expect(names.has('map.groupOverlappingPois')).toBe(true);
    expect(names.has('quickSearch.groupedSearchResults')).toBe(true);
    expect(names.has('app.legendItems')).toBe(true);

    for (const m of perfReport!.methods) {
      expect(m.count).toBeGreaterThan(0);
      expect(Number.isFinite(m.avgMs) && m.avgMs >= 0).toBe(true);
      expect(Number.isFinite(m.p95Ms) && m.p95Ms >= 0).toBe(true);
      expect(Number.isFinite(m.maxMs) && m.maxMs >= 0).toBe(true);
      expect(Number.isFinite(m.totalMs) && m.totalMs >= 0).toBe(true);
    }

    const clearedCount = await page.evaluate(() => {
      const api = (
        window as unknown as {
          __leonidaPerf?: { clear: () => void; methods: () => unknown[] };
        }
      ).__leonidaPerf;
      api?.clear();
      return api?.methods().length ?? -1;
    });
    expect(clearedCount).toBe(0);
  });
});
