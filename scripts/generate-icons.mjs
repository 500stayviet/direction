import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createCanvas(size) {
  const data = new Uint8ClampedArray(size * size * 4);
  return { size, data };
}

function setPx(canvas, x, y, r, g, b, a = 255) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= canvas.size || yi >= canvas.size) return;
  const i = (yi * canvas.size + xi) * 4;
  canvas.data[i] = r;
  canvas.data[i + 1] = g;
  canvas.data[i + 2] = b;
  canvas.data[i + 3] = a;
}

function fillRect(canvas, x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      setPx(canvas, x, y, r, g, b, a);
    }
  }
}

function fillCircle(canvas, cx, cy, radius, r, g, b, a = 255) {
  const rad = Math.ceil(radius);
  for (let y = -rad; y <= rad; y += 1) {
    for (let x = -rad; x <= rad; x += 1) {
      if (x * x + y * y <= radius * radius) {
        setPx(canvas, cx + x, cy + y, r, g, b, a);
      }
    }
  }
}

/** 모서리 둥근 사각형 */
function fillRoundRect(canvas, x, y, w, h, radius, r, g, b, a = 255) {
  const rr = Math.min(radius, w / 2, h / 2);
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      const dx = px < x + rr ? x + rr - px : px > x + w - rr - 1 ? px - (x + w - rr - 1) : 0;
      const dy = py < y + rr ? y + rr - py : py > y + h - rr - 1 ? py - (y + h - rr - 1) : 0;
      if (dx * dx + dy * dy <= rr * rr || (dx === 0 || dy === 0)) {
        // corner check only when in corner zone
      }
      const inCorner =
        (px < x + rr && py < y + rr) ||
        (px > x + w - rr - 1 && py < y + rr) ||
        (px < x + rr && py > y + h - rr - 1) ||
        (px > x + w - rr - 1 && py > y + h - rr - 1);
      if (inCorner) {
        const cx = px < x + rr ? x + rr : x + w - rr - 1;
        const cy = py < y + rr ? y + rr : y + h - rr - 1;
        if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= rr * rr) {
          setPx(canvas, px, py, r, g, b, a);
        }
      } else {
        setPx(canvas, px, py, r, g, b, a);
      }
    }
  }
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function fillTriangle(canvas, x1, y1, x2, y2, x3, y3, r, g, b, a = 255) {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInTriangle(x + 0.5, y + 0.5, x1, y1, x2, y2, x3, y3)) {
        setPx(canvas, x, y, r, g, b, a);
      }
    }
  }
}

/** 사다리꼴(도로) */
function fillTrapezoid(canvas, topL, topR, topY, botL, botR, botY, r, g, b, a = 255) {
  const minY = Math.floor(Math.min(topY, botY));
  const maxY = Math.ceil(Math.max(topY, botY));
  for (let y = minY; y <= maxY; y += 1) {
    const t = (y - topY) / (botY - topY || 1);
    const left = topL + (botL - topL) * t;
    const right = topR + (botR - topR) * t;
    for (let x = Math.floor(left); x <= Math.ceil(right); x += 1) {
      setPx(canvas, x, y, r, g, b, a);
    }
  }
}

