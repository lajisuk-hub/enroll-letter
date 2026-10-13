'use client';
// 학부모님이 받는 화면: 편지 도착 → 열기 → 성장 영상 + 원장님 편지 → 2027 안내 → 재원신청서 서명 → 원장님께 전달
import { useEffect, useRef, useState } from 'react';
import GrowthFilm from '../../components/GrowthFilm';
import SignaturePad from '../../components/SignaturePad';
import { makeApplyPdf } from '../../lib/pdf';

const RELATIONS = ['어머니', '아버지', '할머니', '할아버지', '기타'];

export default function Letter({ code }) {
  const [rec, setRec] = useState(null);
  const [scene, setScene] = useState('loading');
  const [err, setErr] = useState('');
  const [opening, setOpening] = useState(false);
  const [shown, setShown] = useState(0);
  const [form, setForm] = useState({ child: '', birth: '', parent: '', relation: '', phone: '', memo: '' });
  const [sign, setSign] = useState('');
  const [result, setResult] = useState({ mailed: false, url: '', note: '' });
  const timers = useRef([]);
  const setF = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    fetch(`/api/load?c=${encodeURIComponent(code)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || '편지를 찾지 못했어요.');
        setRec(j.data);
        setF({ child: j.data.child });
        setScene('arrive');
      })
      .catch((e) => { setErr(e.message); setScene('error'); });
  }, [code]);

  const paras = rec ? rec.letter.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];

  const top = () => window.scrollTo({ top: 0, behavior: 'auto' });

  const openLetter = () => {
    if (opening) return;
    setOpening(true);
    setTimeout(() => { setScene('film'); top(); startReveal(); }, 3000);
  };

  const startReveal = () => {
    timers.current.forEach(clearTimeout);
    setShown(0);
    // 영상이 흐르는 동안 편지가 한 문단씩 천천히 떠오른다
    const n = rec.letter.split(/\n\s*\n/).filter((p) => p.trim()).length;
    timers.current = Array.from({ length: n }, (_, i) => setTimeout(() => setShown(i + 1), 2600 + i * 2400));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showAll = () => { timers.current.forEach(clearTimeout); setShown(paras.length); };

  const submit = async () => {
    setScene('sending');
    top();
    let made;
    try {
      made = await makeApplyPdf({ rec, form, sign });
    } catch (e) {
      setErr('신청서 파일을 만들지 못했어요. 다시 시도해 주세요. (' + e.message + ')');
      setScene('form');
      return;
    }
    const url = URL.createObjectURL(made.blob);
    let mailed = false;
    try {
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, pdfBase64: made.base64, ...form }),
      });
      mailed = r.ok;
    } catch (e) { mailed = false; }
    setResult({ mailed, url, note: mailed ? '' : '전송이 잠시 원활하지 않아요. 아래 단추로 신청서를 저장해 담임 선생님께 전해 주세요.' });
    setScene('done');
  };

  if (scene === 'loading') return <div className="loading">편지를 가져오고 있어요…</div>;
  if (scene === 'error') {
    return <div className="stage done"><h1>편지를 열지 못했어요</h1><p>{err}</p><p>받으신 링크가 맞는지 어린이집에 한 번 확인해 주세요.</p></div>;
  }

  const canSubmit = form.child.trim() && form.parent.trim() && form.relation && sign;

  return (
    <>
      {scene === 'arrive' && (
        <div className={`stage arrive${opening ? ' is-opening' : ''}`}>
          {[...Array(9)].map((_, i) => (
            <span key={i} className="sparkle" style={{ left: `${8 + i * 10.5}%`, top: `${10 + ((i * 37) % 70)}%`, animationDelay: `${(i * 0.7) % 4}s` }}>✦</span>
          ))}
          <div className="notice">2027 NEWS</div>
          <h1>2027년 소식이<br />도착하였습니다</h1>
          <div className="from">{rec.center}에서 {rec.child} 가족에게</div>
          <button className={`env3${opening ? ' opening' : ''}`} onClick={openLetter} aria-label="편지 열기">
            <img className="e-flap" src="/img/env-open-flap.webp" alt="" />
            <img className="e-paper" src="/img/paper-thumb.webp" alt="" />
            <img className="e-body" src="/img/env-open-body.webp" alt="" />
            <img className="e-closed" src="/img/envelope.webp" alt="편지 봉투" />
            <span className="glow" />
          </button>
          {!opening ? <button className="btn tap" onClick={openLetter}>💌 편지 열어 보기</button> : <div className="from">편지를 여는 중…</div>}
        </div>
      )}

      {scene === 'film' && (
        <div className="stage" style={{ background: '#1d1714' }}>
          <div className="view">
            <GrowthFilm photos={rec.photos} child={rec.child} />
            <div className="letter-paper">
              <img className="lp-top" src="/img/paper-top.webp" alt="" />
              <div className="lp-body">
                {paras.map((p, i) => (
                  <p key={i} className={`${i < shown ? 'on' : ''}${i === 0 ? ' first' : ''}${i === paras.length - 1 ? ' sign' : ''}`}>{p}</p>
                ))}
              </div>
              <img className="lp-bottom" src="/img/paper-bottom.webp" alt="" />
            </div>
            <div className="cta" style={{ background: 'var(--paper)' }}>
              {shown >= paras.length ? (
                <button className="btn" onClick={() => { setScene('apply'); top(); }}>2027년 재원신청서 보기 →</button>
              ) : (
                <button className="skip" onClick={showAll}>편지 바로 다 보기</button>
              )}
            </div>
          </div>
        </div>
      )}

      {scene === 'apply' && (
        <div className="stage">
          <div className="apply">
            <div className="apply-head">
              <div className="kicker">2027 {rec.center}</div>
              <h1>2027년,<br />{rec.center}의 포부</h1>
            </div>
            {rec.vision ? <div className="vision">{rec.vision}</div> : null}
            {rec.plans?.length ? (
              <>
                <div className="sec-t">2027년에 이렇게 함께해요</div>
                <div className="plans">{rec.plans.map((p, i) => <div key={i}><b>{String(i + 1).padStart(2, '0')}</b>{p}</div>)}</div>
              </>
            ) : null}
            {rec.merits?.length ? (
              <div className="memo">
                <h3>재원하면 좋은 점 ✎</h3>
                <ul>{rec.merits.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            ) : null}
            <div className="invite">
              2027년에도 <b>{rec.child}</b>와 함께하고 싶습니다.<br />
              재원을 희망하시면 신청서를 작성해 주세요.
              {rec.deadline ? <><br /><span style={{ color: 'var(--soft)', fontSize: 14 }}>신청 마감: {fmtDate(rec.deadline)}</span></> : null}
            </div>
            <button className="btn" style={{ width: '100%' }} onClick={() => { setScene('form'); top(); }}>재원신청서 작성하기</button>
            <div style={{ textAlign: 'center' }}><button className="skip" onClick={() => { setScene('film'); setShown(paras.length); top(); }}>← 편지 다시 보기</button></div>
          </div>
        </div>
      )}

      {scene === 'form' && (
        <div className="stage">
          <div className="apply">
            <div className="apply-head">
              <div className="kicker">{rec.center}</div>
              <h1>2027학년도 재원신청서</h1>
            </div>
            <div className="form-card">
              <div className="field"><label>아이 이름</label><input type="text" value={form.child} onChange={(e) => setF({ child: e.target.value })} /></div>
              <div className="field"><label>아이 생년월일 (선택)</label><input type="date" value={form.birth} onChange={(e) => setF({ birth: e.target.value })} /></div>
              <div className="field"><label>보호자 이름</label><input type="text" value={form.parent} onChange={(e) => setF({ parent: e.target.value })} placeholder="예: 김민지" /></div>
              <div className="field"><label>아이와의 관계</label>
                <div className="chips">{RELATIONS.map((r) => <button key={r} className={`chip${form.relation === r ? ' on' : ''}`} onClick={() => setF({ relation: r })}>{r}</button>)}</div>
              </div>
              <div className="field"><label>연락처 (선택)</label><input type="tel" value={form.phone} onChange={(e) => setF({ phone: e.target.value })} placeholder="010-0000-0000" /></div>
              <div className="field"><label>원장님께 한마디 (선택)</label><textarea value={form.memo} onChange={(e) => setF({ memo: e.target.value })} placeholder="예: 한 해 동안 정말 감사했습니다." /></div>

              {form.child && form.parent ? (
                <>
                  <div className="pledge">
                    <b>{form.child}</b>의<br />2027년 <b>{rec.center}</b> 재원을 희망합니다.
                  </div>
                  <SignaturePad name={form.parent} onChange={setSign} />
                  <div className="hint" style={{ fontSize: 13, color: 'var(--soft)', marginTop: 6 }}>손가락으로 서명해 주세요.</div>
                </>
              ) : <div className="hint" style={{ fontSize: 14, color: 'var(--soft)' }}>아이 이름과 보호자 이름을 적으면 서명란이 나타나요.</div>}
              {err ? <div className="err">{err}</div> : null}
              <div className="nav">
                <button className="btn ghost" onClick={() => { setScene('apply'); top(); }}>이전</button>
                <button className="btn green" disabled={!canSubmit} onClick={submit}>신청서 제출하기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scene === 'sending' && <div className="stage done"><div className="loading">신청서를 정성껏 담고 있어요…</div></div>}

      {scene === 'done' && (
        <div className="stage done">
          <div className="mark">✓</div>
          <h1>재원신청서를<br />{rec.center}에 전달하겠습니다~</h1>
          <p>{form.child}와 함께할 2027년이 벌써 기다려집니다.<br />소중한 마음 고맙습니다.</p>
          {result.note ? <p style={{ color: '#b3402a' }}>{result.note}</p> : null}
          {result.url ? <a className={`btn${result.mailed ? ' line' : ''}`} href={result.url} download={`2027_재원신청서_${form.child}.pdf`}>📥 내 신청서 저장하기</a> : null}
        </div>
      )}
    </>
  );
}

function fmtDate(s) {
  const [y, m, d] = String(s).split('-');
  return y && m && d ? `${y}년 ${Number(m)}월 ${Number(d)}일` : s;
}
