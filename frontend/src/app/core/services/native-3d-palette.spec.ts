import {
  buildNative3DMercatorMatrixElements,
  decodeNative3DPalette,
  resolveSurfacePriority,
} from './native-3d-palette';

describe('native-3d-palette', () => {
  it('decodes day linear8 palette and validates schema, id, and encoding', () => {
    const decoded = decodeNative3DPalette(
      {
        schema: 1,
        id: 'pal-abc',
        theme: 'day',
        background: '#44899f',
        encoding: 'linear8',
        colors: 'ff0080' + '102030',
      },
      'day',
      { nativePalette: 'pal-abc', nativePaletteSlots: 2 },
    );

    expect(decoded.background).toBe('#44899f');
    expect(decoded.colors).toHaveLength(6);
    expect(decoded.colors[0]).toBe(255 * 257);
    expect(decoded.colors[1]).toBe(0);
    expect(decoded.colors[2]).toBe(128 * 257);
  });

  it('decodes night srgb8 palette with sRGB-to-linear expansion and rejects invalid schemas', () => {
    const decoded = decodeNative3DPalette(
      {
        schema: 1,
        id: 'pal-abc',
        theme: 'night',
        background: '#272962',
        encoding: 'srgb8',
        colors: '00ff80',
      },
      'night',
      { nativePalette: 'pal-abc', nativePaletteSlots: 1 },
    );

    expect(decoded.background).toBe('#272962');
    expect(decoded.colors[0]).toBe(0);
    expect(decoded.colors[1]).toBe(65535);
    expect(decoded.colors[2]).toBeLessThan(32768);

    expect(() =>
      decodeNative3DPalette(
        { schema: 2, id: 'pal-abc', theme: 'day', background: '#44899f', encoding: 'linear8', colors: 'ff0080' },
        'day',
        { nativePalette: 'pal-abc', nativePaletteSlots: 1 },
      ),
    ).toThrow(/Invalid 3D map/i);
  });

  it('resolves surface priority from node hierarchy names', () => {
    expect(resolveSurfacePriority(['Mesh_12', 'buildings_42'])).toBe(7);
    expect(resolveSurfacePriority(['buildingdetail_3'])).toBe(8);
    expect(resolveSurfacePriority(['roads_1'])).toBe(3);
    expect(resolveSurfacePriority(['water'])).toBe(1);
    expect(resolveSurfacePriority(['unknown_group'])).toBe(0);
  });

  it('builds Mercator model matrix aligning GTAVIMap game-world coordinates to tile grid (127, 127)', () => {
    const m = buildNative3DMercatorMatrixElements();
    const mapX = (gx: number) => m[0] * gx + m[3];
    const mapZ = (gz: number) => m[6] * gz + m[7];

    // Origin left=-15872, top=13312 maps exactly to tile (127, 127) at baseZoom 8 (world=256)
    expect(mapX(-15872)).toBeCloseTo(127 / 256, 8);
    expect(mapZ(-13312)).toBeCloseTo(127 / 256, 8);

    // Game origin (0, 0) lies inside the central Leonida bounds
    expect(mapX(0)).toBeGreaterThan(127 / 256);
    expect(mapZ(0)).toBeGreaterThan(127 / 256);
  });
});
