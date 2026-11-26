import { TestBed } from '@angular/core/testing';
import { GamepadService } from './gamepad.service';
import { MapService } from './map.service';

describe('GamepadService', () => {
  let service: GamepadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GamepadService,
        {
          provide: MapService,
          useValue: {
            panBy: jest.fn(),
            zoomBy: jest.fn(),
            toggle3D: jest.fn(),
          },
        },
      ],
    });
    service = TestBed.inject(GamepadService);
  });

  afterEach(() => {
    service.destroy();
  });

  it('should initialize disconnected with default legends', () => {
    service.init();
    expect(service.connected()).toBe(false);
    expect(service.legends().length).toBeGreaterThanOrEqual(4);
    expect(service.legends()[0].label).toBe('Mochila');
  });

  it('should detect gamepadconnected event and update connected signal', () => {
    service.init();
    const mockEvent = new Event('gamepadconnected') as GamepadEvent;
    Object.defineProperty(mockEvent, 'gamepad', {
      value: { id: 'DualSense Wireless Controller' },
    });

    window.dispatchEvent(mockEvent);

    expect(service.connected()).toBe(true);
    expect(service.controllerName()).toBe('DualSense Wireless Controller');
  });
});
