'use client';
// 사진 4장을 얼굴 자리에 맞춰 놓고, 얼굴 모양이 서서히 다음 사진으로 변하며(모핑) 아이가 자라는 모습을 보여 주는 영상.
// 얼굴 정보(face)가 없는 사진은 부드럽게 겹치기만 한다.
import { useEffect, useRef, useState } from 'react';
import { prepare, render } from '../lib/morph';

const HOLD = 2.0;   // 한 장이 머무는 시간(초)
const MORPH = 2.8;  // 다음 사진으로 변해 가는 시간(초)
const W = 720, H = 900;

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

export default function GrowthFilm({ photos, child, onEnd, year = '2026' }) {
  const list = (photos || []).filter((p) => p && p.src);
  const key = list.map((p) => p.src.length + ':' + (p.face ? 1 : 0)).join('|');
  const canvasRef = useRef(null);
  const [cap, setCap] = useState(0);
  const [ended, setEnded] = useState(false);
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!list.length) return undefined;
    let stop = false, raf = 0;
    setEnded(false); setCap(0); setReady(false);
    (async () => {
      const imgs = await Promise.all(list.map((p) => loadImg(p.src)));
      if (stop) return;
      const items = imgs.map((img, i) => ({ img, face: list[i].face || null })).filter((it) => it.img);
      if (!items.length) return;
      const prep = prepare(items, W, H);
      const cv = canvasRef.current;
      if (!cv) return;
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const n = items.length;
      const total = n * HOLD + (n - 1) * MORPH;
      let start = 0, lastCap = -1, done = false;
      setReady(true);
      const frame = (now) => {
        if (stop) return;
        if (!start) start = now;
        const s = Math.min((now - start) / 1000, total);
        const seg = HOLD + MORPH;
        let i = Math.min(n - 1, Math.floor(s / seg));
        let t = Math.max(0, (s - i * seg - HOLD) / MORPH);
        if (i >= n - 1) { i = n - 1; t = 0; }
        render(ctx, prep, i, Math.min(1, t), 1 + 0.1 * (s / total), off);
        const c = t >= 0.5 ? i + 1 : i;
        if (c !== lastCap) { lastCap = c; setCap(c); }
        if (s >= total) {
          if (!done) { done = true; setTimeout(() => { if (!stop) { setEnded(true); endRef.current && endRef.current(); } }, 400); }
          return; // 마지막 장면에서 멈춘다
        }
        raf = requestAnimationFrame(frame);
      };
      // 첫 장은 곧바로 그려 둔다 (화면 갱신 신호가 늦게 와도 검은 화면이 안 보이게)
      frame(performance.now());
    })();
    return () => { stop = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, key]);

  if (!list.length) {
    return <div className="film"><div className="empty">사진을 넣으면 여기에서 성장 영상이 재생돼요</div></div>;
  }

  return (
    <div className="film">
      <canvas ref={canvasRef} className="film-canvas" style={{ opacity: ready ? 1 : 0 }} />
      <div className="shade" />
      {list.map((p, i) => (p.caption ? <div key={i} className={`cap${i === cap ? ' on' : ''}`}>{p.caption}</div> : null))}
      <div className="year">{year} · {child}의 한 해</div>
      <div className={`end${ended ? ' on' : ''}`}>
        <div>
          {child}, 이만큼 자랐어요
          <small>함께여서 고마웠던 1년</small>
        </div>
      </div>
      <div className="dots">
        {list.map((_, i) => <i key={i} className={i <= cap ? 'on' : ''} />)}
      </div>
      {ended ? <button className="replay" onClick={() => setRun((r) => r + 1)}>↻ 다시 보기</button> : null}
    </div>
  );
}