function drawIcon(size) {
  const canvas = createCanvas(size);
  const s = size;

  // 배경 (밝은 그레이)
  fillRect(canvas, 0, 0, s, s, 0xf9, 0xfa, 0xfb, 255);

  // 앱 아이콘 스타일 라운드 사각 (토스 블루)
  const pad = Math.round(s * 0.06);
  const box = s - pad * 2;
  const radius = Math.round(s * 0.22);
  fillRoundRect(canvas, pad, pad, box, box, radius, 0x31, 0x82, 0xf6, 255);

  const cx = s / 2;
  const white = [255, 255, 255];

  // —— 집 (상단) ——
  const houseTop = s * 0.22;
  const houseBodyTop = s * 0.36;
  const houseBottom = s * 0.58;
  const houseHalf = s * 0.16;
  const roofHalf = s * 0.2;

  // 지붕
  fillTriangle(
    canvas,
    cx,
    houseTop,
    cx - roofHalf,
    houseBodyTop + s * 0.02,
    cx + roofHalf,
    houseBodyTop + s * 0.02,
    ...white
  );
  // 집 몸체
  fillRect(
    canvas,
    Math.round(cx - houseHalf),
    Math.round(houseBodyTop),
    Math.round(houseHalf * 2),
    Math.round(houseBottom - houseBodyTop),
    ...white
  );
  // 문 (블루로 구멍)
  const doorW = s * 0.07;
  const doorH = s * 0.12;
  fillRect(
    canvas,
    Math.round(cx - doorW / 2),
    Math.round(houseBottom - doorH),
    Math.round(doorW),
    Math.round(doorH),
    0x31,
    0x82,
    0xf6,
    255
  );
  // 굴뚝 느낌 작은 창
  fillRect(
    canvas,
    Math.round(cx + houseHalf * 0.25),
    Math.round(houseBodyTop + s * 0.05),
    Math.round(s * 0.055),
    Math.round(s * 0.055),
    0x31,
    0x82,
    0xf6,
    255
  );

  // —— 도로 (하단, 네비 원근감) ——
  const roadTopY = s * 0.6;
  const roadBotY = s * 0.9;
  const roadTopW = s * 0.12;
  const roadBotW = s * 0.38;

  fillTrapezoid(
    canvas,
    cx - roadTopW / 2,
    cx + roadTopW / 2,
    roadTopY,
    cx - roadBotW / 2,
    cx + roadBotW / 2,
    roadBotY,
    ...white
  );

  // 중앙 점선 (파란 차선)
  const dashCount = 4;
  for (let i = 0; i < dashCount; i += 1) {
    const t0 = (i + 0.15) / dashCount;
    const t1 = (i + 0.55) / dashCount;
    const y0 = roadTopY + (roadBotY - roadTopY) * t0;
    const y1 = roadTopY + (roadBotY - roadTopY) * t1;
    const w0 = roadTopW + (roadBotW - roadTopW) * t0;
    const dashW = Math.max(2, w0 * 0.08);
    fillTrapezoid(
      canvas,
      cx - dashW / 2,
      cx + dashW / 2,
      y0,
      cx - dashW / 2,
      cx + dashW / 2,
      y1,
      0x31,
      0x82,
      0xf6,
      255
    );
  }

  // 작은 위치 핀 (집 위)
  fillCircle(canvas, cx, s * 0.18, s * 0.035, ...white);

  return canvas;
}

function canvasToPng(canvas) {
  const size = canvas.size;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    row[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const src = (y * size + x) * 4;
      const i = rowStart + 1 + x * 4;
      row[i] = canvas.data[src];
      row[i + 1] = canvas.data[src + 1];
      row[i + 2] = canvas.data[src + 2];
      row[i + 3] = canvas.data[src + 3];
    }
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(row)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="현장동선">
  <rect width="512" height="512" rx="112" fill="#3182F6"/>
  <!-- house -->
  <path d="M256 96L150 210h212L256 96z" fill="#fff"/>
  <rect x="176" y="200" width="160" height="120" rx="8" fill="#fff"/>
  <rect x="228" y="248" width="56" height="72" rx="6" fill="#3182F6"/>
  <rect x="286" y="230" width="28" height="28" rx="4" fill="#3182F6"/>
  <!-- road -->
  <path d="M214 318 L298 318 L360 452 L152 452 Z" fill="#fff"/>
  <path d="M250 340 L262 340 L262 358 L250 358 Z" fill="#3182F6"/>
  <path d="M248 372 L264 372 L264 392 L248 392 Z" fill="#3182F6"/>
  <path d="M246 406 L266 406 L266 428 L246 428 Z" fill="#3182F6"/>
</svg>
`;

writeFileSync(new URL("../public/icon.svg", import.meta.url), svg);

for (const size of [192, 512]) {
  writeFileSync(
    new URL(`../public/icon-${size}.png`, import.meta.url),
    canvasToPng(drawIcon(size))
  );
}

// favicon용 32px
writeFileSync(
  new URL("../public/favicon.png", import.meta.url),
  canvasToPng(drawIcon(32))
);

console.log("icons generated: icon.svg, favicon.png, icon-192.png, icon-512.png");
