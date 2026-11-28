import { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { LeonidaPoi } from './leonida-map.data';
import { getPoiItemMeta } from './poi-category-icons';

const TILE_SIZE = 512;
const MAX_LAT = 85.05112878;

function clampLat(lat: number): number {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
}

function projectMercator(lng: number, lat: number, worldSize: number): [number, number] {
  const x = ((lng + 180) / 360) * worldSize;
  const sinLat = Math.sin((clampLat(lat) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
  return [x, y];
}

export interface StackedPoiGroupResult {
  geoJson: FeatureCollection<Geometry, GeoJsonProperties>;
  groupsByPoiId: Map<string, LeonidaPoi[]>;
}

/**
 * Agrupa POIs que ficariam sobrepostos na tela no nível de zoom atual,
 * mantendo 1 ícone representativo com contador (`stackCount`) e permitindo
 * alternar entre todos os POIs daquele ponto ao selecioná-lo.
 */
export function groupOverlappingPois(
  pois: LeonidaPoi[],
  zoom: number,
  thresholdPx = 22,
  preferredPoiId?: string | null,
): StackedPoiGroupResult {
  const groupsByPoiId = new Map<string, LeonidaPoi[]>();

  if (pois.length === 0) {
    return {
      geoJson: { type: 'FeatureCollection', features: [] },
      groupsByPoiId,
    };
  }

  if (zoom <= 13.5) {
    for (const poi of pois) {
      groupsByPoiId.set(poi.id, [poi]);
    }
    return {
      geoJson: {
        type: 'FeatureCollection',
        features: pois.map((poi) => toStackedFeature(poi, 1)),
      },
      groupsByPoiId,
    };
  }

  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const cellSize = thresholdPx;
  const thresholdSq = thresholdPx * thresholdPx;
  const grid = new Map<string, Array<{ x: number; y: number; group: LeonidaPoi[] }>>();
  const groups: LeonidaPoi[][] = [];

  for (const poi of pois) {
    const [px, py] = projectMercator(poi.lng, poi.lat, worldSize);
    const gx = Math.floor(px / cellSize);
    const gy = Math.floor(py / cellSize);

    let matchedGroup: LeonidaPoi[] | null = null;
    let bestDistSq = thresholdSq;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${gx + dx},${gy + dy}`);
        if (!bucket) {
          continue;
        }
        for (const entry of bucket) {
          const distSq = (entry.x - px) ** 2 + (entry.y - py) ** 2;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            matchedGroup = entry.group;
          }
        }
      }
    }

    if (matchedGroup) {
      matchedGroup.push(poi);
    } else {
      const group = [poi];
      groups.push(group);
      const key = `${gx},${gy}`;
      const bucket = grid.get(key);
      if (bucket) {
        bucket.push({ x: px, y: py, group });
      } else {
        grid.set(key, [{ x: px, y: py, group }]);
      }
    }
  }

  const features = groups.map((group) => {
    for (const member of group) {
      groupsByPoiId.set(member.id, group);
    }
    const representative =
      (preferredPoiId ? group.find((member) => member.id === preferredPoiId) : undefined) ??
      group[0];
    return toStackedFeature(representative, group.length);
  });

  return {
    geoJson: {
      type: 'FeatureCollection',
      features,
    },
    groupsByPoiId,
  };
}

function toStackedFeature(poi: LeonidaPoi, stackCount: number) {
  return {
    type: 'Feature' as const,
    properties: {
      id: poi.id,
      name: poi.name,
      category: poi.category,
      region: poi.region,
      icon: poi.icon ?? '',
      iconKey: getPoiItemMeta(poi.category, poi.name).id,
      stackCount,
      stackLabel: stackCount > 1 ? String(stackCount) : '',
      stackBadgeIcon: stackCount > 1 ? `stack-badge-${stackCount}` : '',
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [poi.lng, poi.lat],
    },
  };
}
