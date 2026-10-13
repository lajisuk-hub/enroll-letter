// 사진 사이를 "얼굴이 서서히 변하며 자라는" 느낌으로 잇는 그림 엔진 (캔버스).
// 1) 사진마다 눈 위치로 얼굴을 같은 자리·같은 크기로 맞추고(framing)
// 2) 얼굴 점들을 삼각형으로 나눠, 앞 사진의 얼굴 모양이 다음 사진의 모양으로 옮겨 가게 비틀며(warp)
// 3) 동시에 서서히 겹친다(dissolve).
import { OVAL, EYE } from './face';

// ---------- 행렬 (a,b,c,d,e,f : x' = a x + c y + e, y' = b x + d y + f) ----------
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const invert = (m) => {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};
const mul = (A, B) => [ // A·B (B 먼저)
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
];

// 사진 한 장을 캔버스(W×H)에 놓는 행렬: 얼굴이 있으면 눈을 기준으로, 없으면 가운데 꽉 채우기
export function frameOf(img, face, W, H) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const cover = Math.max(W / w, H / h);
  if (!face) {
    const s = cover;
    return [s, 0, 0, s, (W - w * s) / 2, (H - h * s) / 2];
  }
  const px = (i) => [face[i][0] * w, face[i][1] * h];
  const L = px(EYE.l1).map((v, k) => (v + px(EYE.l2)[k]) / 2);
  const R = px(EYE.r1).map((v, k) => (v + px(EYE.r2)[k]) / 2);
  const mid = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2];
  const dist = Math.hypot(R[0] - L[0], R[1] - L[1]) || 1;
  let ang = -Math.atan2(R[1] - L[1], R[0] - L[0]);
  if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
  ang = Math.max(-0.2, Math.min(0.2, ang)); // 기울기는 조금만 바로잡는다
  // 눈 사이 거리를 화면 폭의 19%로 — 단, 사진이 화면을 다 덮을 만큼은 키운다
  const s = Math.max((0.19 * W) / dist, cover * (1 + Math.abs(ang) * 1.2));
  const cs = Math.cos(ang) * s, sn = Math.sin(ang) * s;
  const m = [cs, sn, -sn, cs, 0, 0];
  const target = [W / 2, H * 0.4];
  const mm = apply(m, mid);
  m[4] = target[0] - mm[0];
  m[5] = target[1] - mm[1];
  // 사진 가장자리가 화면 안으로 들어오지 않게 밀어 준다
  const cs4 = [[0, 0], [w, 0], [0, h], [w, h]].map((p) => apply(m, p));
  const minX = Math.min(...cs4.map((p) => p[0])), maxX = Math.max(...cs4.map((p) => p[0]));
  const minY = Math.min(...cs4.map((p) => p[1])), maxY = Math.max(...cs4.map((p) => p[1]));
  if (minX > 0) m[4] -= minX; if (maxX < W) m[4] += W - maxX;
  if (minY > 0) m[5] -= minY; if (maxY < H) m[5] += H - maxY;
  return m;
}

// 화면 테두리에 고정된 점들 (얼굴 밖은 제자리에 붙어 있게)
function borderPts(W, H) {
  const out = [];
  for (let i = 0; i <= 4; i += 1) { out.push([(W * i) / 4, 0]); out.push([(W * i) / 4, H]); }
  for (let i = 1; i < 4; i += 1) { out.push([0, (H * i) / 4]); out.push([W, (H * i) / 4]); }
  return out;
}

// 얼굴 점(캔버스 좌표) + 머리카락까지 같이 움직이도록 얼굴선 바깥 점을 덧붙인다
function shapePts(face, img, m, W, H) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const pts = face.map((p) => apply(m, [p[0] * w, p[1] * h]));
  const oval = OVAL.map((_, i) => pts[i]);
  const c = [oval.reduce((a, p) => a + p[0], 0) / oval.length, oval.reduce((a, p) => a + p[1], 0) / oval.length];
  const pad = 6;
  for (let i = 0; i < oval.length; i += 3) {
    const p = oval[i];
    const k = p[1] < c[1] ? 1.5 : 1.3; // 위쪽(머리카락)은 더 넓게
    pts.push([Math.max(pad, Math.min(W - pad, c[0] + (p[0] - c[0]) * k)), Math.max(pad, Math.min(H - pad, c[1] + (p[1] - c[1]) * k))]);
  }
  return pts;
}

