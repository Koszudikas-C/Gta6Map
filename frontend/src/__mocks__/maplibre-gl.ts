export function setWorkerUrl(): void {}

export class Marker {
  setLngLat(): this {
    return this;
  }
  addTo(): this {
    return this;
  }
  on(): this {
    return this;
  }
  getLngLat(): { lng: number; lat: number } {
    return { lng: -25, lat: 10 };
  }
  remove(): void {}
}

export class Map {
  on = (): void => {};
  easeTo = (): void => {};
  flyTo = (): void => {};
  panBy = (): void => {};
  addSource = (): void => {};
  addLayer = (): void => {};
  setLayoutProperty = (): void => {};
  setPaintProperty = (): void => {};
  setTerrain = (): void => {};
  setMaxZoom = (): void => {};
  getCenter = (): { lng: number; lat: number } => ({ lng: -25, lat: 10 });
  getZoom = (): number => 2.2;
  getPitch = (): number => 0;
  getBearing = (): number => 0;
  getSource = (): undefined => undefined;
  remove = (): void => {};
}
