import { getPoiItemMeta } from './poi-category-icons';

export type MapQualityMode = 'light' | 'hd';

export type PoiCategory =
  | 'Todas'
  | 'Pontos-Chave'
  | 'Hotéis'
  | 'Lojas'
  | 'Acessíveis'
  | 'Eventos'
  | 'Transporte'
  | 'Natureza';

export const POI_CATEGORIES: readonly PoiCategory[] = [
  'Todas',
  'Pontos-Chave',
  'Hotéis',
  'Lojas',
  'Acessíveis',
  'Eventos',
  'Transporte',
  'Natureza',
];

export interface GeoJsonFeatureCollection<TGeometry> {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: TGeometry;
  }>;
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface LeonidaPoi {
  id: string;
  name: string;
  category: Exclude<PoiCategory, 'Todas'>;
  region: string;
  description: string;
  lng: number;
  lat: number;
  icon?: string;
}

export function gtaviGameToLngLat(x: number, y: number): [number, number] {
  const n = 256; // 2 ** 8
  const tileX = (127 + (x - -15872) / 24576) / n;
  const tileY = (127 + (13312 - y) / 24576) / n;
  const lng = tileX * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY))) * 180) / Math.PI;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

export function legacyLeonidaToGtaviLngLat(lng: number, lat: number): [number, number] {
  const x = (lng - 0.03821745048517755) / 0.01097039015486187;
  const mercY = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
  const y = (mercY - -0.06792250242607523) / 0.010980564994789202;
  return gtaviGameToLngLat(x, y);
}

export function normalizeToMapLngLat(lng: number, lat: number): [number, number] {
  if (lng >= -1.6 && lng <= 0.2 && lat >= -0.2 && lat <= 1.6) {
    return [lng, lat];
  }
  if (lng >= -135 && lng <= 80 && lat >= -75 && lat <= 78) {
    return legacyLeonidaToGtaviLngLat(lng, lat);
  }
  return [lng, lat];
}

export const LEONIDA_MAP_CONFIG = {
  styles: {
    satellite: { id: 'day', oceanColor: '#4891a8', label: 'Leonida', maxZoom: 17 },
  },
  tileUrl: 'https://map-tiles.b-cdn.net/assets/gtavi/day/{z}/{x}_{y}.jpg',
  tileBounds: [-1.40625, 0, 0, 1.4061088354351563] as [number, number, number, number],
  tileSize: 256,
  minZoom: 8,
  maxZoom: 17,
  hdMaxZoom: 17.5,
  lightMaxZoom: 14.5,
  initialCenter: [-0.661387, 0.416441] as [number, number],
  initialZoom: 10.5,
  maxBounds: [
    [-1.55, -0.15],
    [0.15, 1.55],
  ] as [[number, number], [number, number]],
  native3D: {
    geometryUrl: 'https://map-tiles.b-cdn.net/assets/gtavi/native-3d-v2/geometry.glb',
    themePath: 'data/native-3d-v2/',
    fallbackThemeBaseUrl: 'https://map-tiles.b-cdn.net/assets/gtavi/native-3d-v2/',
    baseZoom: 8,
    origin: [127, 127] as [number, number],
    left: -15872,
    top: 13312,
    size: 24576,
  },
};

export const LEONIDA_POIS: LeonidaPoi[] = [
  {
    id: 'L1',
    name: 'Vice Regal',
    category: 'Hotéis',
    region: 'Washington Beach, Vice Beach',
    description: 'Inspirado em The Ritz-Carlton Bal Harbour.',
    lng: legacyLeonidaToGtaviLngLat(15.4839, 29.59315)[0],
    lat: legacyLeonidaToGtaviLngLat(15.4839, 29.59315)[1],
  },
  {
    id: 'L16',
    name: 'Y Vice City',
    category: 'Pontos-Chave',
    region: 'Washington Beach, Vice Beach',
    description: 'Inspirado em W South Beach.',
    lng: legacyLeonidaToGtaviLngLat(21.51512, 17.24634)[0],
    lat: legacyLeonidaToGtaviLngLat(21.51512, 17.24634)[1],
  },
  {
    id: 'L36',
    name: 'Ocean View Hotel',
    category: 'Hotéis',
    region: 'Ocean Beach, Vice Beach',
    description: 'Inspirado em Clevelander South Beach.',
    lng: legacyLeonidaToGtaviLngLat(21.53027, 7.00797)[0],
    lat: legacyLeonidaToGtaviLngLat(21.53027, 7.00797)[1],
  },
  {
    id: 'L91',
    name: 'Eager Beaver Express',
    category: 'Lojas',
    region: 'Port Gellhorn',
    description: 'Ponto mapeado em Port Gellhorn.',
    lng: legacyLeonidaToGtaviLngLat(-69.769, 28.92616)[0],
    lat: legacyLeonidaToGtaviLngLat(-69.769, 28.92616)[1],
  },
];

export function poisToGeoJson(pois: LeonidaPoi[]): GeoJsonFeatureCollection<GeoJsonPoint> {
  return {
    type: 'FeatureCollection',
    features: pois.map((poi) => ({
      type: 'Feature',
      properties: {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        icon: poi.icon ?? '',
        iconKey: getPoiItemMeta(poi.category, poi.name).id,
        region: poi.region,
        description: poi.description,
      },
      geometry: {
        type: 'Point',
        coordinates: [poi.lng, poi.lat],
      },
    })),
  };
}