// ---------- 들로네 삼각분할 (점 100개 안팎이라 간단한 방식으로 충분) ----------
function delaunay(pts) {
  const n = pts.length;
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const dm = Math.max(maxX - minX, maxY - minY) * 20;
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const P = [...pts, [mx - dm, my - dm], [mx, my + dm], [mx + dm, my - dm]];
  const circ = (a, b, c) => {
    const [ax, ay] = P[a], [bx, by] = P[b], [cx, cy] = P[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return { x: 0, y: 0, r: Infinity };
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { x: ux, y: uy, r: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let tris = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
  for (let i = 0; i < n; i += 1) {
    const [px, py] = P[i];
    const bad = [], keep = [];
    tris.forEach((t) => ((px - t.c.x) ** 2 + (py - t.c.y) ** 2 < t.c.r ? bad : keep).push(t));
    const edges = new Map();
    bad.forEach((t) => {
      [[t.v[0], t.v[1]], [t.v[1], t.v[2]], [t.v[2], t.v[0]]].forEach(([a, b]) => {
        const k = a < b ? `${a},${b}` : `${b},${a}`;
        edges.set(k, edges.has(k) ? null : [a, b]);
      });
    });
    edges.forEach((e) => { if (e) keep.push({ v: [e[0], e[1], i], c: circ(e[0], e[1], i) }); });
    tris = keep;
  }
  return tris.filter((t) => t.v.every((k) => k < n)).map((t) => t.v);
}

// 삼각형 하나를 비틀어 그리기 (원본 삼각형 s → 화면 삼각형 d)
function drawTri(ctx, img, s, d) {
  const [[x0, y0], [x1, y1], [x2, y2]] = s;
  const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(den) < 1e-6) return;
  const [[u0, v0], [u1, v1], [u2, v2]] = d;
  const a = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den;
  const c = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den;
  const e = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den;
  const b = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den;
  const dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den;
  const f = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den;
  // 이음매가 보이지 않게 화면 삼각형을 아주 조금 키워서 자른다
  const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3;
  const grow = (u, v) => { const L = Math.hypot(u - cx, v - cy) || 1; return [u + ((u - cx) / L) * 0.8, v + ((v - cy) / L) * 0.8]; };
  ctx.save();
  ctx.beginPath();
  const g = [grow(u0, v0), grow(u1, v1), grow(u2, v2)];
  ctx.moveTo(g[0][0], g[0][1]); ctx.lineTo(g[1][0], g[1][1]); ctx.lineTo(g[2][0], g[2][1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, dd, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// 미리 계산: 사진들(img+face)을 W×H 캔버스용으로 준비
export function prepare(items, W, H) {
  const frames = items.map((it) => frameOf(it.img, it.face, W, H));
  const border = borderPts(W, H);
  const shapes = items.map((it, i) => (it.face ? shapePts(it.face, it.img, frames[i], W, H) : null));
  // 이웃한 두 장 모두 얼굴이 있을 때만 모핑, 아니면 겹치기
  const pairs = items.slice(0, -1).map((_, i) => {
    const A = shapes[i], B = shapes[i + 1];
    if (!A || !B) return null;
    const mid = A.map((p, k) => [(p[0] + B[k][0]) / 2, (p[1] + B[k][1]) / 2]);
    return { tris: delaunay([...mid, ...border]), A: [...A, ...border], B: [...B, ...border] };
  });
  return { W, H, frames, pairs, items };
}

// 한 장을 카메라(cam: 화면→화면 행렬)와 함께 통째로 그리기
function drawWhole(ctx, img, frame, cam) {
  const m = mul(cam, frame);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.transform(...m);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// 사진 i → 비틀어진 모양 dst 로 그리기
function drawWarped(ctx, img, frame, cam, srcCanvasPts, dst, tris) {
  drawWhole(ctx, img, frame, cam); // 바탕(이음매 메우기)
  const inv = invert(frame);
  const src = srcCanvasPts.map((p) => apply(inv, p)); // 캔버스 좌표 → 사진 좌표
  const d = dst.map((p) => apply(cam, p));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  tris.forEach(([i, j, k]) => drawTri(ctx, img, [src[i], src[j], src[k]], [d[i], d[j], d[k]]));
  ctx.restore();
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// 장면 그리기: i번째 사진에서 i+1번째로 t(0~1)만큼 넘어간 모습. t=0이면 i번째 그대로.
export function render(ctx, prep, i, t, zoom, off) {
  const { W, H, frames, pairs, items } = prep;
  // 카메라: 얼굴 쪽으로 아주 천천히 다가간다
  const z = zoom || 1;
  const cam = [z, 0, 0, z, W / 2 - (W / 2) * z, H * 0.4 - H * 0.4 * z];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1d1714';
  ctx.fillRect(0, 0, W, H);
  const A = items[i];
  if (t <= 0 || i >= items.length - 1) { drawWhole(ctx, A.img, frames[i], cam); return; }
  const B = items[i + 1];
  const k = ease(t);
  const pair = pairs[i];
  if (!pair) {
    drawWhole(ctx, A.img, frames[i], cam);
    ctx.globalAlpha = k;
    drawWhole(ctx, B.img, frames[i + 1], cam);
    ctx.globalAlpha = 1;
    return;
  }
  const dst = pair.A.map((p, n) => [p[0] + (pair.B[n][0] - p[0]) * k, p[1] + (pair.B[n][1] - p[1]) * k]);
  drawWarped(ctx, A.img, frames[i], cam, pair.A, dst, pair.tris);
  // 뒷사진은 따로 그린 뒤 투명도를 올려 겹친다
  const octx = off.getContext('2d');
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, W, H);
  drawWarped(octx, B.img, frames[i + 1], cam, pair.B, dst, pair.tris);
  ctx.globalAlpha = k;
  ctx.drawImage(off, 0, 0);
  ctx.globalAlpha = 1;
}
