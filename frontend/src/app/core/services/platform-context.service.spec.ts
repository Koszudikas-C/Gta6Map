import { TestBed } from '@angular/core/testing';
import { PlatformContextService } from './platform-context.service';
import { GamepadService } from './gamepad.service';
import { signal } from '@angular/core';

describe('PlatformContextService', () => {
  const connectedSignal = signal(false);

  beforeEach(() => {
    connectedSignal.set(false);
    TestBed.configureTestingModule({
      providers: [
        PlatformContextService,
        {
          provide: GamepadService,
          useValue: { connected: connectedSignal },
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
  });
});
