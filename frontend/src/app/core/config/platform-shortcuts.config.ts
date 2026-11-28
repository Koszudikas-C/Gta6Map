import { ControllerType } from '../services/gamepad.service';

export type PlatformShortcutId =
  | 'backpack'
  | 'search'
  | 'zoomIn'
  | 'zoomOut'
  | 'toggle3D'
  | 'resetView'
  | 'pinMode'
  | 'routeToggle'
  | 'cinemaExit'
  | 'closeModal'
  | 'navigateList'
  | 'confirmItem'
  | 'expandToggle'
  | 'focusSearchInput'
  | 'toggleMapMode'
  | 'cycleSearchTab'
  | 'scrollCatPrev'
  | 'scrollCatNext'
  | 'pinPanel'
  | 'cyclePoiVisibility'
  | 'copyCoords';

export interface ConsoleShortcutSpec {
  playstation: string;
  xbox: string;
  generic: string;
}

export interface PlatformShortcutSpec {
  desktop: string;
  mobile: string | null;
  console: ConsoleShortcutSpec;
}

/**
 * Registro central obrigatório de atalhos por plataforma.
 * O TypeScript (`satisfies`) bloqueia o build caso alguma ação ou plataforma fique sem mapeamento.
 */
export const PLATFORM_SHORTCUTS = {
  backpack: {
    desktop: 'M',
    mobile: null,
    console: { playstation: 'L1', xbox: 'LB', generic: 'L1/LB' },
  },
  search: {
    desktop: 'Ctrl+K',
    mobile: null,
    console: { playstation: 'R1', xbox: 'RB', generic: 'R1/RB' },
  },
  zoomIn: {
    desktop: '+',
    mobile: null,
    console: { playstation: 'R2', xbox: 'RT', generic: 'R2/RT' },
  },
  zoomOut: {
    desktop: '-',
    mobile: null,
    console: { playstation: 'L2', xbox: 'LT', generic: 'L2/LT' },
  },
  toggle3D: {
    desktop: '3',
    mobile: null,
    console: { playstation: 'R3', xbox: 'RS', generic: 'R3' },
  },
  resetView: {
    desktop: 'C',
    mobile: null,
    console: { playstation: 'Options', xbox: 'Menu', generic: 'Start' },
  },
  pinMode: {
    desktop: 'P',
    mobile: null,
    console: { playstation: '□ / L3', xbox: 'X / LS', generic: 'X/□ / L3' },
  },
  routeToggle: {
    desktop: 'B',
    mobile: null,
    console: { playstation: '□', xbox: 'X', generic: 'X/□' },
  },
  cinemaExit: {
    desktop: 'H / Esc',
    mobile: null,
    console: { playstation: '△', xbox: 'Y', generic: 'Y/△' },
  },
  closeModal: {
    desktop: 'ESC',
    mobile: '✕',
    console: { playstation: '○', xbox: 'B', generic: 'B/○' },
  },
  navigateList: {
    desktop: '↑↓',
    mobile: null,
    console: { playstation: 'D-Pad', xbox: 'D-Pad', generic: 'D-Pad' },
  },
  confirmItem: {
    desktop: '↵',
    mobile: null,
    console: { playstation: '✕', xbox: 'A', generic: 'A/✕' },
  },
  expandToggle: {
    desktop: 'E',
    mobile: null,
    console: { playstation: '□', xbox: 'X', generic: 'X/□' },
  },
  focusSearchInput: {
    desktop: '/',
    mobile: null,
    console: { playstation: '△', xbox: 'Y', generic: 'Y/△' },
  },
  toggleMapMode: {
    desktop: 'O',
    mobile: null,
    console: { playstation: 'R3', xbox: 'RS', generic: 'R3' },
  },
  cycleSearchTab: {
    desktop: 'Tab',
    mobile: null,
    console: { playstation: 'L1', xbox: 'LB', generic: 'L1/LB' },
  },
  scrollCatPrev: {
    desktop: '←',
    mobile: null,
    console: { playstation: 'L2', xbox: 'LT', generic: 'L2/LT' },
  },
  scrollCatNext: {
    desktop: '→',
    mobile: null,
    console: { playstation: 'R2', xbox: 'RT', generic: 'R2/RT' },
  },
  pinPanel: {
    desktop: 'T',
    mobile: null,
    console: { playstation: 'L3', xbox: 'LS', generic: 'L3/LS' },
  },
  cyclePoiVisibility: {
    desktop: 'L',
    mobile: null,
    console: { playstation: 'Touchpad', xbox: 'View', generic: 'Select' },
  },
  copyCoords: {
    desktop: 'K',
    mobile: null,
    console: { playstation: '△', xbox: 'Y', generic: 'Y/△' },
  },
} as const satisfies Record<PlatformShortcutId, PlatformShortcutSpec>;

export function resolveShortcutBadge(
  id: PlatformShortcutId,
  mode: 'desktop' | 'mobile' | 'console',
  controllerType: ControllerType = 'generic',
): string | null {
  const spec = PLATFORM_SHORTCUTS[id];
  if (mode === 'console') {
    return spec.console[controllerType];
  }
  return spec[mode];
}
