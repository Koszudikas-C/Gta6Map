import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GamepadLegendItem } from '../models/hud.models';
import { MapService } from './map.service';

const DEADZONE = 0.15;

export type ControllerType = 'playstation' | 'xbox' | 'generic';

export interface GamepadActions {
  onFocusSearch?: () => void;
  onToggleCinema?: () => void;
  onToggleSidebar?: () => void;
}

@Injectable({ providedIn: 'root' })
export class GamepadService {
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapService = inject(MapService);

  private rafId: number | null = null;
  private r3WasPressed = false;
  private r1WasPressed = false;
  private l1WasPressed = false;
  private cinemaWasPressed = false;
  private actions: GamepadActions = {};

  readonly connected = signal(false);
  readonly controllerName = signal<string | null>(null);
  readonly controllerType = signal<ControllerType>('generic');
  readonly legends = computed<GamepadLegendItem[]>(() => {
    switch (this.controllerType()) {
      case 'playstation':
        return [
          { button: 'L1', label: 'Mochila' },
          { button: 'R1', label: 'Buscar' },
          { button: 'L2/R2', label: 'Zoom' },
          { button: 'R3', label: 'Visão 3D' },
          { button: '△', label: 'Cinema' },
        ];
      case 'xbox':
        return [
          { button: 'LB', label: 'Mochila' },
          { button: 'RB', label: 'Buscar' },
          { button: 'LT/RT', label: 'Zoom' },
          { button: 'RS', label: 'Visão 3D' },
          { button: 'Y', label: 'Cinema' },
        ];
      default:
        return [
          { button: 'L1/LB', label: 'Mochila' },
          { button: 'R1/RB', label: 'Buscar' },
          { button: 'L2/R2', label: 'Zoom' },
          { button: 'R3', label: 'Visão 3D' },
          { button: 'Y/△', label: 'Cinema' },
        ];
    }
  });

  private readonly onConnected = (e: GamepadEvent): void => {
    this.ngZone.run(() => {
      this.connected.set(true);
      this.controllerName.set(e.gamepad.id);
      this.controllerType.set(this.detectControllerType(e.gamepad.id));
    });
    this.startPolling();
  };

  private readonly onDisconnected = (): void => {
    const pads = isPlatformBrowser(this.platformId) ? navigator.getGamepads?.() ?? [] : [];
    const active = Array.from(pads).find((p) => p !== null);
    this.ngZone.run(() => {
      this.connected.set(Boolean(active));
      if (!active) {
        this.controllerName.set(null);
        this.controllerType.set('generic');
      }
    });
    if (!active) {
      this.stopPolling();
    }
  };

  private detectControllerType(id: string): ControllerType {
    const lower = id.toLowerCase();
    if (/dualsense|dualshock|sony|054c/.test(lower)) {
      return 'playstation';
    }
    if (/xbox|xinput|045e/.test(lower)) {
      return 'xbox';
    }
    return 'generic';
  }

  init(actions: GamepadActions = {}): void {
    this.actions = actions;
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.addEventListener('gamepadconnected', this.onConnected);
    window.addEventListener('gamepaddisconnected', this.onDisconnected);

    const pads = navigator.getGamepads?.() ?? [];
    const active = Array.from(pads).find((p) => p !== null);
    if (active) {
      this.connected.set(true);
      this.controllerName.set(active.id);
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.rafId !== null || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const poll = (): void => {
        const pads = navigator.getGamepads?.() ?? [];
        const pad = Array.from(pads).find((p) => p !== null);

        if (pad) {
          const rawX = pad.axes[0] ?? 0;
          const rawY = pad.axes[1] ?? 0;
          const dx = Math.abs(rawX) > DEADZONE ? rawX * 14 : 0;
          const dy = Math.abs(rawY) > DEADZONE ? rawY * 14 : 0;

          if (dx !== 0 || dy !== 0) {
            this.mapService.panBy(dx, dy);
          }

          // Zoom via Right Stick Y (axis 3) or L2/R2 triggers (buttons 6/7)
          const rightStickY = pad.axes[3] ?? 0;
          const l2Value = pad.buttons[6]?.value ?? 0;
          const r2Value = pad.buttons[7]?.value ?? 0;
          if (Math.abs(rightStickY) > DEADZONE) {
            this.mapService.zoomBy(-rightStickY * 0.08);
          } else if (r2Value > DEADZONE || l2Value > DEADZONE) {
            this.mapService.zoomBy((r2Value - l2Value) * 0.08);
          }

          // L1 / LB -> Toggle Sidebar
          const l1Pressed = Boolean(pad.buttons[4]?.pressed);
          if (l1Pressed && !this.l1WasPressed) {
            this.ngZone.run(() => this.actions.onToggleSidebar?.());
          }
          this.l1WasPressed = l1Pressed;

          // R1 / RB -> Focus Search
          const r1Pressed = Boolean(pad.buttons[5]?.pressed);
          if (r1Pressed && !this.r1WasPressed) {
            this.ngZone.run(() => this.actions.onFocusSearch?.());
          }
          this.r1WasPressed = r1Pressed;

          // R3 -> Toggle 2D/3D
          const r3Pressed = Boolean(pad.buttons[11]?.pressed);
          if (r3Pressed && !this.r3WasPressed) {
            this.ngZone.run(() => this.mapService.toggle3D());
          }
          this.r3WasPressed = r3Pressed;

          // Y / Triangle (3) or Select / Back (8) -> Toggle Cinema / Fullscreen
          const cinemaPressed = Boolean(pad.buttons[3]?.pressed || pad.buttons[8]?.pressed);
          if (cinemaPressed && !this.cinemaWasPressed) {
            this.ngZone.run(() => this.actions.onToggleCinema?.());
          }
          this.cinemaWasPressed = cinemaPressed;
        }

        this.rafId = requestAnimationFrame(poll);
      };

      this.rafId = requestAnimationFrame(poll);
    });
  }

  private stopPolling(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('gamepadconnected', this.onConnected);
      window.removeEventListener('gamepaddisconnected', this.onDisconnected);
    }
    this.stopPolling();
  }
}
