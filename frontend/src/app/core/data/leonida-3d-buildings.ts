import { GeoJsonFeatureCollection, LeonidaPoi } from './leonida-map.data';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

const NON_BUILDING_PATTERN =
  /bridge|tunnel|lake|river|swamp|creek|bay|beach|park|sign|rail|road|interchange|island|sound|canal/i;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getBuildingStyle(poi: LeonidaPoi, seed: number): { color: string; height: number } {
  const factor = (seed % 100) / 100;
  switch (poi.category) {
    case 'Hotéis':
      return {
        color: seed % 2 === 0 ? '#F36A78' : '#FF9B55',
        height: Math.round(95000 + factor * 135000),
      };
    case 'Pontos-Chave':
      return {
        color: seed % 2 === 0 ? '#C9349B' : '#7B208F',
        height: Math.round(70000 + factor * 130000),
      };
    case 'Acessíveis':
      return {
        color: '#4CE0D2',
        height: Math.round(55000 + factor * 85000),
      };
    case 'Lojas':
      return {
        color: '#FFB458',
        height: Math.round(35000 + factor * 55000),
      };
    case 'Eventos':
      return {
        color: '#F44E8F',
        height: Math.round(45000 + factor * 65000),
      };
    default:
      return {
        color: '#64748B',
        height: Math.round(35000 + factor * 50000),
      };
  }
}

export function buildLeonida3DBuildings(pois: LeonidaPoi[]): GeoJsonFeatureCollection<GeoJsonPolygon> {
  const priorityOrder: Record<string, number> = {
    Hotéis: 0,
    Acessíveis: 1,
    Lojas: 2,
    Eventos: 3,
    'Pontos-Chave': 4,
    Transporte: 5,
  };

  const candidates = pois
    .filter((poi) => poi.category !== 'Natureza' && !NON_BUILDING_PATTERN.test(poi.name))
    .sort((a, b) => (priorityOrder[a.category] ?? 9) - (priorityOrder[b.category] ?? 9))
    .slice(0, 280);

  return {
    type: 'FeatureCollection',
    features: candidates.map((poi) => {
      const seed = hashString(poi.id + poi.name);
      const halfLng = 0.28 + ((seed % 31) / 100);
      const aspect = 0.75 + (((seed >>> 8) % 51) / 100);
      const cosLat = Math.max(0.35, Math.cos((poi.lat * Math.PI) / 180));
      const halfLat = halfLng * cosLat * aspect;
      const { color, height } = getBuildingStyle(poi, seed);

      return {
        type: 'Feature',
        properties: {
          id: poi.id,
          color,
          height,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [poi.lng - halfLng, poi.lat - halfLat],
              [poi.lng + halfLng, poi.lat - halfLat],
              [poi.lng + halfLng, poi.lat + halfLat],
              [poi.lng - halfLng, poi.lat + halfLat],
              [poi.lng - halfLng, poi.lat - halfLat],
            ],
          ],
        },
      };
    }),
  };
}
