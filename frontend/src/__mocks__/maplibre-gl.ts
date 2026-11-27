export class Map {
  on = (): void => {};
  easeTo = (): void => {};
  panBy = (): void => {};
  getCenter = (): { lng: number; lat: number } => ({ lng: -80.1918, lat: 25.7617 });
  getZoom = (): number => 12.5;
  getPitch = (): number => 0;
  getBearing = (): number => 0;
  remove = (): void => {};
}
