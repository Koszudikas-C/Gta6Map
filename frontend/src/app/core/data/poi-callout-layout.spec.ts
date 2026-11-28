import { LeonidaPoi } from './leonida-map.data';
import { groupOverlappingPois } from './poi-callout-layout';

describe('groupOverlappingPois', () => {
  const makePoi = (id: string, lng: number, lat: number): LeonidaPoi => ({
    id,
    name: `POI ${id}`,
    category: 'Pontos-Chave',
    region: 'Leonida',
    description: '',
    lng,
    lat,
  });

  it('keeps distant POIs ungrouped with stackCount 1', () => {
    const pois = [makePoi('a', -0.661, 0.416), makePoi('b', -0.5, 0.55)];
    const result = groupOverlappingPois(pois, 15.5, 22);

    expect(result.geoJson.features).toHaveLength(2);
    expect(result.geoJson.features[0].properties?.['stackCount']).toBe(1);
    expect(result.geoJson.features[0].properties?.['stackBadgeIcon']).toBe('');
    expect(result.geoJson.features[1].properties?.['stackCount']).toBe(1);
    expect(result.geoJson.features[1].properties?.['stackBadgeIcon']).toBe('');
    expect(result.groupsByPoiId.get('a')).toHaveLength(1);
  });

  it('groups overlapping POIs into a single representative with stackCount > 1 and maps all members', () => {
    const pois = [makePoi('a', -0.661, 0.416), makePoi('b', -0.661, 0.416)];
    const result = groupOverlappingPois(pois, 15.5, 22);

    expect(result.geoJson.features).toHaveLength(1);
    expect(result.geoJson.features[0].properties?.['stackCount']).toBe(2);
    expect(result.geoJson.features[0].properties?.['stackLabel']).toBe('2');
    expect(result.geoJson.features[0].properties?.['stackBadgeIcon']).toBe('stack-badge-2');
    expect(result.groupsByPoiId.get('a')?.map((p) => p.id)).toEqual(['a', 'b']);
    expect(result.groupsByPoiId.get('b')?.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('uses preferredPoiId as the map representative icon when cycling a stacked group', () => {
    const pois: LeonidaPoi[] = [
      makePoi('a', -0.661, 0.416),
      { ...makePoi('b', -0.661, 0.416), category: 'Hotéis', name: 'Ocean View Hotel' },
    ];

    const initial = groupOverlappingPois(pois, 15.5, 22);
    const switched = groupOverlappingPois(pois, 15.5, 22, 'b');

    expect(initial.geoJson.features[0].properties?.['id']).toBe('a');
    expect(switched.geoJson.features[0].properties?.['id']).toBe('b');
    expect(switched.geoJson.features[0].properties?.['stackCount']).toBe(2);
    expect(switched.geoJson.features[0].properties?.['iconKey']).not.toBe(
      initial.geoJson.features[0].properties?.['iconKey'],
    );
  });
});
