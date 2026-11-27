import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TILE_SIZE = 512;
const DEM_SIZE = 1024; // 2x2 grid of 512px

const PEAKS = [
  { name: 'Mount Kalaga', lng: -37.69, lat: 57.15, height: 14000, radius: 68 },
  { name: 'Mount Mountain', lng: -49.18, lat: 50.29, height: 10500, radius: 58 },
  { name: 'Mount Waffles', lng: -57.82, lat: 52.13, height: 8500, radius: 52 },
  { name: 'Northern Ridge', lng: -28.0, lat: 60.5, height: 9000, radius: 55 },
  { name: 'Easy Hill', lng: -62.53, lat: 39.9, height: 5200, radius: 55 },
];

function lngLatToPixel(lng, lat, size) {
  const x = ((lng + 180) / 360) * size;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size;
  return [x, y];
}

function isOceanRgb(r, g, b) {
  return b > g * 0.92 && r < 95;
}

function boxBlurPass(src, dst, width, height, radius) {
  const temp = new Float32Array(width * height);
  const win = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      const cx = Math.max(0, Math.min(width - 1, dx));
      sum += src[row + cx];
    }
    for (let x = 0; x < width; x++) {
      temp[row + x] = sum / win;
      const outX = Math.max(0, x - radius);
      const inX = Math.min(width - 1, x + radius + 1);
      sum += src[row + inX] - src[row + outX];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      const cy = Math.max(0, Math.min(height - 1, dy));
      sum += temp[cy * width + x];
    }
    for (let y = 0; y < height; y++) {
      dst[y * width + x] = sum / win;
      const outY = Math.max(0, y - radius);
      const inY = Math.min(height - 1, y + radius + 1);
      sum += temp[inY * width + x] - temp[outY * width + x];
    }
  }
}

function encodeTerrariumRgb(elevations) {
  const out = Buffer.alloc(elevations.length * 3);
  for (let i = 0; i < elevations.length; i++) {
    const v = Math.max(0, Math.min(65535.996, elevations[i] + 32768));
    const r = Math.floor(v / 256);
    const rem = v - r * 256;
    const g = Math.floor(rem);
    const b = Math.floor((rem - g) * 256);
    const idx = i * 3;
    out[idx] = r;
    out[idx + 1] = g;
    out[idx + 2] = b;
  }
  return out;
}

function downsampleFloat2x(src, srcSize) {
  const dstSize = srcSize / 2;
  const dst = new Float32Array(dstSize * dstSize);
  for (let y = 0; y < dstSize; y++) {
    const sy = y * 2;
    for (let x = 0; x < dstSize; x++) {
      const sx = x * 2;
      const sum =
        src[sy * srcSize + sx] +
        src[sy * srcSize + sx + 1] +
        src[(sy + 1) * srcSize + sx] +
        src[(sy + 1) * srcSize + sx + 1];
      dst[y * dstSize + x] = sum * 0.25;
    }
  }
  return dst;
}

async function main() {
  const dayZ1Dir = path.resolve(__dirname, '../public/tiles/day/1');
  const demOutDir = path.resolve(__dirname, '../public/tiles/dem');

  const composites = [];
  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
      composites.push({
        input: path.join(dayZ1Dir, String(x), `${y}.webp`),
        left: x * TILE_SIZE,
        top: y * TILE_SIZE,
      });
    }
  }

  const { data: rgb } = await sharp({
    create: {
      width: DEM_SIZE,
      height: DEM_SIZE,
      channels: 3,
      background: { r: 47, g: 144, b: 176 },
    },
  })
    .composite(composites)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const oceanMask = new Uint8Array(DEM_SIZE * DEM_SIZE);
  const heights = new Float32Array(DEM_SIZE * DEM_SIZE);

  for (let i = 0; i < DEM_SIZE * DEM_SIZE; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const ocean = isOceanRgb(r, g, b);
    oceanMask[i] = ocean ? 1 : 0;
    heights[i] = ocean ? 0 : 400;
  }

  for (const peak of PEAKS) {
    const [px, py] = lngLatToPixel(peak.lng, peak.lat, DEM_SIZE);
    const twoSigma2 = 2 * peak.radius * peak.radius;
    const minY = Math.max(0, Math.floor(py - peak.radius * 3));
    const maxY = Math.min(DEM_SIZE - 1, Math.ceil(py + peak.radius * 3));
    const minX = Math.max(0, Math.floor(px - peak.radius * 3));
    const maxX = Math.min(DEM_SIZE - 1, Math.ceil(px + peak.radius * 3));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * DEM_SIZE + x;
        if (oceanMask[idx]) continue;
        const dx = x - px;
        const dy = y - py;
        const dist2 = dx * dx + dy * dy;
        heights[idx] += peak.height * Math.exp(-dist2 / twoSigma2);
      }
    }
  }

  let current = heights;
  let scratch = new Float32Array(DEM_SIZE * DEM_SIZE);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(current, scratch, DEM_SIZE, DEM_SIZE, 6);
    [current, scratch] = [scratch, current];
  }

  for (let i = 0; i < current.length; i++) {
    if (oceanMask[i]) {
      current[i] = Math.min(current[i], 40);
    }
  }

  await fs.rm(demOutDir, { recursive: true, force: true });

  // z=0 (512x512) downsampled from float elevations before Terrarium RGB encoding
  const z0Elev = downsampleFloat2x(current, DEM_SIZE);
  const z0Rgb = encodeTerrariumRgb(z0Elev);
  await fs.mkdir(path.join(demOutDir, '0', '0'), { recursive: true });
  await sharp(z0Rgb, { raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(demOutDir, '0', '0', '0.png'));

  // z=1 (4 tiles of 512x512)
  const z1Rgb = encodeTerrariumRgb(current);
  for (let x = 0; x < 2; x++) {
    await fs.mkdir(path.join(demOutDir, '1', String(x)), { recursive: true });
    for (let y = 0; y < 2; y++) {
      await sharp(z1Rgb, { raw: { width: DEM_SIZE, height: DEM_SIZE, channels: 3 } })
        .extract({
          left: x * TILE_SIZE,
          top: y * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
        })
        .png({ compressionLevel: 9 })
        .toFile(path.join(demOutDir, '1', String(x), `${y}.png`));
    }
  }

  console.log('Generated Terrarium DEM tiles (z=0..1) at frontend/public/tiles/dem/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
