export class Map {
  on = jest.fn();
  easeTo = jest.fn();
  panBy = jest.fn();
  getCenter = jest.fn(() => ({ lng: -80.1918, lat: 25.7617 }));
  getZoom = jest.fn(() => 12.5);
  getPitch = jest.fn(() => 0);
  getBearing = jest.fn(() => 0);
  remove = jest.fn();
}
