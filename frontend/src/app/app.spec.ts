import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { LEONIDA_POIS } from './core/data/leonida-map.data';
import { createCustomPinPopupContent } from './core/services/custom-pin-popup.helper';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('MAPA TÁTICO');
  });

  it('ignores window pointermove when gamepad is disconnected and syncs live coordinates with sidebar state', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const cursorSpy = jest.spyOn(app.gamepadService, 'setCursorPosition');
    const liveCoordsSpy = jest.spyOn(app.mapService, 'setLiveCoordinatesEnabled');

    await fixture.whenStable();
    expect(liveCoordsSpy).toHaveBeenCalledWith(false);

    const evt = new Event('pointermove') as PointerEvent;
    Object.defineProperty(evt, 'pointerType', { value: 'mouse' });
    Object.defineProperty(evt, 'clientX', { value: 250 });
    Object.defineProperty(evt, 'clientY', { value: 180 });
    window.dispatchEvent(evt);
    expect(cursorSpy).not.toHaveBeenCalled();

    app.sidebarOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(liveCoordsSpy).toHaveBeenCalledWith(true);

    app.sidebarOpen.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(liveCoordsSpy).toHaveBeenLastCalledWith(false);
  });

  it('renders .poi-card when a POI is selected and tags custom pin popups with .leonida-pin-popup', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();

    app.mapService.selectedPoi.set(LEONIDA_POIS[0]);
    fixture.detectChanges();
    await fixture.whenStable();

    const poiCard = (fixture.nativeElement as HTMLElement).querySelector('.poi-card');
    expect(poiCard).not.toBeNull();

    const popupEl = createCustomPinPopupContent(
      {
        id: 'pin-1',
        title: 'Pin Teste',
        notes: '',
        lng: 0,
        lat: 0,
        color: '#38BDF8',
        iconType: 'pin',
        createdAt: new Date().toISOString(),
      },
      { onUpdate: jest.fn(), onRemove: jest.fn(), onClose: jest.fn() },
    );
    expect(popupEl.classList.contains('leonida-pin-popup')).toBe(true);
    const copyBtn = popupEl.querySelector('.leonida-pin-copy-btn') as HTMLButtonElement | null;
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.textContent).toContain('K');
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    copyBtn?.click();
    expect(writeTextMock).toHaveBeenCalledWith('0.000, 0.000');
    expect(copyBtn?.classList.contains('is-copied')).toBe(true);

    // Fallback when navigator.clipboard is unavailable (e.g. non-HTTPS LAN origin)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execCommandMock = jest.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommandMock,
    });
    copyBtn?.click();
    expect(execCommandMock).toHaveBeenCalledWith('copy');

    app.sidebarOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const sidebarEl = (fixture.nativeElement as HTMLElement).querySelector('.hud-sidebar');
    expect(sidebarEl?.classList.contains('is-collapsed')).toBe(false);

    app.gamepadService.connected.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const cursorHtml = (fixture.nativeElement as HTMLElement).querySelector('.gamepad-cursor svg')?.innerHTML ?? '';
    expect(cursorHtml).toContain('#F44E8F');
    expect(cursorHtml).toContain('#FFB458');
  });

  it('pins the tactical panel with shortcut/button and allows opening the backpack while panel or modals are open', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();

    app.sidebarOpen.set(true);
    app.toggleSidebarPin();
    fixture.detectChanges();

    expect(app.sidebarPinned()).toBe(true);
    const pinBtn = (fixture.nativeElement as HTMLElement).querySelector('.sidebar-pin-btn');
    expect(pinBtn?.classList.contains('is-pinned')).toBe(true);

    // Outside click and Escape keep pinned panel open
    app.onDocumentClick(new MouseEvent('click'));
    app.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(app.sidebarOpen()).toBe(true);

    // Backpack (weapon wheel) can be opened while panel is open/pinned
    app.toggleSidebar();
    expect(app.wheelOpen()).toBe(true);
    expect(app.sidebarOpen()).toBe(true);

    // Backpack can also be opened while quick search modal is open
    app.wheelOpen.set(false);
    app.quickSearchOpen.set(true);
    app.toggleSidebar();
    expect(app.wheelOpen()).toBe(true);
    expect(app.quickSearchOpen()).toBe(false);
  });

  it('filters and selects POI results from the tactical panel search box', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const flySpy = jest.spyOn(app.mapService, 'flyToPoi').mockImplementation(() => {});
    await fixture.whenStable();

    app.sidebarOpen.set(true);
    app.onSearchInput({ target: { value: 'Vice' } } as unknown as Event);
    fixture.detectChanges();

    const results = app.sidebarSearchResults();
    expect(results.length).toBeGreaterThan(0);
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar-search-item');
    expect(items.length).toBe(results.length);

    app.selectSidebarSearchResult(results[0]);
    expect(flySpy).toHaveBeenCalledWith(results[0], true);
    expect(app.sidebarOpen()).toBe(false);

    app.clearSidebarSearch();
    fixture.detectChanges();
    expect(app.searchQuery()).toBe('');
    expect(app.sidebarSearchResults()).toHaveLength(0);
  });

  it('renders map legend categories with meanings and cycles POI visibility with L shortcut', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const filterSpy = jest.spyOn(app.mapService, 'filterPois');
    await fixture.whenStable();

    const legendPanel = (fixture.nativeElement as HTMLElement).querySelector('.map-legend-panel');
    expect(legendPanel).not.toBeNull();
    expect(legendPanel?.querySelector('.map-legend-stepper')).not.toBeNull();

    const firstRealCategory = app.mapService.groupedPoisByCategory()[0]?.category;
    expect(firstRealCategory).toBeTruthy();
    expect(app.selectedCategory()).toBe('Todas');
    app.onKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
    expect(app.selectedCategory()).toBe(firstRealCategory);
    expect(filterSpy).toHaveBeenCalledWith('', firstRealCategory);
    expect(app.mapService.visiblePoisCount()).toBeGreaterThan(0);

    app.cyclePoiCategoryVisibility(-1);
    expect(app.selectedCategory()).toBe('Todas');

    // Holding L starts charging and resets back to Todas after hold duration
    app.onKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
    expect(app.selectedCategory()).toBe(firstRealCategory);
    app.onKeyUp(new KeyboardEvent('keyup', { key: 'l' }));
    expect(app.legendHoldProgress()).toBe(0);

    app.selectCategory('Ocultos');
    expect(app.mapService.visiblePoisCount()).toBe(0);

    // Panel does not show COORD. readout row and supports coordinate search
    const sidebarText =
      (fixture.nativeElement as HTMLElement).querySelector('.hud-sidebar')?.textContent ?? '';
    expect(sidebarText).not.toContain('COORD.');
    app.selectCategory('Todas');
    app.onSearchInput({ target: { value: '21.515, 17.246' } } as unknown as Event);
    expect(app.sidebarSearchResults()[0]?.name).toBe('Ir para 21.515, 17.246');
  });
});
