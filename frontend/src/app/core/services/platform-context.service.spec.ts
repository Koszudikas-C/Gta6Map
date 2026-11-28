import { TestBed } from '@angular/core/testing';
import { PlatformContextService } from './platform-context.service';
import { ControllerType, GamepadService } from './gamepad.service';
import { PLATFORM_SHORTCUTS, PlatformShortcutId } from '../config/platform-shortcuts.config';
import { signal } from '@angular/core';

describe('PlatformContextService', () => {
  const connectedSignal = signal(false);
  const controllerTypeSignal = signal<ControllerType>('generic');

  beforeEach(() => {
    connectedSignal.set(false);
    controllerTypeSignal.set('generic');
    TestBed.configureTestingModule({
      providers: [
        PlatformContextService,
        {
          provide: GamepadService,
          useValue: {
            connected: connectedSignal,
            controllerType: controllerTypeSignal,
          },
        },
      ],
    });
  });

  it('should default to desktop mode when width >= 768 and no gamepad is connected', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    window.dispatchEvent(new Event('resize'));

    const service = TestBed.inject(PlatformContextService);
    expect(service.mode()).toBe('desktop');
    expect(service.isDesktop()).toBe(true);
    expect(service.searchPlaceholder()).toContain('Ctrl+K');
  });

  it('should switch to console mode when gamepad is connected', () => {
    connectedSignal.set(true);
    const service = TestBed.inject(PlatformContextService);

    expect(service.mode()).toBe('console');
    expect(service.isConsole()).toBe(true);
    expect(service.searchPlaceholder()).toContain('R1/RB');
  });

  it('should switch to mobile mode when width < 768 and no gamepad is connected', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));

    const service = TestBed.inject(PlatformContextService);
    expect(service.mode()).toBe('mobile');
    expect(service.isMobile()).toBe(true);
    expect(service.cinemaExitLabel()).toBe('Sair do Modo Cinema');
    expect(service.pinModeTooltip()).toBe('Marcar ponto no mapa');
  });

  it('should expose PlayStation and Xbox shortcut labels without PC keys in console mode', () => {
    connectedSignal.set(true);
    controllerTypeSignal.set('playstation');
    const service = TestBed.inject(PlatformContextService);

    expect(service.pinModeTooltip()).toContain('□ / L3');
    expect(service.pinModeTooltip()).not.toContain('(P)');
    expect(service.routeToggleLabel(2)).toContain('□');
    expect(service.routeToggleLabel(2)).not.toContain('(B)');
    expect(service.backpackTooltip(false)).toContain('(L1)');

    controllerTypeSignal.set('xbox');
    expect(service.pinModeTooltip()).toContain('X / LS');
    expect(service.routeToggleLabel(0)).toContain('(X)');
    expect(service.backpackTooltip(false)).toContain('(LB)');
  });

  it('should define non-empty desktop and all console controller mappings for every shortcut', () => {
    const keys = Object.keys(PLATFORM_SHORTCUTS) as PlatformShortcutId[];
    expect(keys.length).toBeGreaterThanOrEqual(10);

    for (const id of keys) {
      const spec = PLATFORM_SHORTCUTS[id];
      expect(spec.desktop.trim().length).toBeGreaterThan(0);
      expect(spec.console.playstation.trim().length).toBeGreaterThan(0);
      expect(spec.console.xbox.trim().length).toBeGreaterThan(0);
      expect(spec.console.generic.trim().length).toBeGreaterThan(0);
    }
  });
});
