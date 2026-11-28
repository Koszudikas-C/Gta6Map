import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  DecodedNative3DPalette,
  NATIVE_3D_SURFACE_PRIORITY,
  Native3DSceneUserData,
  Native3DTheme,
  Native3DThemeJson,
  buildNative3DMercatorMatrixElements,
  decodeNative3DPalette,
  resolveSurfacePriority,
} from './native-3d-palette';

export interface Native3DCustomLayer extends CustomLayerInterface {
  readonly backgroundColor: string;
  setTheme(theme: Native3DTheme): Promise<void>;
  dispose(): void;
}

export interface CreateNative3DLayerOptions {
  signal: AbortSignal;
  geometryUrl: string;
  themeBaseUrl: string;
  fallbackThemeBaseUrl: string;
  theme?: Native3DTheme;
  onTiming?: (
    name: string,
    durationMs: number,
    meta?: Record<string, unknown>,
    slowThresholdMs?: number,
  ) => void;
}

const GUIDE_VERTEX_SHADER = `
  varying vec3 surfacePosition;
  void main() {
    surfacePosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GUIDE_FRAGMENT_SHADER = `
  uniform float building;
  varying vec3 surfacePosition;
  void main() {
    if (building == 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec3 normal = cross(dFdx(surfacePosition), dFdy(surfacePosition));
    normal *= inversesqrt(max(dot(normal, normal), 1e-16));
    gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
  }
`;

const OUTLINE_VERTEX_SHADER = `
  varying vec2 screenUV;
  void main() {
    screenUV = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const OUTLINE_FRAGMENT_SHADER = `
  uniform sampler2D guide;
  uniform sampler2D depth;
  uniform vec2 pixelStep;
  uniform vec3 ink;
  uniform float strength;
  varying vec2 screenUV;

  float normalEdge(vec4 center, vec2 offset) {
    vec4 neighbor = texture2D(guide, screenUV + offset);
    if (neighbor.a < 0.5) return 1.0;
    vec3 a = normalize(center.xyz * 2.0 - 1.0);
    vec3 b = normalize(neighbor.xyz * 2.0 - 1.0);
    return smoothstep(0.095, 0.29, 1.0 - dot(a, b));
  }

  float depthEdge(float center, vec2 offset) {
    float ahead = texture2D(depth, screenUV + offset).r;
    float behind = texture2D(depth, screenUV - offset).r;
    float discontinuity = ahead + behind - 2.0 * center;
    return smoothstep(0.00012, 0.00065, discontinuity);
  }

  void main() {
    vec4 center = texture2D(guide, screenUV);
    if (center.a < 0.5) discard;
    vec2 x = vec2(pixelStep.x, 0.0);
    vec2 y = vec2(0.0, pixelStep.y);
    float edge = max(
      max(normalEdge(center, x), normalEdge(center, -x)),
      max(normalEdge(center, y), normalEdge(center, -y))
    );
    float z = texture2D(depth, screenUV).r;
    edge = max(edge, max(depthEdge(z, x), depthEdge(z, y)));
    if (edge < 0.01) discard;
    gl_FragColor = vec4(ink, edge * strength);
    #include <colorspace_fragment>
  }
`;

function smoothstep(x: number, edge0: number, edge1: number): number {
  if (x <= edge0) return 0;
  if (x >= edge1) return 1;
  const t = (x - edge0) / (edge1 - edge0);
  return t * t * (3 - 2 * t);
}

class BuildingOutlinePass {
  private readonly surfaces = new THREE.Scene();
  private readonly guideMaterials = new Map<THREE.Material, THREE.ShaderMaterial>();
  private readonly composite = new THREE.Scene();
  private readonly quad = new THREE.PlaneGeometry(2, 2);
  private readonly camera = new THREE.Camera();
  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      guide: { value: null },
      depth: { value: null },
      pixelStep: { value: new THREE.Vector2() },
      ink: { value: new THREE.Color('#394e63') },
      strength: { value: 0 },
    },
    vertexShader: OUTLINE_VERTEX_SHADER,
    fragmentShader: OUTLINE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
  });
  private target: THREE.WebGLRenderTarget | null = null;
  private ready = false;
  private opacity = 0.52;

  constructor() {
    const quadMesh = new THREE.Mesh(this.quad, this.material);
    quadMesh.frustumCulled = false;
    this.composite.add(quadMesh);
  }

  add(
    geometry: THREE.BufferGeometry,
    sourceMaterial: THREE.Material,
    renderOrder: number,
    isBuilding: boolean,
  ): void {
    let guideMat = this.guideMaterials.get(sourceMaterial);
    if (!guideMat) {
      guideMat = new THREE.ShaderMaterial({
        uniforms: { building: { value: isBuilding ? 1.0 : 0.0 } },
        vertexShader: GUIDE_VERTEX_SHADER,
        fragmentShader: GUIDE_FRAGMENT_SHADER,
        side: sourceMaterial.side,
        polygonOffset: sourceMaterial.polygonOffset,
        polygonOffsetFactor: sourceMaterial.polygonOffsetFactor,
        polygonOffsetUnits: sourceMaterial.polygonOffsetUnits,
        toneMapped: false,
      });
      this.guideMaterials.set(sourceMaterial, guideMat);
    }
    const mesh = new THREE.Mesh(geometry, guideMat);
    mesh.renderOrder = renderOrder;
    this.surfaces.add(mesh);
  }

  setTheme(theme: Native3DTheme): void {
    const isNight = theme === 'night';
    (this.material.uniforms['ink'].value as THREE.Color).set(isNight ? '#101426' : '#394e63');
    this.opacity = isNight ? 0.72 : 0.52;
  }

  prepare(renderer: THREE.WebGLRenderer, camera: THREE.Camera, zoom: number): void {
    this.ready = false;
    const strength = this.opacity * smoothstep(zoom, 12, 13.5);
    if (!strength || this.surfaces.children.length === 0) {
      return;
    }
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (!width || !height) {
      return;
    }

    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthTexture: new THREE.DepthTexture(width, height),
      });
    } else {
      this.target.setSize(width, height);
    }

    const dpr = Math.max(1, width / Math.max(1, renderer.domElement.clientWidth));
    (this.material.uniforms['pixelStep'].value as THREE.Vector2).set(dpr / width, dpr / height);
    this.material.uniforms['guide'].value = this.target.texture;
    this.material.uniforms['depth'].value = this.target.depthTexture;
    this.material.uniforms['strength'].value = strength;

    renderer.resetState();
    renderer.setRenderTarget(this.target);
    try {
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(this.surfaces, camera);
      this.ready = true;
    } finally {
      renderer.setRenderTarget(null);
    }
  }

  draw(renderer: THREE.WebGLRenderer): void {
    if (this.ready) {
      renderer.render(this.composite, this.camera);
    }
  }

  releaseTarget(): void {
    this.target?.dispose();
    this.target = null;
    this.ready = false;
    this.material.uniforms['guide'].value = null;
    this.material.uniforms['depth'].value = null;
  }

  dispose(): void {
    this.releaseTarget();
    for (const mat of this.guideMaterials.values()) {
      mat.dispose();
    }
    this.guideMaterials.clear();
    this.material.dispose();
    this.quad.dispose();
    this.composite.clear();
    this.surfaces.clear();
  }
}

