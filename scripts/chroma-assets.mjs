import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const OUT = "/workspace/public/assets";

function clamp(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function readPng(path) {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

function writePng(path, frame) {
  const png = new PNG({ width: frame.width, height: frame.height });
  png.data = Buffer.from(frame.data);
  writeFileSync(path, PNG.sync.write(png));
}

function isLeftoverMagenta(r, g, b) {
  return g < 64 && r > 100 && b > 32 && b < 130 && r - b > 25 && r - g > 55 && g < r * 0.55;
}

function scrub(frame) {
  const { width, height, data } = frame;
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] < 16) continue;
    if (isLeftoverMagenta(out[i], out[i + 1], out[i + 2])) out[i + 3] = 0;
  }
  const col = new Uint32Array(width);
  const row = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (out[(y * width + x) * 4 + 3] > 40) {
        col[x]++;
        row[y]++;
      }
    }
  }
  const minCol = Math.max(6, Math.round(height * 0.01));
  let minX = 0;
  let maxX = width - 1;
  let minY = 0;
  let maxY = height - 1;
  while (minX < width && col[minX] < minCol) minX++;
  while (maxX > minX && col[maxX] < minCol) maxX--;
  while (minY < height && row[minY] < 4) minY++;
  while (maxY > minY && row[maxY] < 4) maxY--;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cropped = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y + minY) * width + (x + minX)) * 4;
      const di = (y * w + x) * 4;
      cropped[di] = out[si];
      cropped[di + 1] = out[si + 1];
      cropped[di + 2] = out[si + 2];
      cropped[di + 3] = out[si + 3];
    }
  }
  return { width: w, height: h, data: cropped };
}

function isSweater(r, g, b, y, h) {
  if (y < h * 0.22 || y > h * 0.74) return false;
  const light = (r + g + b) / 3;
  if (light < 160 || g < 145 || b < 110) return false;
  if (r - g > 52) return false;
  return true;
}

function recolor(frame, target) {
  const { width, height, data } = frame;
  const next = new Uint8ClampedArray(data);
  const tLum = (0.299 * target[0] + 0.587 * target[1] + 0.114 * target[2]) / 255;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (next[i + 3] < 40) continue;
      if (!isSweater(next[i], next[i + 1], next[i + 2], y, height)) continue;
      const lum = (0.299 * next[i] + 0.587 * next[i + 1] + 0.114 * next[i + 2]) / 255;
      const scale = lum / tLum;
      next[i] = clamp(target[0] * scale);
      next[i + 1] = clamp(target[1] * scale);
      next[i + 2] = clamp(target[2] * scale);
      n++;
    }
  }
  console.log("recolored pixels", n);
  return { width, height, data: next };
}

const names = ["avatar-oatmeal.png", "avatar-navy.png", "lamp-brass.png", "lamp-paper.png", "lamp-banker.png"];
const frames = {};
for (const name of names) {
  frames[name] = scrub(readPng(`${OUT}/${name}`));
  console.log(name, frames[name].width, frames[name].height);
}
const forest = recolor(frames["avatar-oatmeal.png"], [54, 102, 70]);
const rust = recolor(frames["avatar-oatmeal.png"], [176, 96, 58]);
writePng(`${OUT}/avatar-oatmeal.png`, frames["avatar-oatmeal.png"]);
writePng(`${OUT}/avatar-navy.png`, frames["avatar-navy.png"]);
writePng(`${OUT}/lamp-brass.png`, frames["lamp-brass.png"]);
writePng(`${OUT}/lamp-paper.png`, frames["lamp-paper.png"]);
writePng(`${OUT}/lamp-banker.png`, frames["lamp-banker.png"]);
writePng(`${OUT}/avatar-forest.png`, forest);
writePng(`${OUT}/avatar-rust.png`, rust);
