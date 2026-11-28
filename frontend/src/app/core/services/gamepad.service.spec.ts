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

  it('should pan map when left stick pushes virtual cursor to screen edge', () => {
    const mapMock = TestBed.inject(MapService) as unknown as { panBy: jest.Mock };
    service.init();
    service.setCursorPosition(0, 300, false);

    const fakePad = {
      axes: [-0.9, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    } as unknown as Gamepad;

    (service as unknown as { updateVirtualCursor: (p: Gamepad) => void }).updateVirtualCursor(fakePad);

    expect(mapMock.panBy).toHaveBeenCalledWith(-0.9 * 14, 0);
  });

  it('should dispatch D-Pad 2D directions, back, contextual action, and L3 pin creation', () => {
    const onBack = jest.fn();
    const onContextualAction = jest.fn();
    const onCreatePin = jest.fn();
    const onStepFocus = jest.fn();

    service.init({ onBack, onContextualAction, onCreatePin, onStepFocus });

    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[1] = { pressed: true, value: 1 }; // B / Circle
    buttons[2] = { pressed: true, value: 1 }; // X / Square
    buttons[10] = { pressed: true, value: 1 }; // L3 / LS
    buttons[13] = { pressed: true, value: 1 }; // D-Pad Down

    const fakePad = { axes: [0, 0, 0, 0], buttons } as unknown as Gamepad;
    (service as unknown as { processActionButtons: (p: Gamepad) => void }).processActionButtons(fakePad);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onContextualAction).toHaveBeenCalledTimes(1);
    expect(onCreatePin).toHaveBeenCalledTimes(1);
    expect(onStepFocus).toHaveBeenCalledWith('down');
  });

  it('should auto-repeat D-Pad navigation faster when held down', () => {
    const onStepFocus = jest.fn();
    service.init({ onStepFocus });

    const nowSpy = jest.spyOn(performance, 'now');
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[13] = { pressed: true, value: 1 };
    const fakePad = { axes: [0, 0, 0, 0], buttons } as unknown as Gamepad;
    const pollButtons = (service as unknown as { processActionButtons: (p: Gamepad) => void })
      .processActionButtons.bind(service);

    nowSpy.mockReturnValue(1000);
    pollButtons(fakePad);
    expect(onStepFocus).toHaveBeenCalledTimes(1);

    // Before 320ms delay -> no repeat
    nowSpy.mockReturnValue(1200);
    pollButtons(fakePad);
    expect(onStepFocus).toHaveBeenCalledTimes(1);

    // Past 320ms delay -> repeats every 110ms
    nowSpy.mockReturnValue(1350);
    pollButtons(fakePad);
    expect(onStepFocus).toHaveBeenCalledTimes(2);

    // Past 900ms hold -> accelerates to 55ms
    nowSpy.mockReturnValue(1950);
    pollButtons(fakePad);
    expect(onStepFocus).toHaveBeenCalledTimes(3);

    nowSpy.mockReturnValue(2010);
    pollButtons(fakePad);
    expect(onStepFocus).toHaveBeenCalledTimes(4);

    nowSpy.mockRestore();
  });
});
