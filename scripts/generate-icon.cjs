// Generate a simple 256x256 PNG icon for MindCanvas
// This creates a purple lightning bolt icon similar to the SVG favicon
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');

// Minimal PNG encoder
function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);
  
  // IDAT chunk - raw pixel data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];     // R
      rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Draw a simple purple icon with "MC" text-like shape
const size = 256;
const pixels = Buffer.alloc(size * size * 4);

// Fill with purple background circle
const cx = size / 2;
const cy = size / 2;
const radius = size / 2 - 10;

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= radius) {
      // Purple circle background with slight gradient
      const t = dist / radius;
      const r = Math.round(134 * (1 - t * 0.3));
      const g = Math.round(59 * (1 - t * 0.3));
      const b = Math.round(255 * (1 - t * 0.1));
      pixels[idx] = r;     // R
      pixels[idx + 1] = g; // G
      pixels[idx + 2] = b; // B
      
      // Anti-alias edge
      if (dist > radius - 2) {
        pixels[idx + 3] = Math.round(255 * (radius - dist + 2) / 2);
      } else {
        pixels[idx + 3] = 255;
      }
    } else {
      pixels[idx + 3] = 0; // transparent
    }
  }
}

// Draw a simple lightning bolt shape (white)
function drawLine(x0, y0, x1, y1, thickness, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    
    for (let ox = -thickness; ox <= thickness; ox++) {
      for (let oy = -thickness; oy <= thickness; oy++) {
        if (ox * ox + oy * oy <= thickness * thickness) {
          const fx = Math.round(px + ox);
          const fy = Math.round(py + oy);
          if (fx >= 0 && fx < size && fy >= 0 && fy < size) {
            const idx = (fy * size + fx) * 4;
            if (pixels[idx + 3] > 0) { // only draw on non-transparent pixels
              pixels[idx] = r;
              pixels[idx + 1] = g;
              pixels[idx + 2] = b;
            }
          }
        }
      }
    }
  }
}

// Lightning bolt shape
const boltThickness = 12;
drawLine(140, 40, 90, 120, boltThickness, 255, 255, 255);
drawLine(90, 120, 160, 110, boltThickness, 255, 255, 255);
drawLine(160, 110, 110, 210, boltThickness, 255, 255, 255);

const png = createPNG(size, size, pixels);
const outputPath = path.join(__dirname, '..', 'public', 'icon.png');
fs.writeFileSync(outputPath, png);
console.log(`Icon saved to ${outputPath} (${png.length} bytes)`);
