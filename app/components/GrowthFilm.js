'use client';
// 사진 4장이 천천히 겹쳐지며(오버랩) 아이가 자라는 모습을 보여 주는 짧은 영상.
import { useEffect, useRef, useState } from 'react';

const HOLD = 4600; // 한 장이 머무는 시간(ms) — 앞뒤 사진이 2초 동안 겹친다

export default function GrowthFilm({ photos, child, onEnd, year = '2026' }) {
  const list = (photos || []).filter((p) => p && p.src);
  const [idx, setIdx] = useState(0);
  const [ended, setEnded] = useState(false);
  const [run, setRun] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!list.length) return undefined;
    setIdx(0);
    setEnded(false);
    const timers = [];
    list.forEach((_, i) => {
      if (i > 0) timers.push(setTimeout(() => setIdx(i), HOLD * i));
    });
    timers.push(setTimeout(() => {
      setEnded(true);
      endRef.current && endRef.current();
    }, HOLD * list.length + 400));
    return () => timers.forEach(clearTimeout);
  }, [run, list.length]);

  if (!list.length) {
    return <div className="film"><div className="empty">사진을 넣으면 여기에서 성장 영상이 재생돼요</div></div>;
  }

  return (
    <div className="film">
      {list.map((p, i) => (
        <div key={`${run}-${i}`} className={`frame${i % 2 ? ' alt' : ''}${i === idx ? ' on' : ''}`}>
          <img src={p.src} alt="" />
          {p.caption ? <div className="cap">{p.caption}</div> : null}
        </div>
      ))}
      <div className="shade" />
      <div className="year">{year} · {child}의 한 해</div>
      <div className={`end${ended ? ' on' : ''}`}>
        <div>
          {child}, 이만큼 자랐어요
          <small>함께여서 고마웠던 1년</small>
        </div>
      </div>
      <div className="dots">
        {list.map((_, i) => <i key={i} className={i <= idx ? 'on' : ''} />)}
      </div>
      {ended ? <button className="replay" onClick={() => setRun((r) => r + 1)}>↻ 다시 보기</button> : null}
    </div>
  );
}
