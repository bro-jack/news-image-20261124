// News-image entry for make.fun news-image-20261124 (Node 22, stdlib only).
// The entry is the illustrated front page in entry.png beside this file.
// Before copying, the program validates the image itself: it must exist,
// be at most 1 MiB, and be exactly 1024x1024 (dimensions read from the
// PNG/JPEG header, no decoding, no network, no new dependencies).
// If any check fails it exits with a clear error instead of shipping a
// broken entry. Run locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1024 * 1024;
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

function fail(message: string): never {
  console.error(`entry.png validation failed: ${message}`);
  process.exit(1);
}

function pngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG signature (8 bytes) + IHDR chunk: length(4) "IHDR"(4) width(4) height(4).
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(12) !== 0x49484452) return null; // "IHDR"
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  // JPEG: SOI marker FF D8, then segments of FF marker + length(2, self-inclusive).
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.length) return null;
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buf.length) return null;
    // SOF0/SOF1/SOF2 data: precision(1) height(2) width(2) after the length field.
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (length < 7) return null;
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

const src = new URL("./entry.png", import.meta.url);

let buf: Buffer;
try {
  buf = readFileSync(src);
} catch (err) {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  fail(code === "ENOENT" ? "file not found beside main.ts" : `could not read file (${code ?? "unknown error"})`);
}
if (buf.length > MAX_BYTES) {
  fail(`size ${buf.length} bytes exceeds the 1 MiB limit`);
}

let dims: { width: number; height: number } | null = null;
if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
  dims = pngDimensions(buf);
} else if (buf[0] === 0xff && buf[1] === 0xd8) {
  dims = jpegDimensions(buf);
} else {
  fail("not a PNG or JPEG file");
}
if (dims === null) fail("could not read image dimensions from the file header");
if (dims.width !== EXPECTED_WIDTH || dims.height !== EXPECTED_HEIGHT) {
  fail(`dimensions ${dims.width}x${dims.height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, "entry.png"));
