import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GamepadLegendItem } from '../models/hud.models';
import { MapService } from './map.service';

const DEADZONE = 0.15;

export type ControllerType = 'playstation' | 'xbox' | 'generic';

export type DpadDirection = 'up' | 'down' | 'left' | 'right';

export interface GamepadActions {
  onFocusSearch?: () => void;
  onToggleCinema?: () => void;
  onToggleSidebar?: () => void;
  onBack?: () => void;
  onContextualAction?: () => void;
  onCreatePin?: () => void;
  onToggle3D?: () => void;
  onPrevCategoryPage?: () => void;
  onNextCategoryPage?: () => void;
  onResetView?: () => void;
  isModalOpen?: () => boolean;
  onStepFocus?: (direction: DpadDirection) => void;
  onCursorClick?: (x: number, y: number) => void;
}

@Injectable({ providedIn: 'root' })
export class GamepadService {
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapService = inject(MapService);

  private rafId: number | null = null;
  private l3WasPressed = false;
  private r3WasPressed = false;
  private l2WasPressed = false;
  private r2WasPressed = false;
  private r1WasPressed = false;
  private l1WasPressed = false;
  private aWasPressed = false;
  private bWasPressed = false;
  private xWasPressed = false;
  private startWasPressed = false;
  private readonly dpadHoldState: Record<
    DpadDirection,
    { pressed: boolean; holdStart: number; lastRepeat: number }
  > = {
    up: { pressed: false, holdStart: 0, lastRepeat: 0 },
    down: { pressed: false, holdStart: 0, lastRepeat: 0 },
    left: { pressed: false, holdStart: 0, lastRepeat: 0 },
    right: { pressed: false, holdStart: 0, lastRepeat: 0 },
  };
  private cinemaWasPressed = false;
  private actions: GamepadActions = {};

