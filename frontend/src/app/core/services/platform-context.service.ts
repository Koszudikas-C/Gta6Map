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
      case 'console':
        return 'Sair do Modo Cinema (Y / Select)';
      case 'mobile':
        return 'Sair do Modo Cinema';
      case 'desktop':
        return 'Sair do Modo Cinema (H / Esc)';
    }
  });

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
