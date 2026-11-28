import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Gamepad2,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Minus,
  Pin,
  PinOff,
  Plus,
  Search,
  X,
  LucideAngularModule,
} from 'lucide-angular';
import { LeonidaPoi, POI_CATEGORIES } from './core/data/leonida-map.data';
import { DpadDirection, GamepadService } from './core/services/gamepad.service';
import { MapService } from './core/services/map.service';
import { PlatformContextService } from './core/services/platform-context.service';
import { TelemetryService } from './core/services/telemetry.service';
import { HudConsoleBarComponent } from './features/hud/hud-console-bar.component';
import { HudDesktopBarComponent } from './features/hud/hud-desktop-bar.component';
import { HudMobileDialComponent } from './features/hud/hud-mobile-dial.component';
import { QuickSearchComponent } from './features/hud/quick-search.component';
import { WeaponWheelComponent, WheelAction } from './features/hud/weapon-wheel.component';
import { PoiBlipIconComponent } from './shared/components/poi-blip-icon.component';
import { ShortcutKeyBadgeComponent } from './shared/components/shortcut-key-badge.component';

@Component({
  selector: 'app-root',
  imports: [
    LucideAngularModule,
    HudDesktopBarComponent,
    HudMobileDialComponent,
    HudConsoleBarComponent,
    QuickSearchComponent,
    WeaponWheelComponent,
    PoiBlipIconComponent,
    ShortcutKeyBadgeComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements AfterViewInit, OnDestroy {
  readonly mapService = inject(MapService);
  readonly gamepadService = inject(GamepadService);
  readonly platform = inject(PlatformContextService);
  private readonly telemetry = inject(TelemetryService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  constructor() {
    effect(() => {
      this.mapService.setLiveCoordinatesEnabled(this.sidebarOpen());
    });
  }

  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  @ViewChild('searchInput')
  private readonly searchInput?: ElementRef<HTMLInputElement>;

  @ViewChild(QuickSearchComponent)
  private readonly quickSearch?: QuickSearchComponent;

  readonly isMobile = signal(
    typeof window !== 'undefined' ? window.innerWidth <= 767 : false
  );
  readonly wheelOpen = signal(false);
  readonly activePanel = signal<'map' | 'filters' | null>(null);
  readonly sidebarOpen = signal(false);
  readonly quickSearchOpen = signal(false);
  readonly cinemaMode = signal(false);
  readonly isFullscreen = signal(false);
  readonly quickSearchHideOthers = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem('leonida_qs_hide_others') === 'true',
  );
  readonly searchQuery = signal('');
  readonly sidebarPinned = signal(false);
  readonly sidebarSearchIndex = signal(-1);
  readonly legendHoldProgress = signal(0);
  private legendHoldRaf: number | null = null;
  private legendHoldStart = 0;
  private readonly legendHoldDurationMs = 550;
  readonly clickBursts = signal<{ id: number; x: number; y: number }[]>([]);
  private burstId = 0;
  readonly quickCategories = POI_CATEGORIES;
  readonly selectedCategory = signal<string>('Todas');
  readonly sidebarSearchResults = computed(() => {
    const q = this.searchQuery().trim();
    return q ? this.mapService.searchPoisFast(q, this.selectedCategory(), 12) : [];
  });
  readonly legendItems = computed<
    ReadonlyArray<{ category: string; meaning: string; count: number }>
  >(() =>
    this.telemetry.measure(
      'app.legendItems',
      () => {
        const dynamicGroups = this.mapService.groupedPoisByCategory();
        return [
          {
            category: 'Todas',
            meaning: 'Exibir todos os pontos no mapa',
            count: this.mapService.totalPoisCount(),
          },
          ...dynamicGroups.map((group) => ({
            category: group.category,
            meaning: this.getCategoryMeaning(group.category),
            count: group.items.length,
          })),
          { category: 'Ocultos', meaning: 'Ocultar pontos de referência', count: 0 },
        ];
      },
      (items) => ({ count: items.length }),
      6,
    ),
  );
  readonly activeLegendItem = computed(
    () =>
      this.legendItems().find((item) => item.category === this.selectedCategory()) ??
      this.legendItems()[0],
  );

  readonly icons = {
    Box,
    ChevronLeft,
    ChevronRight,
    Compass,
    Crosshair,
    Eye,
    EyeOff,
    Gamepad2,
    Layers,
    LocateFixed,
    MapPin,
    Maximize2,
    Minus,
    Pin,
    PinOff,
    Plus,
    Search,
    X,
  };

  ngAfterViewInit(): void {
    this.mapService.initMap(this.mapContainer.nativeElement);
    this.gamepadService.init({
      onFocusSearch: () => this.focusSearch(),
      onToggleCinema: () => this.toggleCinemaMode(),
      onToggleSidebar: () => this.toggleSidebar(),
      onBack: () => this.closeActiveOverlay(),
      onContextualAction: () => this.handleContextualGamepadAction(),
      onCreatePin: () => this.createCustomPinAtGamepadCursor(),
      onToggle3D: () => this.handleToggle3DShortcut(),
      onPrevCategoryPage: () => this.quickSearchOpen() && this.quickSearch?.scrollCategories(-1),
      onNextCategoryPage: () => this.quickSearchOpen() && this.quickSearch?.scrollCategories(1),
      onResetView: () => this.handleResetViewShortcut(),
      isModalOpen: () =>
        this.quickSearchOpen() ||
        this.wheelOpen() ||
        this.sidebarOpen() ||
        Boolean(document.querySelector('.maplibregl-popup')),
      onStepFocus: (dir) => this.stepGamepadFocus(dir),
      onCursorClick: (x, y) => this.triggerGamepadClick(x, y),
    });
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.runOutsideAngular(() => {
        window.addEventListener('pointermove', this.onWindowPointerMove, { passive: true });
      });
    }
  }

  ngOnDestroy(): void {
    this.cancelLegendHold();
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('pointermove', this.onWindowPointerMove);
    }
    this.gamepadService.destroy();
    this.mapService.destroy();
  }

  toggleSidebar(): void {
    if (this.quickSearchOpen()) {
      this.quickSearchOpen.set(false);
    }
    this.wheelOpen.update((v) => !v);
  }

  toggleSidebarPin(): void {
    const next = !this.sidebarPinned();
    this.sidebarPinned.set(next);
    if (next && !this.sidebarOpen()) {
      this.sidebarOpen.set(true);
    }
  }

  onWheelSelect(action: WheelAction): void {
    this.wheelOpen.set(false);
    switch (action) {
      case 'map':
        this.quickSearchOpen.set(false);
        this.cinemaMode.set(false);
        this.activePanel.set('map');
        this.sidebarOpen.set(true);
        setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
        break;
      case 'filters':
        this.quickSearchOpen.set(false);
        this.activePanel.set('filters');
        this.sidebarOpen.set(true);
        break;
      case '3d':
        this.mapService.toggle3D();
        break;
      case 'cinema':
        this.toggleCinemaMode();
        break;
      case 'center':
        this.mapService.resetView();
        break;
      case 'pin':
        this.mapService.togglePinMode();
        break;
      case 'clear-pins':
        this.mapService.clearCustomPins();
        break;
    }
  }

  toggleCinemaMode(): void {
    if (this.quickSearchOpen()) {
      this.quickSearch?.focusInput();
      return;
    }
    this.cinemaMode.update((v) => !v);
  }

  focusSearch(): void {
    this.cinemaMode.set(false);
    this.wheelOpen.set(false);
    if (this.sidebarOpen()) {
      this.quickSearchOpen.set(false);
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
      return;
    }
    if (this.quickSearchOpen()) {
      this.quickSearchOpen.set(false);
      return;
    }
    this.quickSearchOpen.set(true);
    setTimeout(() => this.quickSearch?.focusInput(), 0);
  }

  closeActiveOverlay(): void {
    if (this.cinemaMode()) {
      this.cinemaMode.set(false);
    } else if (this.wheelOpen()) {
      this.wheelOpen.set(false);
    } else if (this.quickSearchOpen()) {
      this.quickSearchOpen.set(false);
    } else if (this.mapService.selectedPoi()) {
      this.mapService.selectedPoi.set(null);
    } else if ((this.sidebarOpen() || this.activePanel() !== null) && !this.sidebarPinned()) {
      this.activePanel.set(null);
      this.sidebarOpen.set(false);
    } else {
      this.mapService.closeAllCustomPinPopups();
    }
  }

  handleContextualGamepadAction(): void {
    if (this.quickSearchOpen()) {
      this.quickSearch?.toggleActiveGroupExpand();
      return;
    }
    if (
      this.wheelOpen() ||
      this.sidebarOpen() ||
      Boolean(document.querySelector('.maplibregl-popup'))
    ) {
      return;
    }
    const selected = this.mapService.selectedPoi();
    if (selected) {
      this.mapService.togglePoiMark(selected);
      return;
    }
    this.mapService.togglePinMode();
  }

  handleToggle3DShortcut(): void {
    if (this.quickSearchOpen()) {
      this.quickSearch?.toggleHideOthers();
      return;
    }
    this.mapService.toggle3D();
  }

  handleResetViewShortcut(): void {
    if (this.quickSearchOpen() || this.wheelOpen() || this.sidebarOpen()) {
      return;
    }
    this.mapService.resetView();
  }

  createCustomPinAtGamepadCursor(): void {
    this.mapService.addCustomPinAtScreen(
      this.gamepadService.cursorX(),
      this.gamepadService.cursorY(),
    );
  }

  stepGamepadFocus(direction: DpadDirection): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.telemetry.measure(
      'app.stepGamepadFocus',
      () => {
        const hasModalOpen =
          this.quickSearchOpen() ||
          this.wheelOpen() ||
          Boolean(document.querySelector('.maplibregl-popup')) ||
          Boolean(this.mapService.selectedPoi()) ||
          this.sidebarOpen();

        if (!hasModalOpen) {
          this.stepMapTargetFocus(direction);
          return;
        }

        const scopeSelector = this.quickSearchOpen()
          ? '.quick-search-bar'
          : this.wheelOpen()
            ? document.querySelector('.pin-submenu')
              ? '.pin-submenu'
              : '.weapon-wheel'
            : document.querySelector('.maplibregl-popup')
              ? '.maplibregl-popup'
              : this.sidebarOpen()
                ? '.hud-sidebar:not(.is-collapsed)'
                : '.poi-card';

        const root = document.querySelector(scopeSelector) ?? document;
        const candidates = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        });

        if (candidates.length === 0) {
          return;
        }

        const active =
          (root.querySelector('.gamepad-focus') as HTMLElement | null) ??
          (document.activeElement as HTMLElement | null);
        let target: HTMLElement | null = null;

        if (!active || !candidates.includes(active)) {
          target =
            direction === 'up' || direction === 'left'
              ? candidates[candidates.length - 1]
              : candidates[0];
        } else {
          const origin = active.getBoundingClientRect();
          const ox = origin.left + origin.width / 2;
          const oy = origin.top + origin.height / 2;

          let bestScore = Number.POSITIVE_INFINITY;
          for (const el of candidates) {
            if (el === active) {
              continue;
            }
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            let valid = false;
            let primary = 0;
            let secondary = 0;
            let aligned = false;

            if (direction === 'down') {
              valid = cy > oy + 4;
              primary = cy - oy;
              secondary = Math.abs(cx - ox);
              aligned = Math.min(origin.right, rect.right) - Math.max(origin.left, rect.left) > 0;
            } else if (direction === 'up') {
              valid = cy < oy - 4;
              primary = oy - cy;
              secondary = Math.abs(cx - ox);
              aligned = Math.min(origin.right, rect.right) - Math.max(origin.left, rect.left) > 0;
            } else if (direction === 'right') {
              valid = cx > ox + 4;
              primary = cx - ox;
              secondary = Math.abs(cy - oy);
              aligned = Math.min(origin.bottom, rect.bottom) - Math.max(origin.top, rect.top) > 0;
            } else {
              valid = cx < ox - 4;
              primary = ox - cx;
              secondary = Math.abs(cy - oy);
              aligned = Math.min(origin.bottom, rect.bottom) - Math.max(origin.top, rect.top) > 0;
            }

            if (!valid) {
              continue;
            }

            if ((direction === 'left' || direction === 'right') && !aligned) {
              continue;
            }

            const score = primary + (aligned ? secondary * 0.25 : secondary * 2.5);
            if (score < bestScore) {
              bestScore = score;
              target = el;
            }
          }
        }

        if (!target) {
          return;
        }

        for (const prev of Array.from(document.querySelectorAll('.gamepad-focus'))) {
          prev.classList.remove('gamepad-focus');
        }
        target.classList.add('gamepad-focus');
        target.focus({ preventScroll: false });
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });

        const rect = target.getBoundingClientRect();
        this.gamepadService.setCursorPosition(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          true,
        );
      },
      { direction },
      8,
    );
  }

  private stepMapTargetFocus(direction: DpadDirection): void {
    this.telemetry.measure(
      'app.stepMapTargetFocus',
      () => {
        const targets = this.mapService.getVisibleMapTargets();
        if (targets.length === 0) {
          return;
        }

        const ox = this.gamepadService.cursorX();
        const oy = this.gamepadService.cursorY();
        let best: { x: number; y: number } | null = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const t of targets) {
          const dx = t.x - ox;
          const dy = t.y - oy;
          if (Math.hypot(dx, dy) < 6) {
            continue;
          }

          let valid = false;
          let primary = 0;
          let secondary = 0;
          if (direction === 'down') {
            valid = dy > 6;
            primary = dy;
            secondary = Math.abs(dx);
          } else if (direction === 'up') {
            valid = dy < -6;
            primary = -dy;
            secondary = Math.abs(dx);
          } else if (direction === 'right') {
            valid = dx > 6;
            primary = dx;
            secondary = Math.abs(dy);
          } else {
            valid = dx < -6;
            primary = -dx;
            secondary = Math.abs(dy);
          }

          if (!valid) {
            continue;
          }
          const score = primary + secondary * 1.4;
          if (score < bestScore) {
            bestScore = score;
            best = t;
          }
        }

        if (!best) {
          // Fallback: snap to nearest visible POI/pin if cursor isn't near any in that direction
          let nearestDist = Number.POSITIVE_INFINITY;
          for (const t of targets) {
            const d = Math.hypot(t.x - ox, t.y - oy);
            if (d > 6 && d < nearestDist) {
              nearestDist = d;
              best = t;
            }
          }
        }

        if (best) {
          this.gamepadService.setCursorPosition(best.x, best.y, false);
        }
      },
      { direction },
      8,
    );
  }

  toggleFullscreen(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => this.isFullscreen.set(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => this.isFullscreen.set(false)).catch(() => {});
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.sidebarSearchIndex.set(-1);
    this.searchQuery.set(target.value);
    this.mapService.filterPois(target.value, this.selectedCategory());
  }

  clearSidebarSearch(): void {
    this.sidebarSearchIndex.set(-1);
    this.searchQuery.set('');
    this.mapService.filterPois('', this.selectedCategory());
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  onSidebarSearchKeyDown(event: KeyboardEvent): void {
    const results = this.sidebarSearchResults();
    if (event.key === 'ArrowDown') {
      if (results.length === 0) return;
      event.preventDefault();
      this.sidebarSearchIndex.update((i) => (i + 1) % results.length);
      if (typeof document !== 'undefined') {
        setTimeout(() => {
          document
            .querySelector('.hud-sidebar .sidebar-search-item.is-highlighted')
            ?.scrollIntoView({ block: 'nearest' });
        }, 0);
      }
    } else if (event.key === 'ArrowUp') {
      if (results.length === 0) return;
      event.preventDefault();
      this.sidebarSearchIndex.update((i) => (i <= 0 ? results.length - 1 : i - 1));
      if (typeof document !== 'undefined') {
        setTimeout(() => {
          document
            .querySelector('.hud-sidebar .sidebar-search-item.is-highlighted')
            ?.scrollIntoView({ block: 'nearest' });
        }, 0);
      }
    } else if (event.key === 'Enter') {
      if (results.length === 0) return;
      event.preventDefault();
      const idx = this.sidebarSearchIndex();
      const target = idx >= 0 && idx < results.length ? results[idx] : results[0];
      this.selectSidebarSearchResult(target);
    } else if (event.key === 'Escape' && this.searchQuery().length > 0) {
      event.preventDefault();
      event.stopPropagation();
      this.clearSidebarSearch();
    }
  }

  selectSidebarSearchResult(poi: LeonidaPoi): void {
    this.mapService.flyToPoi(poi, true);
    if (!this.sidebarPinned()) {
      this.sidebarOpen.set(false);
    }
  }

  onQuickSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.mapService.filterPois(this.quickSearchHideOthers() ? value : '', this.selectedCategory());
  }

  onQuickSearchHideOthersChange(hide: boolean): void {
    this.quickSearchHideOthers.set(hide);
    this.mapService.filterPois(hide ? this.searchQuery() : '', this.selectedCategory());
  }

  selectQuickSearchResult(poi: LeonidaPoi): void {
    if (this.quickSearchHideOthers()) {
      this.mapService.isolatePoi(poi);
    }
    this.mapService.flyToPoi(poi, !this.quickSearchHideOthers());
    this.quickSearchOpen.set(false);
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
    this.mapService.filterPois(this.searchQuery(), category);
  }

  cyclePoiCategoryVisibility(delta: 1 | -1 = 1): void {
    const order = this.legendItems().map((item) => item.category);
    const currentIdx = order.indexOf(this.selectedCategory());
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextCategory = order[(safeIdx + delta + order.length) % order.length];
    this.selectCategory(nextCategory);
  }

  private getCategoryMeaning(category: string): string {
    const norm = category
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const meanings: Record<string, string> = {
      'bares, cafes e lazer': 'Vida noturna, bares e cafés',
      'cartas colecionaveis': 'Cartas colecionáveis no mapa',
      'lojas e comercio': 'Comércios, lojas e serviços',
      lojas: 'Comércios, lojas e serviços',
      'missoes da historia': 'Missões principais da campanha',
      'veiculos e oficinas': 'Garagens, oficinas e veículos',
      'pontos de referencia': 'Marcos, praias e pontos turísticos',
      'pontos-chave': 'Marcos, praias e pontos turísticos',
      'easter eggs': 'Segredos e referências ocultas',
      'transporte, aeroportos e marinas': 'Aeroportos, portos e estações',
      transporte: 'Aeroportos, portos e estações',
      'missoes secundarias': 'Atividades e missões extras',
      'revistas colecionaveis': 'Revistas colecionáveis no mapa',
      'hoteis e resorts': 'Hotéis, resorts e hospedagens',
      hoteis: 'Hotéis, resorts e hospedagens',
      'bancos e financeiras': 'Agências bancárias e cofres',
      'fragmentos de meteorito': 'Fragmentos raros de meteorito',
      'monumentos waink': 'Monumentos e estátuas locais',
      'servicos e bem-estar': 'Clínicas, saúde e bem-estar',
      'policia e bombeiros': 'Delegacias e quartéis',
      flamingos: 'Avistamentos e colecionáveis',
      'crimes e assaltos': 'Ocorrências e alvos de assalto',
      'pontos de meditacao': 'Áreas de meditação e descanso',
      armas: 'Lojas e pontos de armamento',
      'armas unicas': 'Armas raras e especiais',
      esconderijos: 'Abrigos e safehouses',
      acessiveis: 'Locais e entradas acessíveis',
      eventos: 'Eventos, shows e atividades',
      natureza: 'Parques, trilhas e reservas',
      'saltos e acrobacias': 'Rampas de salto e acrobacias aéreas',
      'atividades e esportes': 'Esportes, corridas, pesca e lazer',
      'operacoes ilegais': 'Operações e contratos ilegais',
      'veiculos especiais': 'Spawns de veículos raros e especiais',
    };
    return meanings[norm] ?? 'Pontos desta categoria no mapa';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.sidebarOpen() || this.sidebarPinned()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (
      target.closest('.map-paper-stage') ||
      target.closest('.backpack-trigger') ||
      target.closest('.mobile-dial')
    ) {
      return;
    }
    this.sidebarOpen.set(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile.set(window.innerWidth <= 767);
    }
  }

  private spawnBurst(x: number, y: number): void {
    const id = ++this.burstId;
    this.clickBursts.update((list) => [...list, { id, x, y }]);
    setTimeout(() => {
      this.clickBursts.update((list) => list.filter((b) => b.id !== id));
    }, 320);
  }

  triggerGamepadClick(x: number, y: number): void {
    this.spawnBurst(x, y);
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) {
      return;
    }

    if (this.quickSearchOpen() && !el.closest('.quick-search-bar')) {
      this.quickSearchOpen.set(false);
    }

    if (el.classList.contains('maplibregl-canvas') || el.closest('.maplibregl-marker')) {
      this.mapService.handleScreenClick(x, y);
      return;
    }

    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      }),
    );
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
    }
  }

  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    if (!this.gamepadService.connected() || event.pointerType !== 'mouse') {
      return;
    }
    const overControl = Boolean(
      (event.target as HTMLElement | null)?.closest(
        'button, input, textarea, select, a, [role="button"]',
      ),
    );
    this.ngZone.run(() => {
      this.gamepadService.setCursorPosition(event.clientX, event.clientY, overControl);
    });
  };

  @HostListener('window:pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    this.spawnBurst(event.clientX, event.clientY);
    if (
      this.quickSearchOpen() &&
      !(event.target as HTMLElement | null)?.closest('.quick-search-bar')
    ) {
      this.quickSearchOpen.set(false);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement | null)?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (event.key === 'Escape') {
      if (this.cinemaMode()) {
        this.cinemaMode.set(false);
      } else if (this.wheelOpen()) {
        this.wheelOpen.set(false);
      } else if (this.quickSearchOpen()) {
        this.quickSearchOpen.set(false);
      } else if (isInput) {
        (event.target as HTMLElement).blur();
      } else if (!this.sidebarPinned()) {
        this.activePanel.set(null);
        this.sidebarOpen.set(false);
      }
      return;
    }

    if (isInput) {
      return;
    }

    if (this.quickSearchOpen()) {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        this.quickSearch?.focusInput();
        return;
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        this.quickSearch?.toggleActiveGroupExpand();
        return;
      }
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        this.quickSearch?.toggleHideOthers();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        this.quickSearch?.cycleTab();
        return;
      }
      if (
        (event.key === 'ArrowDown' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'Enter') &&
        !(event.target as HTMLElement | null)?.closest('.quick-search-bar')
      ) {
        this.quickSearch?.onKeyDown(event);
        return;
      }
    }

    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.focusSearch();
    } else if (event.key.toLowerCase() === 'm') {
      this.toggleSidebar();
    } else if (event.key.toLowerCase() === 't') {
      this.toggleSidebarPin();
    } else if (event.key.toLowerCase() === 'l') {
      if (event.repeat) {
        return;
      }
      this.cyclePoiCategoryVisibility(1);
      this.startLegendHold();
    } else if (event.key.toLowerCase() === 'k') {
      const copyBtn = document.querySelector(
        '.leonida-pin-popup .leonida-pin-copy-btn',
      ) as HTMLButtonElement | null;
      copyBtn?.click();
    } else if (event.key.toLowerCase() === 'h') {
      this.toggleCinemaMode();
    } else if (event.key.toLowerCase() === 'f') {
      this.toggleFullscreen();
    } else if (event.key === '3') {
      this.mapService.toggle3D();
    } else if (event.key.toLowerCase() === 'c') {
      this.mapService.resetView();
    } else if (event.key.toLowerCase() === 'p') {
      this.mapService.togglePinMode();
    } else if (event.key.toLowerCase() === 'b') {
      const selected = this.mapService.selectedPoi();
      if (selected) {
        this.mapService.togglePoiMark(selected);
      }
    } else if (event.key === '+' || event.key === '=') {
      this.mapService.zoomBy(1);
    } else if (event.key === '-' || event.key === '_') {
      this.mapService.zoomBy(-1);
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'l') {
      this.cancelLegendHold();
    }
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.cancelLegendHold();
  }

  private startLegendHold(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.cancelLegendHold();
    this.legendHoldStart = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - this.legendHoldStart) / this.legendHoldDurationMs);
      this.legendHoldProgress.set(progress);
      if (progress >= 1) {
        this.legendHoldRaf = null;
        this.legendHoldProgress.set(0);
        this.selectCategory('Todas');
        return;
      }
      this.legendHoldRaf = requestAnimationFrame(tick);
    };
    this.legendHoldRaf = requestAnimationFrame(tick);
  }

  private cancelLegendHold(): void {
    if (this.legendHoldRaf !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.legendHoldRaf);
    }
    this.legendHoldRaf = null;
    if (this.legendHoldProgress() !== 0) {
      this.legendHoldProgress.set(0);
    }
  }
}
