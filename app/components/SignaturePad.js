'use client';
// 손가락(또는 마우스)으로 서명하는 칸. 서명이 바뀔 때마다 onChange(그림 주소 또는 '')를 부른다.
import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({ name, onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [has, setHas] = useState(false);

  const saved = useRef(''); // 지금까지 쓴 서명 그림 — 화면 크기가 바뀌어도 다시 그려 넣는다

  useEffect(() => {
    const c = ref.current;
    let size = '';
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const next = `${Math.round(r.width)}x${Math.round(r.height)}@${dpr}`;
      // 휴대폰은 손을 뗄 때 주소창이 숨거나 나타나며 resize가 자주 일어난다.
      // 칸 크기가 그대로면 아무것도 하지 않는다(예전엔 여기서 서명이 지워졌다).
      if (next === size) return;
      size = next;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f2a44';
      ctx.lineWidth = 3;
      if (saved.current) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
        img.src = saved.current;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    ref.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = ref.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2a44';
    ctx.fill();
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = ref.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setHas(true);
    saved.current = ref.current.toDataURL('image/png');
    onChange && onChange(saved.current);
  };
  const clear = () => {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    saved.current = '';
    setHas(false);
    onChange && onChange('');
  };

  return (
    <div className="signbox">
      <div className="signline">
        <span>보호자 <span className="who">{name || '(이름)'}</span> (서명)</span>
        <button type="button" className="btn small ghost" onClick={clear}>다시 쓰기</button>
      </div>
      <div className="signpad">
        {!has ? <div className="ghost">{name ? `${name} 서명` : '여기에 서명'}</div> : null}
        <div className="base" />
        <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
      </div>
    </div>
  );
}