function applyPaletteColors(geometry: THREE.BufferGeometry, palette: DecodedNative3DPalette): void {
  const paletteAttr = geometry.getAttribute('_palette');
  const positionAttr = geometry.getAttribute('position');
  if (!paletteAttr || paletteAttr.itemSize !== 1 || paletteAttr.count !== positionAttr.count) {
    throw new Error('Invalid 3D map material indices');
  }

  let colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!colorAttr) {
    colorAttr = new THREE.Uint16BufferAttribute(new Uint16Array(paletteAttr.count * 3), 3, true);
    geometry.setAttribute('color', colorAttr);
  }

  const target = colorAttr.array as Uint16Array;
  const source = palette.colors;
  for (let i = 0; i < paletteAttr.count; i++) {
    const slot = paletteAttr.getX(i);
    const srcIdx = slot * 3;
    if (!Number.isInteger(slot) || srcIdx < 0 || srcIdx + 2 >= source.length) {
      throw new Error('3D map material index out of bounds');
    }
    const dstIdx = i * 3;
    target[dstIdx] = source[srcIdx];
    target[dstIdx + 1] = source[srcIdx + 1];
    target[dstIdx + 2] = source[srcIdx + 2];
  }
  colorAttr.needsUpdate = true;
}

async function fetchThemeJson(
  theme: Native3DTheme,
  themeBaseUrl: string,
  fallbackThemeBaseUrl: string,
  signal: AbortSignal,
): Promise<Partial<Native3DThemeJson>> {
  const localUrl = `${themeBaseUrl}${theme}.json`;
  try {
    const localRes = await fetch(localUrl, { signal });
    if (localRes.ok) {
      return (await localRes.json()) as Partial<Native3DThemeJson>;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
  }
  const fallbackRes = await fetch(`${fallbackThemeBaseUrl}${theme}.json`, { signal });
  if (!fallbackRes.ok) {
    throw new Error(`3D map ${theme} material HTTP ${fallbackRes.status}`);
  }
  return (await fallbackRes.json()) as Partial<Native3DThemeJson>;
}

export async function createNative3DLayer(
  options: CreateNative3DLayerOptions,
): Promise<Native3DCustomLayer> {
  const { signal, geometryUrl, themeBaseUrl, fallbackThemeBaseUrl, onTiming } = options;
  const initialTheme: Native3DTheme = options.theme ?? 'day';
  const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const recordTiming = (
    name: string,
    startMs: number,
    meta?: Record<string, unknown>,
    slowThresholdMs?: number,
  ): void => {
    if (onTiming) {
      onTiming(name, Math.max(0, now() - startMs), meta, slowThresholdMs);
    }
  };

  const fetchStart = now();
  const glbPromise = fetch(geometryUrl, { signal }).then((res) => {
    if (!res.ok) {
      throw new Error(`3D map HTTP ${res.status}`);
    }
    return res.arrayBuffer();
  });

  const [glbBuffer, themeJson] = await Promise.all([
    glbPromise,
    fetchThemeJson(initialTheme, themeBaseUrl, fallbackThemeBaseUrl, signal),
  ]);
  recordTiming(
    'native3d.fetchGlbAndTheme',
    fetchStart,
    { glbBytes: glbBuffer.byteLength, theme: initialTheme },
    5000,
  );

  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const parseStart = now();
  const gltf = await new GLTFLoader().parseAsync(glbBuffer, '');
  recordTiming('native3d.gltfParse', parseStart, { glbBytes: glbBuffer.byteLength }, 500);

  const userData = gltf.scene.userData as Native3DSceneUserData;
  const decodeStart = now();
  let activePalette = decodeNative3DPalette(themeJson, initialTheme, userData);
  recordTiming('native3d.decodePalette', decodeStart, { theme: initialTheme }, 10);

  const themeAbort = new AbortController();
  const paletteCache = new Map<Native3DTheme, Promise<DecodedNative3DPalette>>([
    [initialTheme, Promise.resolve(activePalette)],
  ]);
  let themeSeq = 0;

  let waterMaterial: (THREE.Material & { color?: THREE.Color }) | null = null;
  const coloredGeometries: THREE.BufferGeometry[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  const buildStart = now();
  gltf.scene.updateMatrixWorld(true);
  const preparedGeometries: THREE.BufferGeometry[] = [];
  const sourceMaterials = new Set<THREE.Material>();

  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    const ancestorNames: string[] = [];
    let current: THREE.Object3D | null = node;
    while (current) {
      if (current.name) {
        ancestorNames.push(current.name);
      }
      current = current.parent;
    }
    geometry.userData['surfacePriority'] = resolveSurfacePriority(ancestorNames);
    preparedGeometries.push(geometry);
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (mat) {
        sourceMaterials.add(mat);
      }
    }
    node.geometry.dispose();
  });

  const baseMaterial = [...sourceMaterials][0];
  const outlinePass = new BuildingOutlinePass();
  outlinePass.setTheme(initialTheme);

  if (baseMaterial && sourceMaterials.size === 1) {
    const cellBuckets = new Map<string, THREE.BufferGeometry[]>();
    const materialByPriority = new Map<number, THREE.Material>();

    const getPriorityMaterial = (priority: number): THREE.Material => {
      const existing = materialByPriority.get(priority);
      if (existing) {
        return existing;
      }
      const cloned = baseMaterial.clone() as THREE.Material & {
        color?: THREE.Color;
        vertexColors?: boolean;
      };
      cloned.polygonOffset = priority > 0;
      cloned.polygonOffsetFactor = 0;
      cloned.polygonOffsetUnits = -2 * priority;
      if (priority === NATIVE_3D_SURFACE_PRIORITY['water']) {
        cloned.vertexColors = false;
        cloned.color?.set(activePalette.background);
        waterMaterial = cloned;
      } else {
        cloned.vertexColors = true;
      }
      materialByPriority.set(priority, cloned);
      sourceMaterials.add(cloned);
      return cloned;
    };

    const addCellMesh = (geometry: THREE.BufferGeometry, priority: number): void => {
      if (priority !== NATIVE_3D_SURFACE_PRIORITY['water']) {
        applyPaletteColors(geometry, activePalette);
        coloredGeometries.push(geometry);
      }
      const mat = getPriorityMaterial(priority);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.renderOrder = priority;
      scene.add(mesh);
      const isBuilding =
        priority === NATIVE_3D_SURFACE_PRIORITY['buildings'] ||
        priority === NATIVE_3D_SURFACE_PRIORITY['buildingdetail'];
      outlinePass.add(geometry, mat, priority, isBuilding);
    };

    const centerVec = new THREE.Vector3();
    for (const geom of preparedGeometries) {
      geom.computeBoundingBox();
      geom.boundingBox?.getCenter(centerVec);
      const priority = Number(geom.userData['surfacePriority'] ?? 0);
      const cellKey = `${priority}:${Math.floor(centerVec.x / 2048)}:${Math.floor(centerVec.z / 2048)}`;
      const list = cellBuckets.get(cellKey);
      if (list) {
        list.push(geom);
      } else {
        cellBuckets.set(cellKey, [geom]);
      }
    }

    for (const bucket of cellBuckets.values()) {
      const priority = Number(bucket[0].userData['surfacePriority'] ?? 0);
      const merged = bucket.length > 1 ? mergeGeometries(bucket, false) : bucket[0];
      if (merged) {
        merged.computeBoundingSphere();
        addCellMesh(merged, priority);
        if (merged !== bucket[0]) {
          for (const g of bucket) {
            g.dispose();
          }
        }
      } else {
        for (const g of bucket) {
          addCellMesh(g, priority);
        }
      }
    }
  } else {
    let idx = 0;
    gltf.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }
      const mesh = new THREE.Mesh(preparedGeometries[idx++], node.material);
      scene.add(mesh);
    });
  }

  recordTiming(
    'native3d.buildAndMergeMeshes',
    buildStart,
    {
      inputMeshes: preparedGeometries.length,
      coloredMeshes: coloredGeometries.length,
    },
    100,
  );

  const mercatorMatrix = new THREE.Matrix4().set(...buildNative3DMercatorMatrixElements());
  let renderer: THREE.WebGLRenderer | null = null;
  let mapRef: MapLibreMap | null = null;

  const extractMainMatrix = (args: CustomRenderMethodInput): ArrayLike<number> => {
    const maybe = args as unknown as {
      defaultProjectionData?: { mainMatrix?: ArrayLike<number> };
    };
    return maybe?.defaultProjectionData?.mainMatrix ?? (args as unknown as ArrayLike<number>);
  };

  const layer: Native3DCustomLayer = {
    id: 'native-pause-map-3d',
    type: 'custom',
    renderingMode: '3d',

    get backgroundColor(): string {
      return activePalette.background;
    },

    async setTheme(theme: Native3DTheme): Promise<void> {
      if (themeAbort.signal.aborted) {
        return;
      }
      const seq = ++themeSeq;
      let promise = paletteCache.get(theme);
      if (!promise) {
        promise = fetchThemeJson(
          theme,
          themeBaseUrl,
          fallbackThemeBaseUrl,
          themeAbort.signal,
        ).then((json) => decodeNative3DPalette(json, theme, userData));
        paletteCache.set(theme, promise);
        promise.catch(() => paletteCache.delete(theme));
      }
      const nextPalette = await promise;
      if (themeAbort.signal.aborted || seq !== themeSeq || nextPalette === activePalette) {
        return;
      }
      const recolorStart = now();
      for (const geom of coloredGeometries) {
        applyPaletteColors(geom, nextPalette);
      }
      waterMaterial?.color?.set(nextPalette.background);
      activePalette = nextPalette;
      outlinePass.setTheme(theme);
      recordTiming(
        'native3d.setTheme',
        recolorStart,
        { theme, geometries: coloredGeometries.length },
        16,
      );
      mapRef?.triggerRepaint();
    },

    onAdd(map: MapLibreMap, gl: WebGLRenderingContext): void {
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
        alpha: true,
      });
      renderer.autoClear = false;
      mapRef = map;
    },

    prerender(_gl: WebGLRenderingContext, args: CustomRenderMethodInput): void {
      if (!renderer || !mapRef) {
        return;
      }
      const prerenderStart = onTiming ? now() : 0;
      const mainMatrix = extractMainMatrix(args);
      camera.projectionMatrix.fromArray(Array.from(mainMatrix)).multiply(mercatorMatrix);
      outlinePass.prepare(renderer, camera, mapRef.getZoom());
      if (onTiming) {
        recordTiming(
          'native3d.prerenderOutline',
          prerenderStart,
          { zoom: Number(mapRef.getZoom().toFixed(2)) },
          4,
        );
      }
    },

    render(_gl: WebGLRenderingContext, args: CustomRenderMethodInput): void {
      if (!renderer) {
        return;
      }
      const renderStart = onTiming ? now() : 0;
      const mainMatrix = extractMainMatrix(args);
      camera.projectionMatrix.fromArray(Array.from(mainMatrix)).multiply(mercatorMatrix);
      renderer.resetState();
      renderer.render(scene, camera);
      outlinePass.draw(renderer);
      if (onTiming) {
        recordTiming('native3d.renderScene', renderStart, undefined, 6);
      }
    },

    onRemove(): void {
      outlinePass.releaseTarget();
      renderer?.dispose();
      renderer = null;
      mapRef = null;
    },

    dispose(): void {
      themeAbort.abort();
      paletteCache.clear();
      coloredGeometries.length = 0;
      outlinePass.dispose();
      mapRef = null;
      renderer?.dispose();
      renderer = null;
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      for (const mat of sourceMaterials) {
        mat.dispose();
      }
      scene.clear();
    },
  };

  if (signal.aborted) {
    layer.dispose();
    throw new DOMException('Aborted', 'AbortError');
  }

  return layer;
}
