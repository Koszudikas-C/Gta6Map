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
  onCursorClick?: (x: number, y: number) => void;
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
  private aWasPressed = false;
  private cinemaWasPressed = false;
  private actions: GamepadActions = {};

  readonly connected = signal(false);
  readonly controllerName = signal<string | null>(null);
  readonly controllerType = signal<ControllerType>('generic');
  readonly cursorX = signal(typeof window !== 'undefined' ? window.innerWidth / 2 : 640);
  readonly cursorY = signal(typeof window !== 'undefined' ? window.innerHeight / 2 : 360);
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
        const pad = this.getActiveGamepad();
        if (pad) {
          this.updateVirtualCursor(pad);
          this.updateMapZoom(pad);
          this.processActionButtons(pad);
        }
        this.rafId = requestAnimationFrame(poll);
      };

      this.rafId = requestAnimationFrame(poll);
    });
  }

  private getActiveGamepad(): Gamepad | undefined {
    const pads = navigator.getGamepads?.() ?? [];
    return Array.from(pads).find((p) => p !== null);
  }

  private updateVirtualCursor(pad: Gamepad): void {
    const rawX = pad.axes[0] ?? 0;
    const rawY = pad.axes[1] ?? 0;
    if (Math.abs(rawX) <= DEADZONE && Math.abs(rawY) <= DEADZONE) {
      return;
    }

    const nextX = Math.max(0, Math.min(window.innerWidth, this.cursorX() + rawX * 10));
    const nextY = Math.max(0, Math.min(window.innerHeight, this.cursorY() + rawY * 10));
    this.ngZone.run(() => {
      this.cursorX.set(nextX);
      this.cursorY.set(nextY);
    });
  }

  private updateMapZoom(pad: Gamepad): void {
    const rightStickY = pad.axes[3] ?? 0;
    const l2Value = pad.buttons[6]?.value ?? 0;
    const r2Value = pad.buttons[7]?.value ?? 0;

    if (Math.abs(rightStickY) > DEADZONE) {
      this.mapService.zoomBy(-rightStickY * 0.08);
    } else if (r2Value > DEADZONE || l2Value > DEADZONE) {
      this.mapService.zoomBy((r2Value - l2Value) * 0.08);
    }
  }

  private processActionButtons(pad: Gamepad): void {
    const aPressed = Boolean(pad.buttons[0]?.pressed);
    if (aPressed && !this.aWasPressed) {
      const x = this.cursorX();
      const y = this.cursorY();
      this.ngZone.run(() => this.actions.onCursorClick?.(x, y));
    }
    this.aWasPressed = aPressed;

    const l1Pressed = Boolean(pad.buttons[4]?.pressed);
    if (l1Pressed && !this.l1WasPressed) {
      this.ngZone.run(() => this.actions.onToggleSidebar?.());
    }
    this.l1WasPressed = l1Pressed;

    const r1Pressed = Boolean(pad.buttons[5]?.pressed);
    if (r1Pressed && !this.r1WasPressed) {
      this.ngZone.run(() => this.actions.onFocusSearch?.());
    }
    this.r1WasPressed = r1Pressed;

    const r3Pressed = Boolean(pad.buttons[11]?.pressed);
    if (r3Pressed && !this.r3WasPressed) {
      this.ngZone.run(() => this.mapService.toggle3D());
    }
    this.r3WasPressed = r3Pressed;

    const cinemaPressed = Boolean(pad.buttons[3]?.pressed || pad.buttons[8]?.pressed);
    if (cinemaPressed && !this.cinemaWasPressed) {
      this.ngZone.run(() => this.actions.onToggleCinema?.());
    }
    this.cinemaWasPressed = cinemaPressed;
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
