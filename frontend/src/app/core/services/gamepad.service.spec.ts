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
            orbitCameraBy: jest.fn(),
            zoomBy: jest.fn(),
            zoomImmediateBy: jest.fn(),
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

  it('should zoom immediately via L2/R2 on map and block zoom/pan when a modal is open', () => {
    const mapMock = TestBed.inject(MapService) as unknown as {
      zoomImmediateBy: jest.Mock;
      panBy: jest.Mock;
    };
    let modalOpen = false;
    service.init({ isModalOpen: () => modalOpen });

    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[6] = { pressed: true, value: 1 }; // L2 (- zoom)
    const pad = { axes: [0, 0, 0, 0], buttons } as unknown as Gamepad;

    const updateZoom = (service as unknown as { updateMapZoom: (p: Gamepad) => void }).updateMapZoom.bind(
      service,
    );
    updateZoom(pad);
    expect(mapMock.zoomImmediateBy).toHaveBeenCalledWith(-0.045);

    mapMock.zoomImmediateBy.mockClear();
    modalOpen = true;
    updateZoom(pad);
    expect(mapMock.zoomImmediateBy).not.toHaveBeenCalled();
  });

  it('throttles document.elementFromPoint hit-testing during virtual cursor movement', () => {
    service.init();
    service.setCursorPosition(300, 300, false);

    const elementFromPointMock = jest.fn().mockReturnValue(null);
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPointMock,
    });

    const nowSpy = jest.spyOn(performance, 'now');
    const fakePad = {
      axes: [0.5, 0.5, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    } as unknown as Gamepad;
    const updateCursor = (service as unknown as { updateVirtualCursor: (p: Gamepad) => void })
      .updateVirtualCursor.bind(service);

    try {
      nowSpy.mockReturnValue(100);
      updateCursor(fakePad);
      nowSpy.mockReturnValue(116);
      updateCursor(fakePad);
      nowSpy.mockReturnValue(140);
      updateCursor(fakePad);
      expect(elementFromPointMock).toHaveBeenCalledTimes(1);

      nowSpy.mockReturnValue(200);
      updateCursor(fakePad);
      expect(elementFromPointMock).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(document, 'elementFromPoint', originalDescriptor);
      } else {
        delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
      }
    }
  });

  it('orbits camera bearing and 3D pitch via right analog stick and blocks when modal is open', () => {
    const mapMock = TestBed.inject(MapService) as unknown as { orbitCameraBy: jest.Mock };
    let modalOpen = false;
    service.init({ isModalOpen: () => modalOpen });

    const pad = {
      axes: [0, 0, 0.5, -0.8],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    } as unknown as Gamepad;

    const updateOrbit = (service as unknown as { updateMapOrbit: (p: Gamepad) => void }).updateMapOrbit.bind(
      service,
    );
    updateOrbit(pad);
    expect(mapMock.orbitCameraBy).toHaveBeenCalledWith(0.5 * 2.2, 0.8 * 1.4);

    mapMock.orbitCameraBy.mockClear();
    modalOpen = true;
    updateOrbit(pad);
    expect(mapMock.orbitCameraBy).not.toHaveBeenCalled();
  });
});
