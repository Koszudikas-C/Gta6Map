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
}

export const LEONIDA_MAP_CONFIG = {
  styles: {
    satellite: { id: 'day', oceanColor: '#2F90B0', label: 'Leonida', maxZoom: 5 },
  },
  tileSize: 512,
  minZoom: 0,
  maxZoom: 5,
  initialCenter: [-25, 10] as [number, number],
  initialZoom: 2.2,
  maxBounds: [
    [-135, -75],
    [80, 78],
  ] as [[number, number], [number, number]],
};

export const LEONIDA_POIS: LeonidaPoi[] = [
  {
    id: 'L1',
    name: 'Vice Regal',
    category: 'Hotéis',
    region: 'Washington Beach, Vice Beach',
    description: 'Inspirado em The Ritz-Carlton Bal Harbour.',
    lng: 15.4839,
    lat: 29.59315,
  },
  {
    id: 'L16',
    name: 'Y Vice City',
    category: 'Pontos-Chave',
    region: 'Washington Beach, Vice Beach',
    description: 'Inspirado em W South Beach.',
    lng: 21.51512,
    lat: 17.24634,
  },
  {
    id: 'L36',
    name: 'Ocean View Hotel',
    category: 'Hotéis',
    region: 'Ocean Beach, Vice Beach',
    description: 'Inspirado em Clevelander South Beach.',
    lng: 21.53027,
    lat: 7.00797,
  },
  {
    id: 'L91',
    name: 'Eager Beaver Express',
    category: 'Lojas',
    region: 'Port Gellhorn',
    description: 'Ponto mapeado em Port Gellhorn.',
    lng: -69.769,
    lat: 28.92616,
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
