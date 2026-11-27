import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TILE_SIZE = 512;
const GTADB_TILE_SIZE = 256;
const MASTER_GRID = 32;
const MASTER_SIZE = MASTER_GRID * GTADB_TILE_SIZE; // 8192
const MAX_ZOOM = 5;
const CONCURRENCY = 16;

const OCEAN = { r: 47, g: 144, b: 176 };
const OCEAN_HEX = '#2F90B0';

function parseArgs(argv) {
  let sourceRoot = 'D:\\Cliente\\Danilo.EUA\\gtadb.org';
  const outRoot = path.resolve(__dirname, '../public');

  for (const arg of argv) {
    if (arg.startsWith('--source=')) {
      sourceRoot = path.resolve(arg.slice('--source='.length));
    }
  }

  return { sourceRoot, outRoot };
}

async function runWithConcurrency(tasks, limit) {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      await tasks[current]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
}

async function buildMasterBuffer(srcDir) {
  const entries = await fs.readdir(srcDir);
  const composites = [];

  for (const file of entries) {
    const match = file.match(/^(\d+),(\d+),(\d+)\.(jpg|jpeg|png|webp)$/i);
    if (!match) continue;
    const y = Number.parseInt(match[2], 10);
    const x = Number.parseInt(match[3], 10);
    if (x < 0 || x >= MASTER_GRID || y < 0 || y >= MASTER_GRID) continue;

    composites.push({
      input: path.join(srcDir, file),
      left: x * GTADB_TILE_SIZE,
      top: y * GTADB_TILE_SIZE,
    });
  }

  console.log(`  Compositing ${composites.length} tiles from ${srcDir}...`);

  const { data, info } = await sharp({
    create: {
      width: MASTER_SIZE,
      height: MASTER_SIZE,
      channels: 4,
      background: { r: OCEAN.r, g: OCEAN.g, b: OCEAN.b, alpha: 1 },
    },
    limitInputPixels: false,
  })
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, info };
}

async function sliceDayTiles(sourceRoot, tilesRoot) {
  const destDir = path.join(tilesRoot, 'day');
  await fs.mkdir(destDir, { recursive: true });

  const z3Dir = path.join(sourceRoot, 'maps', 'tiles', '6', 'day', '3');
  const master = await buildMasterBuffer(z3Dir);

  let tileCount = 0;
  let totalBytes = 0;

  for (let z = 0; z <= 4; z++) {
    const gridSize = 2 ** z;
    const canvasSize = gridSize * TILE_SIZE;
    console.log(`  [day] slicing z=${z} (${gridSize}x${gridSize}, ${canvasSize}px)...`);

    let levelRaw = master.data;
    let levelInfo = master.info;

    if (canvasSize !== MASTER_SIZE) {
      const resized = await sharp(master.data, {
        limitInputPixels: false,
        raw: {
          width: master.info.width,
          height: master.info.height,
          channels: master.info.channels,
        },
      })
        .resize(canvasSize, canvasSize)
        .raw()
        .toBuffer({ resolveWithObject: true });
      levelRaw = resized.data;
      levelInfo = resized.info;
    }

    const tasks = [];
    for (let x = 0; x < gridSize; x++) {
      const xDir = path.join(destDir, String(z), String(x));
      await fs.mkdir(xDir, { recursive: true });

      for (let y = 0; y < gridSize; y++) {
        const outPath = path.join(xDir, `${y}.webp`);
        tasks.push(async () => {
          const buf = await sharp(levelRaw, {
            limitInputPixels: false,
            raw: {
              width: levelInfo.width,
              height: levelInfo.height,
              channels: levelInfo.channels,
            },
          })
            .extract({
              left: x * TILE_SIZE,
              top: y * TILE_SIZE,
              width: TILE_SIZE,
              height: TILE_SIZE,
            })
            .webp({ quality: 82 })
            .toBuffer();

          await fs.writeFile(outPath, buf);
          tileCount++;
          totalBytes += buf.length;
        });
      }
    }

    await runWithConcurrency(tasks, CONCURRENCY);
  }

  // z=5 (32x32 of 512px = 16384x16384) stitched directly 2x2 from gtadb day/4 (256px)
  const z4Dir = path.join(sourceRoot, 'maps', 'tiles', '6', 'day', '4');
  console.log('  [day] stitching z=5 (32x32, 16384px) from gtadb day/4...');
  const oceanTileBuf = await sharp({
    create: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      channels: 4,
      background: { r: OCEAN.r, g: OCEAN.g, b: OCEAN.b, alpha: 1 },
    },
  })
    .webp({ quality: 82 })
    .toBuffer();

  const z5Tasks = [];
  for (let x = 0; x < 32; x++) {
    const xDir = path.join(destDir, '5', String(x));
    await fs.mkdir(xDir, { recursive: true });

    for (let y = 0; y < 32; y++) {
      const outPath = path.join(xDir, `${y}.webp`);
      z5Tasks.push(async () => {
        const parts = [];
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const gx = x * 2 + dx;
            const gy = y * 2 + dy;
            const filePath = path.join(z4Dir, `4,${gy},${gx}.jpg`);
            if (existsSync(filePath)) {
              parts.push({
                input: filePath,
                left: dx * GTADB_TILE_SIZE,
                top: dy * GTADB_TILE_SIZE,
              });
            }
          }
        }

        if (parts.length === 0) {
          await fs.writeFile(outPath, oceanTileBuf);
          tileCount++;
          totalBytes += oceanTileBuf.length;
          return;
        }

        const buf = await sharp({
          create: {
            width: TILE_SIZE,
            height: TILE_SIZE,
            channels: 4,
            background: { r: OCEAN.r, g: OCEAN.g, b: OCEAN.b, alpha: 1 },
          },
        })
          .composite(parts)
          .webp({ quality: 82 })
          .toBuffer();

        await fs.writeFile(outPath, buf);
        tileCount++;
        totalBytes += buf.length;
      });
    }
  }

  await runWithConcurrency(z5Tasks, CONCURRENCY);
  return { tileCount, totalBytes };
}

