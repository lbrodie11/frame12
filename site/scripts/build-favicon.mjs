#!/usr/bin/env node
// Builds site/public/favicon.ico from the site's canonical icon, site/app/icon.svg.
//
// Pages already declare /icon.svg (and /apple-icon) in <head>; browsers still request
// /favicon.ico on their own for documents without a <head> (e.g. /llms.txt, /r/*.json), which
// used to 404. The .ico is the same artwork, rasterized by Chromium at 16, 32 and 48 px and
// stored as PNG entries (valid in every browser that supports ICO since Windows Vista).
//
//   node scripts/build-favicon.mjs           # regenerate public/favicon.ico
//   node scripts/build-favicon.mjs --check   # verify the file exists and matches icon.svg
//
// Regenerate whenever app/icon.svg changes; site-verify.mjs compares the served favicon.ico
// against icon.svg pixel by pixel, so a stale or wrong icon fails the site tests.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_PATH = resolve(SITE_ROOT, 'app/icon.svg');
const ICO_PATH = resolve(SITE_ROOT, 'public/favicon.ico');
const SIZES = [16, 32, 48];

const svg = readFileSync(SVG_PATH, 'utf8');
const svgHash = createHash('sha256').update(svg).digest('hex');

/** Packs PNG buffers into an ICO container (ICONDIR + ICONDIRENTRY[] + PNG data). */
export function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette colors
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/** Parses an ICO container into [{ size, png }]; throws on anything malformed. */
export function readIco(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    throw new Error('not an ICO file');
  }
  const count = buf.readUInt16LE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    const size = buf.readUInt8(at) || 256;
    const len = buf.readUInt32LE(at + 8);
    const off = buf.readUInt32LE(at + 12);
    const png = buf.subarray(off, off + len);
    if (png.length !== len || png.readUInt32BE(0) !== 0x89504e47) {
      throw new Error(`ICO entry ${i} is not a PNG`);
    }
    out.push({ size, png });
  }
  return out;
}

async function rasterize() {
  const require = createRequire(resolve(SITE_ROOT, 'package.json'));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    const images = [];
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}img{display:block}</style>` +
          `<img src="${dataUrl}" width="${size}" height="${size}">`,
      );
      await page.waitForFunction(() => document.querySelector('img').complete);
      const png = await page.screenshot({ omitBackground: true, type: 'png' });
      images.push({ size, png });
      await page.close();
    }
    return images;
  } finally {
    await browser.close();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--check')) {
    if (!existsSync(ICO_PATH)) {
      console.error('FAIL  public/favicon.ico is missing; run node scripts/build-favicon.mjs');
      process.exit(1);
    }
    const sizes = readIco(readFileSync(ICO_PATH)).map((e) => e.size);
    const ok = JSON.stringify(sizes) === JSON.stringify(SIZES);
    console.log(`${ok ? 'PASS' : 'FAIL'}  public/favicon.ico has ${sizes.join('/')} px PNG entries`);
    process.exit(ok ? 0 : 1);
  }
  const ico = packIco(await rasterize());
  writeFileSync(ICO_PATH, ico);
  console.log(
    `Wrote public/favicon.ico (${ico.length} bytes, ${SIZES.join('/')} px) from app/icon.svg sha256:${svgHash.slice(0, 12)}`,
  );
}
