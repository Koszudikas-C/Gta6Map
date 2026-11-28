import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DeviceMode } from '../models/hud.models';
import { GamepadService } from './gamepad.service';
import {
  PlatformShortcutId,
  resolveShortcutBadge,
} from '../config/platform-shortcuts.config';

@Injectable({ providedIn: 'root' })
export class PlatformContextService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly gamepadService = inject(GamepadService);

  private readonly mobileViewport = signal(this.checkMobileViewport());

  readonly isConsole = computed(() => this.gamepadService.connected());
  readonly isMobile = computed(() => !this.isConsole() && this.mobileViewport());
  readonly mode = computed<DeviceMode>(() => {
    if (this.isConsole()) {
      return 'console';
    }
    return this.mobileViewport() ? 'mobile' : 'desktop';
  });
  readonly isDesktop = computed(() => this.mode() === 'desktop');

  shortcutKey(id: PlatformShortcutId): string | null {
    const controller = this.gamepadService.controllerType?.() ?? 'generic';
    return resolveShortcutBadge(id, this.mode(), controller);
  }

  formatWithShortcut(label: string, id: PlatformShortcutId): string {
    const badge = this.shortcutKey(id);
    return badge ? `${label} (${badge})` : label;
  }

  readonly searchPlaceholder = computed(() => {
    switch (this.mode()) {
      case 'console':
        return this.formatWithShortcut('Buscar POI...', 'search');
      case 'mobile':
        return 'Buscar POI, bairro...';
      case 'desktop':
        return this.formatWithShortcut('Buscar POI, bairro...', 'search');
    }
  });

  readonly cinemaExitLabel = computed(() =>
    this.formatWithShortcut('Sair do Modo Cinema', 'cinemaExit'),
  );

  readonly zoomInTooltip = computed(() =>
    this.formatWithShortcut('Aumentar Zoom', 'zoomIn'),
  );

  readonly zoomOutTooltip = computed(() =>
    this.formatWithShortcut('Diminuir Zoom', 'zoomOut'),
  );

  readonly toggle3DTooltip = computed(() =>
    this.formatWithShortcut('Alternar Visão 2D / 3D', 'toggle3D'),
  );

  readonly resetViewTooltip = computed(() =>
    this.formatWithShortcut('Centralizar Mapa', 'resetView'),
  );

  readonly pinModeTooltip = computed(() =>
    this.formatWithShortcut('Marcar ponto no mapa', 'pinMode'),
  );

  routeToggleLabel(step: number): string {
    const base = step > 0 ? `Remover da rota (#${step})` : 'Adicionar à rota';
    return this.formatWithShortcut(base, 'routeToggle');
  }

  backpackTooltip(isOpen: boolean): string {
    if (this.mode() === 'mobile') {
      return isOpen ? 'Fechar Mochila' : 'Abrir Mochila';
    }
    const base = isOpen ? 'Guardar Mapa na Mochila' : 'Abrir Mapa da Mochila';
    return this.formatWithShortcut(base, 'backpack');
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('resize', () => {
        this.mobileViewport.set(this.checkMobileViewport());
      });
    }
  }

  private checkMobileViewport(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return window.innerWidth < 768;
  }
}