function metersToLngLat(x, y) {
  const lng = Number(((x / 16384) * 180).toFixed(5));
  const latRad = 2 * Math.atan(Math.exp((y / 16384) * Math.PI)) - Math.PI / 2;
  const lat = Number(((latRad * 180) / Math.PI).toFixed(5));
  return [lng, lat];
}

function mapTagsToCategory(tags) {
  if (tags.includes('hotel')) return 'Hotéis';
  if (tags.includes('retail') || tags.includes('restaurant') || tags.includes('#supermarket')) {
    return 'Lojas';
  }
  if (tags.includes('events') || tags.includes('leisure')) return 'Eventos';
  if (tags.includes('transportation') || tags.includes('#bus')) return 'Transporte';
  if (tags.includes('natural')) return 'Natureza';
  if (tags.includes('enterable')) return 'Acessíveis';
  return 'Pontos-Chave';
}

async function importLandmarks(sourceRoot, dataRoot) {
  const srcPath = path.join(sourceRoot, 'map', 'data', '6', 'landmarks.json');
  const raw = JSON.parse(await fs.readFile(srcPath, 'utf8'));
  const pois = [];

  for (const [id, entry] of Object.entries(raw)) {
    const [fullName, igCoords, , rlName, , , tags = []] = entry;
    if (!fullName || fullName.startsWith('?')) continue;
    if (!Array.isArray(igCoords) || igCoords.length !== 2) continue;
    if (tags.includes('unconfirmed') || tags.includes('demolished')) continue;

    const parts = fullName.split(',');
    const name = parts[0].trim();
    if (!name || name === '?') continue;

    const region = parts.slice(1).join(', ').trim() || 'Leonida';
    const [lng, lat] = metersToLngLat(igCoords[0], igCoords[1]);
    const category = mapTagsToCategory(tags);
    const description = rlName
      ? `Inspirado em ${rlName.split(',')[0].trim()}.`
      : `Ponto mapeado em ${region}.`;

    pois.push({ id, name, category, region, description, lng, lat });
  }

  await fs.mkdir(dataRoot, { recursive: true });
  await fs.writeFile(path.join(dataRoot, 'leonida-landmarks.json'), JSON.stringify(pois), 'utf8');
  return pois.length;
}

async function main() {
  const start = Date.now();
  const { sourceRoot, outRoot } = parseArgs(process.argv.slice(2));
  const tilesRoot = path.join(outRoot, 'tiles');
  const dataRoot = path.join(outRoot, 'data');

  console.log(`Importing gtadb.org Leonida assets (z=0..${MAX_ZOOM}) from: ${sourceRoot}`);
  await fs.rm(tilesRoot, { recursive: true, force: true });
  await fs.mkdir(tilesRoot, { recursive: true });

  const stats = await sliceDayTiles(sourceRoot, tilesRoot);
  const landmarksCount = await importLandmarks(sourceRoot, dataRoot);

  const meta = {
    source: 'gtadb.org (CC BY 4.0)',
    tileSize: TILE_SIZE,
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    landmarksCount,
    styles: [
      {
        id: 'day',
        label: 'Leonida',
        oceanColor: OCEAN_HEX,
        tiles: stats.tileCount,
        sizeMb: Number((stats.totalBytes / (1024 * 1024)).toFixed(2)),
      },
    ],
  };

  await fs.writeFile(path.join(tilesRoot, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s! Landmarks=${landmarksCount}, day=${meta.styles[0].sizeMb}MB (${stats.tileCount} tiles)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