  readonly connected = signal(false);
  readonly controllerName = signal<string | null>(null);
  readonly controllerType = signal<ControllerType>('generic');
  readonly cursorX = signal(typeof window !== 'undefined' ? window.innerWidth / 2 : 640);
  readonly cursorY = signal(typeof window !== 'undefined' ? window.innerHeight / 2 : 360);
  readonly cursorHidden = signal(false);
  readonly legends = computed<GamepadLegendItem[]>(() => {
    switch (this.controllerType()) {
      case 'playstation':
        return [
          { button: 'L1', label: 'Mochila' },
          { button: 'R1', label: 'Buscar' },
          { button: 'L2/R2', label: 'Zoom' },
          { button: 'R3', label: 'Visão 3D' },
          { button: 'L3', label: 'Criar Pin' },
          { button: '△', label: 'Cinema' },
          { button: '□', label: 'Rota/Modo Pin' },
          { button: '○', label: 'Voltar' },
          { button: 'D-Pad', label: 'Navegar' },
          { button: 'Options', label: 'Centralizar' },
        ];
      case 'xbox':
        return [
          { button: 'LB', label: 'Mochila' },
          { button: 'RB', label: 'Buscar' },
          { button: 'LT/RT', label: 'Zoom' },
          { button: 'RS', label: 'Visão 3D' },
          { button: 'LS', label: 'Criar Pin' },
          { button: 'Y', label: 'Cinema' },
          { button: 'X', label: 'Rota/Modo Pin' },
          { button: 'B', label: 'Voltar' },
          { button: 'D-Pad', label: 'Navegar' },
          { button: 'Menu', label: 'Centralizar' },
        ];
      default:
        return [
          { button: 'L1/LB', label: 'Mochila' },
          { button: 'R1/RB', label: 'Buscar' },
          { button: 'L2/R2', label: 'Zoom' },
          { button: 'R3', label: 'Visão 3D' },
          { button: 'L3/LS', label: 'Criar Pin' },
          { button: 'Y/△', label: 'Cinema' },
          { button: 'X/□', label: 'Rota/Modo Pin' },
          { button: 'B/○', label: 'Voltar' },
          { button: 'D-Pad', label: 'Navegar' },
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

    const edgeMargin = 12;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    const stepX = Math.abs(rawX) > DEADZONE ? rawX * 10 : 0;
    const stepY = Math.abs(rawY) > DEADZONE ? rawY * 10 : 0;
    const nextX = Math.max(0, Math.min(maxW, this.cursorX() + stepX));
    const nextY = Math.max(0, Math.min(maxH, this.cursorY() + stepY));

    const overControl = Boolean(
      (document.elementFromPoint?.(nextX, nextY) as HTMLElement | null)?.closest(
        'button, input, textarea, select, a, [role="button"]',
      ),
    );

    if (nextX !== this.cursorX() || nextY !== this.cursorY() || overControl !== this.cursorHidden()) {
      this.ngZone.run(() => {
        this.cursorX.set(nextX);
        this.cursorY.set(nextY);
        this.cursorHidden.set(overControl);
      });
    }

    const panDx =
      (nextX <= edgeMargin && rawX < -DEADZONE) || (nextX >= maxW - edgeMargin && rawX > DEADZONE)
        ? rawX * 14
        : 0;
    const panDy =
      (nextY <= edgeMargin && rawY < -DEADZONE) || (nextY >= maxH - edgeMargin && rawY > DEADZONE)
        ? rawY * 14
        : 0;

    if ((panDx !== 0 || panDy !== 0) && !this.actions.isModalOpen?.()) {
      this.mapService.panBy(panDx, panDy);
    }
  }

  private updateMapZoom(pad: Gamepad): void {
    if (this.actions.isModalOpen?.()) {
      return;
    }
    const rightStickY = pad.axes[3] ?? 0;
    const l2Value = pad.buttons[6]?.value || (pad.buttons[6]?.pressed ? 1 : 0);
    const r2Value = pad.buttons[7]?.value || (pad.buttons[7]?.pressed ? 1 : 0);

    if (r2Value > DEADZONE || l2Value > DEADZONE) {
      this.mapService.zoomImmediateBy((r2Value - l2Value) * 0.045);
    } else if (Math.abs(rightStickY) > 0.2) {
      this.mapService.zoomImmediateBy(-rightStickY * 0.045);
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

    const bPressed = Boolean(pad.buttons[1]?.pressed);
    if (bPressed && !this.bWasPressed) {
      this.ngZone.run(() => this.actions.onBack?.());
    }
    this.bWasPressed = bPressed;

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

    const l3Pressed = Boolean(pad.buttons[10]?.pressed);
    if (l3Pressed && !this.l3WasPressed) {
      this.ngZone.run(() => this.actions.onCreatePin?.());
    }
    this.l3WasPressed = l3Pressed;

    const r3Pressed = Boolean(pad.buttons[11]?.pressed);
    if (r3Pressed && !this.r3WasPressed) {
      this.ngZone.run(() => {
        if (this.actions.onToggle3D) {
          this.actions.onToggle3D();
        } else {
          this.mapService.toggle3D();
        }
      });
    }
    this.r3WasPressed = r3Pressed;

    const l2Pressed = Boolean(pad.buttons[6]?.pressed);
    if (l2Pressed && !this.l2WasPressed) {
      this.ngZone.run(() => this.actions.onPrevCategoryPage?.());
    }
    this.l2WasPressed = l2Pressed;

    const r2Pressed = Boolean(pad.buttons[7]?.pressed);
    if (r2Pressed && !this.r2WasPressed) {
      this.ngZone.run(() => this.actions.onNextCategoryPage?.());
    }
    this.r2WasPressed = r2Pressed;

    const cinemaPressed = Boolean(pad.buttons[3]?.pressed || pad.buttons[8]?.pressed);
    if (cinemaPressed && !this.cinemaWasPressed) {
      this.ngZone.run(() => this.actions.onToggleCinema?.());
    }
    this.cinemaWasPressed = cinemaPressed;

    const xPressed = Boolean(pad.buttons[2]?.pressed);
    if (xPressed && !this.xWasPressed) {
      this.ngZone.run(() => this.actions.onContextualAction?.());
    }
    this.xWasPressed = xPressed;

    const startPressed = Boolean(pad.buttons[9]?.pressed);
    if (startPressed && !this.startWasPressed) {
      this.ngZone.run(() => this.actions.onResetView?.());
    }
    this.startWasPressed = startPressed;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.processDpadDirection(Boolean(pad.buttons[12]?.pressed), 'up', now);
    this.processDpadDirection(Boolean(pad.buttons[13]?.pressed), 'down', now);
    this.processDpadDirection(Boolean(pad.buttons[14]?.pressed), 'left', now);
    this.processDpadDirection(Boolean(pad.buttons[15]?.pressed), 'right', now);
  }

  private processDpadDirection(pressed: boolean, direction: DpadDirection, now: number): void {
    const state = this.dpadHoldState[direction];
    if (!pressed) {
      state.pressed = false;
      return;
    }

    if (!state.pressed) {
      state.pressed = true;
      state.holdStart = now;
      state.lastRepeat = now;
      this.ngZone.run(() => this.actions.onStepFocus?.(direction));
      return;
    }

    const heldMs = now - state.holdStart;
    if (heldMs < 320) {
      return;
    }

    const repeatIntervalMs = heldMs >= 900 ? 55 : 110;
    if (now - state.lastRepeat >= repeatIntervalMs) {
      state.lastRepeat = now;
      this.ngZone.run(() => this.actions.onStepFocus?.(direction));
    }
  }

  setCursorPosition(x: number, y: number, hideOverControl = false): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.cursorX.set(Math.max(0, Math.min(window.innerWidth, x)));
    this.cursorY.set(Math.max(0, Math.min(window.innerHeight, y)));
    this.cursorHidden.set(hideOverControl);
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
