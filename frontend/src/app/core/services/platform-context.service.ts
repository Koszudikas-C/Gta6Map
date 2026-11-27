import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DeviceMode } from '../models/hud.models';
import { GamepadService } from './gamepad.service';

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

  readonly searchPlaceholder = computed(() => {
    switch (this.mode()) {
      case 'console':
        return 'Buscar POI... (R1/RB)';
      case 'mobile':
        return 'Buscar POI, bairro...';
      case 'desktop':
        return 'Buscar POI, bairro... (Ctrl+K)';
    }
  });

  readonly cinemaExitLabel = computed(() => {
    switch (this.mode()) {
      case 'console': {
        const type = this.gamepadService.controllerType?.() ?? 'generic';
        const btn = type === 'playstation' ? '△' : type === 'xbox' ? 'Y' : 'Y / △';
        return `Sair do Modo Cinema (${btn})`;
      }
      case 'mobile':
        return 'Sair do Modo Cinema';
      case 'desktop':
        return 'Sair do Modo Cinema (H / Esc)';
    }
  });

  readonly zoomInTooltip = computed(() => {
    switch (this.mode()) {
      case 'console': {
        const type = this.gamepadService.controllerType?.() ?? 'generic';
        return `Aumentar Zoom (${type === 'xbox' ? 'RT' : 'R2'})`;
      }
      case 'mobile':
        return 'Aumentar Zoom';
      case 'desktop':
        return 'Aumentar Zoom (+)';
    }
  });

  readonly zoomOutTooltip = computed(() => {
    switch (this.mode()) {
      case 'console': {
        const type = this.gamepadService.controllerType?.() ?? 'generic';
        return `Diminuir Zoom (${type === 'xbox' ? 'LT' : 'L2'})`;
      }
      case 'mobile':
        return 'Diminuir Zoom';
      case 'desktop':
        return 'Diminuir Zoom (-)';
    }
  });

  readonly toggle3DTooltip = computed(() => {
    switch (this.mode()) {
      case 'console': {
        const type = this.gamepadService.controllerType?.() ?? 'generic';
        return `Alternar Visão 2D / 3D (${type === 'xbox' ? 'RS' : 'R3'})`;
      }
      case 'mobile':
        return 'Alternar Visão 2D / 3D';
      case 'desktop':
        return 'Alternar Visão 2D / 3D (3)';
    }
  });

  readonly resetViewTooltip = computed(() => {
    return this.mode() === 'desktop' ? 'Centralizar Mapa (C)' : 'Centralizar Mapa';
  });

  backpackTooltip(isOpen: boolean): string {
    const base = isOpen ? 'Guardar Mapa na Mochila' : 'Abrir Mapa da Mochila';
    switch (this.mode()) {
      case 'console': {
        const type = this.gamepadService.controllerType?.() ?? 'generic';
        const btn = type === 'playstation' ? 'L1' : type === 'xbox' ? 'LB' : 'L1/LB';
        return `${base} (${btn})`;
      }
      case 'mobile':
        return isOpen ? 'Fechar Mochila' : 'Abrir Mochila';
      case 'desktop':
        return `${base} (M)`;
    }
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
