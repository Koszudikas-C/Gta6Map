import { LEONIDA_MAP_CONFIG } from '../data/leonida-map.data';

export type Native3DTheme = 'day' | 'night';

export const NATIVE_3D_SURFACE_PRIORITY: Record<string, number> = {
  land: 0,
  water: 1,
  shore: 2,
  roads: 3,
  freeway: 4,
  rail: 5,
  runway: 6,
  buildings: 7,
  buildingdetail: 8,
  markings: 9,
};

export interface Native3DThemeJson {
  schema: number;
  id: string;
  theme: string;
  background: string;
  encoding: string;
  colors: string;
}

export interface Native3DSceneUserData {
  nativePalette?: unknown;
  nativePaletteSlots?: unknown;
}

export interface DecodedNative3DPalette {
  background: string;
  colors: Uint16Array;
}

export function resolveSurfacePriority(nodeNames: readonly string[]): number {
  for (const rawName of nodeNames) {
    const baseName = rawName.replace(/_\d+$/, '');
    if (Object.prototype.hasOwnProperty.call(NATIVE_3D_SURFACE_PRIORITY, baseName)) {
      return NATIVE_3D_SURFACE_PRIORITY[baseName];
    }
  }
  return 0;
}

export function decodeNative3DPalette(
  themeJson: Partial<Native3DThemeJson>,
  expectedTheme: Native3DTheme,
  userData: Native3DSceneUserData,
): DecodedNative3DPalette {
  const slots = userData.nativePaletteSlots;
  const paletteId = userData.nativePalette;
  const expectedEncoding = expectedTheme === 'day' ? 'linear8' : 'srgb8';

  if (
    themeJson.schema !== 1 ||
    themeJson.theme !== expectedTheme ||
    typeof paletteId !== 'string' ||
    themeJson.id !== paletteId ||
    typeof slots !== 'number' ||
    !Number.isInteger(slots) ||
    slots < 1 ||
    typeof themeJson.colors !== 'string' ||
    themeJson.colors.length !== slots * 6 ||
    !/^[0-9a-f]+$/i.test(themeJson.colors) ||
    typeof themeJson.background !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(themeJson.background) ||
    themeJson.encoding !== expectedEncoding
  ) {
    throw new Error(`Invalid 3D map ${expectedTheme} material`);
  }

  const bytesCount = themeJson.colors.length / 2;
  const colors = new Uint16Array(bytesCount);

  for (let i = 0; i < bytesCount; i++) {
    const byte = parseInt(themeJson.colors.slice(i * 2, i * 2 + 2), 16);
    if (expectedEncoding === 'linear8') {
      colors[i] = byte * 257;
    } else {
      const normalized = byte / 255;
      const linear =
        normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      colors[i] = Math.round(linear * 65535);
    }
  }

  return {
    background: themeJson.background,
    colors,
  };
}

export function buildNative3DMercatorMatrixElements(): [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] {
  const { baseZoom, origin, left, top, size } = LEONIDA_MAP_CONFIG.native3D;
  const scalePow = 2 ** baseZoom;
  const w = 1 / (size * scalePow);
  const tx = (origin[0] - left / size) / scalePow;
  const ty = (origin[1] + top / size) / scalePow;
  return [w, 0, 0, tx, 0, 0, w, ty, 0, w, 0, 0, 0, 0, 0, 1];
}
