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
  Maximize2,
  Minus,
  Plus,
  Search,
  LucideAngularModule,
} from 'lucide-angular';
import { GamepadService } from './core/services/gamepad.service';
import { MapService } from './core/services/map.service';
import { PlatformContextService } from './core/services/platform-context.service';
import { HudConsoleBarComponent } from './features/hud/hud-console-bar.component';
import { HudDesktopBarComponent } from './features/hud/hud-desktop-bar.component';
import { HudMobileDialComponent } from './features/hud/hud-mobile-dial.component';
import { WeaponWheelComponent, WheelAction } from './features/hud/weapon-wheel.component';

@Component({
  selector: 'app-root',
  imports: [
    LucideAngularModule,
    HudDesktopBarComponent,
    HudMobileDialComponent,
    HudConsoleBarComponent,
    WeaponWheelComponent,
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

  readonly isMobile = signal(
    typeof window !== 'undefined' ? window.innerWidth <= 767 : false
  );
  readonly wheelOpen = signal(false);
  readonly activePanel = signal<'map' | 'filters' | null>(null);
  readonly sidebarOpen = signal(false);
  readonly cinemaMode = signal(false);
  readonly isFullscreen = signal(false);
  readonly searchQuery = signal('');
  readonly clickBursts = signal<{ id: number; x: number; y: number }[]>([]);
  private burstId = 0;
  readonly quickCategories = ['Missões', 'Armas', 'Colecionáveis', 'Lojas', 'Eventos'] as const;
  readonly selectedCategory = signal<string>('Missões');

  readonly icons = {
    Box,
    Compass,
    Crosshair,
    EyeOff,
    Gamepad2,
    Layers,
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
    });
  }

  ngOnDestroy(): void {
    this.gamepadService.destroy();
    this.mapService.destroy();
  }

  toggleSidebar(): void {
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
        this.focusSearch();
        break;
      case 'filters':
        this.activePanel.set('filters');
        this.sidebarOpen.set(true);
        break;
      case '3d':
        this.mapService.toggle3D();
        break;
      case 'cinema':
        this.toggleCinemaMode();
        break;
    }
  }

  toggleCinemaMode(): void {
    this.cinemaMode.update((v) => !v);
  }

  focusSearch(): void {
    this.cinemaMode.set(false);
    this.wheelOpen.set(false);
    this.activePanel.set('map');
    this.sidebarOpen.set(true);
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
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
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
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

  @HostListener('window:pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    const id = ++this.burstId;
    this.clickBursts.update((list) => [...list, { id, x: event.clientX, y: event.clientY }]);
    setTimeout(() => {
      this.clickBursts.update((list) => list.filter((b) => b.id !== id));
    }, 320);
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
    } else if (event.key === '+' || event.key === '=') {
      this.mapService.zoomBy(1);
    } else if (event.key === '-' || event.key === '_') {
      this.mapService.zoomBy(-1);
    }
  }
}
