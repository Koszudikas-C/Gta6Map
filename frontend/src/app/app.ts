import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Box,
  Compass,
  Crosshair,
  EyeOff,
  Gamepad2,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Search,
  LucideAngularModule,
} from 'lucide-angular';
import { LeonidaPoi, POI_CATEGORIES } from './core/data/leonida-map.data';
import { DpadDirection, GamepadService } from './core/services/gamepad.service';
import { MapService } from './core/services/map.service';
import { PlatformContextService } from './core/services/platform-context.service';
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
  private readonly platformId = inject(PLATFORM_ID);

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
  readonly clickBursts = signal<{ id: number; x: number; y: number }[]>([]);
  private burstId = 0;
  readonly quickCategories = POI_CATEGORIES;
  readonly selectedCategory = signal<string>('Todas');

  readonly icons = {
    Box,
    Compass,
    Crosshair,
    EyeOff,
    Gamepad2,
    Layers,
    LocateFixed,
    MapPin,
    Maximize2,
    Minus,
    Plus,
    Search,
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
  }

  ngOnDestroy(): void {
    this.gamepadService.destroy();
    this.mapService.destroy();
  }

  toggleSidebar(): void {
    if (this.quickSearchOpen()) {
      this.quickSearch?.cycleTab();
      return;
    }
    if (this.activePanel() !== null) {
      this.activePanel.set(null);
      this.sidebarOpen.set(false);
      return;
    }
    this.wheelOpen.update((v) => !v);
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
    } else if (this.sidebarOpen() || this.activePanel() !== null) {
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
  }

  private stepMapTargetFocus(direction: DpadDirection): void {
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
    this.searchQuery.set(target.value);
    this.mapService.filterPois(target.value, this.selectedCategory());
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.sidebarOpen()) {
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
      } else {
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
    }

    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.focusSearch();
    } else if (event.key.toLowerCase() === 'm') {
      this.toggleSidebar();
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
}
