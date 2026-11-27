import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TILE_SIZE = 512;
const CONCURRENCY = 12;

function parseArgs(argv) {
  let inputPath = path.resolve(__dirname, '../../Assets/map/GTA6-Leonida-Official-Map-HD.jpg');
  let outputDir = path.resolve(__dirname, '../public/tiles');
  let maxZoom = 4;

  for (const arg of argv) {
    if (arg.startsWith('--input=')) {
      inputPath = path.resolve(arg.slice('--input='.length));
    } else if (arg.startsWith('--output=')) {
      outputDir = path.resolve(arg.slice('--output='.length));
    } else if (arg.startsWith('--max-zoom=')) {
      const parsed = Number.parseInt(arg.slice('--max-zoom='.length), 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 6) {
        maxZoom = parsed;
      }
    }
  }

  return { inputPath, outputDir, maxZoom };
}

function toHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
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

async function main() {
  const startTime = Date.now();
  const { inputPath, outputDir, maxZoom } = parseArgs(process.argv.slice(2));

  console.log(`Reading source map: ${inputPath}`);
  const metadata = await sharp(inputPath, { limitInputPixels: false }).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (!sourceWidth || !sourceHeight) {
    throw new Error(`Invalid image dimensions for ${inputPath}`);
  }

  const pixelBuffer = await sharp(inputPath, { limitInputPixels: false })
    .extract({ left: 24, top: 24, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();

  const ocean = {
    r: pixelBuffer[0],
    g: pixelBuffer[1],
    b: pixelBuffer[2],
  };
  const oceanColor = toHex(ocean.r, ocean.g, ocean.b);

  console.log(`Source dimensions: ${sourceWidth}x${sourceHeight}, Ocean: ${oceanColor}`);

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  let totalTiles = 0;
  let totalBytes = 0;

  for (let z = 0; z <= maxZoom; z++) {
    const gridSize = 2 ** z;
    const canvasSize = gridSize * TILE_SIZE;
    console.log(`Generating zoom ${z} (${gridSize}x${gridSize} grid, ${canvasSize}x${canvasSize}px)...`);

    const { data: rawBuffer, info } = await sharp(inputPath, { limitInputPixels: false })
      .resize(canvasSize, canvasSize, {
        fit: 'contain',
        background: { r: ocean.r, g: ocean.g, b: ocean.b, alpha: 1 },
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tasks = [];
    for (let x = 0; x < gridSize; x++) {
      const xDir = path.join(outputDir, String(z), String(x));
      await fs.mkdir(xDir, { recursive: true });

      for (let y = 0; y < gridSize; y++) {
        const outPath = path.join(xDir, `${y}.webp`);
        tasks.push(async () => {
          const tileBuf = await sharp(rawBuffer, {
            limitInputPixels: false,
            raw: {
              width: info.width,
              height: info.height,
              channels: info.channels,
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

          await fs.writeFile(outPath, tileBuf);
          totalTiles++;
          totalBytes += tileBuf.length;
        });
      }
    }

    await runWithConcurrency(tasks, CONCURRENCY);
  }

  const meta = {
    oceanColor,
    sourceWidth,
    sourceHeight,
    tileSize: TILE_SIZE,
    minZoom: 0,
    maxZoom,
    aspectRatio: Number((sourceWidth / sourceHeight).toFixed(6)),
  };

  await fs.writeFile(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `Done! ${sourceWidth}x${sourceHeight}, ocean=${oceanColor}, tiles=${totalTiles}, size=${totalMb} MB, elapsed=${elapsedSec}s`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
