// Minimal PNG codec on node:zlib (no dependency) for pixel checks on Playwright screenshots:
// 8-bit greyscale / RGB / RGBA, non-interlaced, every row filter. `read` returns RGBA data.
import { deflateSync, inflateSync } from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const PNG = {
  read(buf) {
    if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
    let off = 8;
    let width = 0;
    let height = 0;
    let depth = 0;
    let type = 0;
    let interlace = 0;
    const idat = [];
    while (off < buf.length) {
      const len = buf.readUInt32BE(off);
      const kind = buf.toString('latin1', off + 4, off + 8);
      const data = buf.subarray(off + 8, off + 8 + len);
      if (kind === 'IHDR') {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        depth = data[8];
        type = data[9];
        interlace = data[12];
      } else if (kind === 'IDAT') idat.push(data);
      else if (kind === 'IEND') break;
      off += 12 + len;
    }
    const ch = CHANNELS[type];
    if (depth !== 8 || !ch || interlace) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${interlace})`);
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * ch;
    const out = Buffer.alloc(width * height * 4);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
      const f = raw[y * (stride + 1)];
      const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
      for (let i = 0; i < stride; i++) {
        const a = i >= ch ? line[i - ch] : 0;
        const b = prev[i];
        const c = i >= ch ? prev[i - ch] : 0;
        if (f === 1) line[i] = (line[i] + a) & 0xff;
        else if (f === 2) line[i] = (line[i] + b) & 0xff;
        else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
        else if (f === 4) line[i] = (line[i] + paeth(a, b, c)) & 0xff;
      }
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        const s = x * ch;
        if (ch >= 3) {
          out[o] = line[s];
          out[o + 1] = line[s + 1];
          out[o + 2] = line[s + 2];
          out[o + 3] = ch === 4 ? line[s + 3] : 255;
        } else {
          out[o] = out[o + 1] = out[o + 2] = line[s];
          out[o + 3] = ch === 2 ? line[s + 1] : 255;
        }
      }
      prev = line;
    }
    return { width, height, data: out };
  },
  write({ width, height, data }) {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    const chunk = (kind, body) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const kb = Buffer.concat([Buffer.from(kind, 'latin1'), body]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(kb));
      return Buffer.concat([len, kb, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  },
};
