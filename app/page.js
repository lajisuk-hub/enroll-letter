'use client';
// 원장님이 인터뷰에 답하며 아이 한 명의 「감동의 재원신청서」 링크를 만드는 화면.
import { useEffect, useState } from 'react';
import GrowthFilm from './components/GrowthFilm';
import { shrinkImage } from './lib/image';
import { findFace } from './lib/face';
import { pushSupported, iosNeedsInstall, savedSub, enablePush, registerPush } from './lib/pushClient';
import {
  FIRST_TAGS, GROW_TAGS, PLAN_SAMPLES, VISION_SAMPLE, MERIT_SAMPLES,
  PHOTO_LABELS, PHOTO_CAPTIONS, fallbackLetter,
} from './lib/samples';

const ORG_KEY = 'enroll.org.v1';
const DRAFT_KEY = 'enroll.draft.v1';
const MADE_KEY = 'enroll.made.v1';

const ORG_FIELDS = ['center', 'director', 'email', 'deadline', 'plans', 'vision', 'merits'];
const emptyChild = () => ({
  child: '', firstTags: [], firstDay: '', growTags: [], grow: '', charm: '', moment: '', toChild: '', toParent: '',
  photos: PHOTO_CAPTIONS.map((caption) => ({ src: '', caption })), letter: '', code: '', editKey: '',
});
const emptyOrg = () => ({
  center: '', director: '', email: '', deadline: '', plans: PLAN_SAMPLES.slice(0, 4), vision: VISION_SAMPLE, merits: [...MERIT_SAMPLES],
});

const STEPS = ['시작', '기본 정보', '처음 만난 날', '자란 모습', '기억에 남는 장면', '전하고 싶은 말', '2027 계획', '포부와 재원 장점', '사진 4장', '편지', '완성'];

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
// 크롬인지 (엣지·웨일·삼성·카카오톡/네이버 안 브라우저 등은 아님)
const isChrome = () => {
  const ua = navigator.userAgent;
  if (/Edg\/|EdgA|EdgiOS|OPR\/|Whale|SamsungBrowser|KAKAOTALK|NAVER|Line\/|DaumApps|Instagram|FBAN|FBAV|; wv\)/i.test(ua)) return false;
  return /CriOS\//.test(ua) || (/Chrome\//.test(ua) && !!window.chrome);
};
const CHROME_SEEN = 'enroll.chrome.seen.v1';
const okEmail = (e) => /^[^@\s]+@(gmail\.com|naver\.com)$/i.test(String(e || '').trim());

export default function Maker() {
  const [d, setD] = useState({ ...emptyOrg(), ...emptyChild() });
  const [step, setStep] = useState(0);
  const [made, setMade] = useState([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ err: '', ok: '' });
  const [ready, setReady] = useState(false);
  const [chromePop, setChromePop] = useState(''); // '' 안 띄움 / 'ok' 크롬(처음 한 번) / 'no' 크롬 아님(매번)
  const [alarm, setAlarm] = useState({ on: false, busy: false, ok: '', err: '' });
  const set = (patch) => setD((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));

  // 기관 정보·작성 중인 내용 불러오기
  useEffect(() => {
    const org = lsGet(ORG_KEY) || {};
    const draft = lsGet(DRAFT_KEY) || {};
    setD((prev) => ({ ...prev, ...org, ...draft }));
    setMade(lsGet(MADE_KEY) || []);
    setAlarm((a) => ({ ...a, on: !!savedSub() && typeof Notification !== 'undefined' && Notification.permission === 'granted' }));
    setReady(true);
    // 사이트를 열면 「크롬으로 접속하세요」 안내 — 크롬이 아니면 매번, 크롬이면 처음 한 번만
    if (!isChrome()) setChromePop('no');
    else if (!lsGet(CHROME_SEEN)) setChromePop('ok');
  }, []);

  // 자동 임시저장
  useEffect(() => {
    if (!ready) return;
    const org = {};
    ORG_FIELDS.forEach((k) => { org[k] = d[k]; });
    lsSet(ORG_KEY, org);
    const draft = { ...d };
    ORG_FIELDS.forEach((k) => delete draft[k]);
    if (!lsSet(DRAFT_KEY, draft)) lsSet(DRAFT_KEY, { ...draft, photos: draft.photos.map((p) => ({ ...p, src: '' })) });
  }, [d, ready]);

  const go = (n) => { setMsg({ err: '', ok: '' }); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const canNext = () => {
    if (step === 1) return d.center.trim() && d.director.trim() && d.child.trim() && okEmail(d.email);
    if (step === 8) return d.photos.filter((p) => p.src).length >= 2;
    if (step === 9) return d.letter.trim().length > 30;
    return true;
  };

  const pickPhoto = async (i, file) => {
    if (!file) return;
    try {
      setBusy('photo' + i);
      const src = await shrinkImage(file);
      set((prev) => ({ photos: prev.photos.map((p, j) => (j === i ? { ...p, src, face: null } : p)) }));
      // 얼굴 위치를 찾아 두면 부모님 화면에서 얼굴이 서서히 자라나듯 변한다
      setBusy('face' + i);
      const face = await findFace(src);
      set((prev) => ({ photos: prev.photos.map((p, j) => (j === i && p.src === src ? { ...p, face } : p)) }));
    } catch (e) {
      setMsg({ err: e.message, ok: '' });
    } finally {
      setBusy('');
    }
  };

  const writeLetter = async (again) => {
    setBusy('letter');
    setMsg({ err: '', ok: '' });
    try {
      const { photos, letter, ...info } = d;
      const r = await fetch('/api/letter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...info, again }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'AI 편지를 만들지 못했어요.');
      set({ letter: j.letter });
      setMsg({ err: '', ok: '편지가 완성됐어요. 읽어 보시고 마음에 맞게 고쳐 주세요.' });
    } catch (e) {
      set((prev) => ({ letter: prev.letter || fallbackLetter(prev) }));
      setMsg({ err: `${e.message} 대신 기본 편지를 넣어 두었어요. 고쳐서 쓰셔도 돼요.`, ok: '' });
    } finally {
      setBusy('');
    }
  };

  const save = async (asNew) => {
    setBusy('save');
    setMsg({ err: '', ok: '' });
    try {
      const data = {
        center: d.center.trim(), director: d.director.trim(), child: d.child.trim(), email: d.email.trim(), deadline: d.deadline,
        plans: d.plans, vision: d.vision, merits: d.merits.filter((m) => m.trim()), letter: d.letter.trim(),
        photos: d.photos.filter((p) => p.src),
      };
      const body = { data };
      if (!asNew && d.code && d.editKey) { body.code = d.code; body.editKey = d.editKey; }
      if (alarm.on && savedSub()) body.push = savedSub(); // 알림 켠 기기는 새 편지에도 자동으로
      const r = await fetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '링크를 만들지 못했어요.');
      set({ code: j.code, editKey: j.editKey });
      const list = [{ child: data.child, code: j.code, editKey: j.editKey, at: new Date().toISOString().slice(0, 10) },
        ...(lsGet(MADE_KEY) || []).filter((m) => m.code !== j.code)].slice(0, 200);
      lsSet(MADE_KEY, list);
      setMade(list);
      setMsg({ err: '', ok: body.code ? '이미 보낸 링크에 고친 내용을 반영했어요. (1분쯤 뒤 보입니다)' : '링크가 만들어졌어요!' });
    } catch (e) {
      setMsg({ err: e.message, ok: '' });
    } finally {
      setBusy('');
    }
  };

  const loadMade = async (m) => {
    setBusy('load');
    try {
      const r = await fetch(`/api/load?c=${m.code}&k=${m.editKey}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const rec = j.data;
      const photos = PHOTO_CAPTIONS.map((caption, i) => rec.photos?.[i] || { src: '', caption });
      setD({ ...emptyOrg(), ...emptyChild(), ...rec, photos, code: m.code, editKey: m.editKey });
      go(9);
    } catch (e) {
      setMsg({ err: '불러오지 못했어요: ' + (e.message || ''), ok: '' });
    } finally {
      setBusy('');
    }
  };

  // 「알림 받기」: 이 기기를 이 컴퓨터에서 만든 모든 편지에 등록하고 시험 알림을 보낸다
  const turnOnAlarm = async () => {
    setAlarm((a) => ({ ...a, busy: true, ok: '', err: '' }));
    try {
      const sub = await enablePush();
      const list = lsGet(MADE_KEY) || [];
      const items = [...(d.code && d.editKey ? [{ code: d.code, editKey: d.editKey }] : []), ...list.filter((m) => m.code !== d.code)]
        .map((m) => ({ code: m.code, editKey: m.editKey }));
      const r = await registerPush(sub, items, true);
      setAlarm({ on: true, busy: false, err: '', ok: `알림을 켰어요! (편지 ${r.added}개) 방금 시험 알림을 보냈어요 — 화면 오른쪽 아래(휴대폰은 위쪽)에 떴는지 확인해 주세요.` });
    } catch (e) {
      setAlarm((a) => ({ ...a, busy: false, err: e.message || '알림을 켜지 못했어요.' }));
    }
  };

  const nextChild = () => {
    setD((prev) => ({ ...prev, ...emptyChild() }));
    go(1);
  };

  const link = d.code && typeof window !== 'undefined' ? `${window.location.origin}/l/${d.code}` : '';
  const kakao = link ? `${d.child} 가족께\n${d.center}에서 2027년 소식을 보내드립니다.\n한 해 동안 자란 ${d.child}의 이야기와 원장님의 편지가 들어 있어요. 아래 편지를 열어 주세요 💌\n${link}` : '';
  const copy = async (t, what) => {
    try { await navigator.clipboard.writeText(t); setMsg({ err: '', ok: `${what}을(를) 복사했어요. 카톡에 붙여 넣으세요.` }); } catch (e) { setMsg({ err: '복사가 안 되면 글자를 길게 눌러 복사해 주세요.', ok: '' }); }
  };

  const Nav = ({ nextLabel = '다음', onNext }) => (
    <div className="nav">
      {step > 0 ? <button className="btn ghost" onClick={() => go(step - 1)}>이전</button> : null}
      <button className="btn" disabled={!canNext()} onClick={onNext || (() => go(step + 1))}>{nextLabel}</button>
    </div>
  );

  const closeChromePop = () => { if (chromePop === 'ok') lsSet(CHROME_SEEN, 1); setChromePop(''); };
  const copySite = async () => {
    try { await navigator.clipboard.writeText(window.location.origin); setChromePop('copied'); } catch (e) { setChromePop('copyfail'); }
  };

  return (
    <div className="wrap">
      {chromePop ? (
        <div className="pop-bg" role="dialog" aria-modal="true">
          <div className="pop">
            <div className="pop-icon">🌐</div>
            <h3>이 사이트는<br /><b>크롬(Chrome)</b>으로 접속하세요</h3>
            {chromePop === 'ok' ? (
              <p>지금 크롬으로 잘 열려 있어요 👍<br />편지 만들기·사진 얼굴 맞춤·<b>신청서 알림</b>이 크롬에서 가장 잘 돼요.</p>
            ) : (
              <>
                <p>지금은 크롬이 아닌 브라우저로 열려 있어요.<br />크롬에서 열어야 <b>사진 얼굴 맞춤</b>과 <b>신청서 알림</b>이 제대로 돼요.</p>
                <ol>
                  <li>아래 「주소 복사」를 눌러요</li>
                  <li>크롬을 열고 주소창에 붙여 넣어요</li>
                </ol>
                <div className="linkbox" style={{ textAlign: 'center' }}>{typeof window !== 'undefined' ? window.location.origin : ''}</div>
                {chromePop === 'copied' ? <div className="ok">주소를 복사했어요. 크롬 주소창에 붙여 넣으세요.</div> : null}
                {chromePop === 'copyfail' ? <div className="err">복사가 안 되면 위 주소를 길게 눌러 복사해 주세요.</div> : null}
                <button className="btn green" style={{ width: '100%', marginBottom: 8 }} onClick={copySite}>주소 복사</button>
              </>
            )}
            <button className={`btn${chromePop === 'ok' ? '' : ' ghost'}`} style={{ width: '100%' }} onClick={closeChromePop}>
              {chromePop === 'ok' ? '확인' : '그냥 이 브라우저로 볼게요'}
            </button>
          </div>
        </div>
      ) : null}
      <div className="top">
        <div className="kicker">2027 재원신청서</div>
        <h1>감동의 재원신청서 만들기</h1>
        <p>한 해의 성장을 편지로 전하고, 재원 신청을 받아요</p>
      </div>

      {step > 0 ? (
        <>
          <div className="progress">{STEPS.slice(1).map((_, i) => <span key={i} className={i < step ? 'on' : ''} />)}</div>
          <div className="stepno">{step} / {STEPS.length - 1} · {STEPS[step]}</div>
        </>
      ) : null}

      {step === 0 && (
        <div className="card">
          <h2>원장님, 한 해 동안 정말 수고 많으셨어요</h2>
          <p className="help">질문에 답하시면 아이 한 명 한 명에게 보내는 편지와 재원신청서 링크가 만들어져요.</p>
          <div className="intro-steps">
            <div><b>1</b>아이에 대한 질문 몇 가지에 답하기 (5분)</div>
            <div><b>2</b>입학 때부터 지금까지 사진 4장 넣기</div>
            <div><b>3</b>AI가 원장님 편지를 써 주면 읽고 다듬기</div>
            <div><b>4</b>링크를 카톡으로 부모님께 보내기</div>
          </div>
          <p className="help" style={{ marginTop: 14 }}>
            부모님은 <b>“2027년 소식이 도착하였습니다”</b> 편지를 열어 아이의 성장 영상과 편지를 보고,
            재원신청서에 서명하면 <b>PDF가 원장님 메일로</b> 도착합니다.
          </p>
          <Nav nextLabel={d.child && !d.code ? `${d.child} 편지 이어서 만들기` : '시작하기'} onNext={() => (d.code ? nextChild() : go(1))} />
          {d.child && !d.code ? <button className="skip" onClick={nextChild}>다른 아이로 새로 시작하기</button> : null}
          {made.length ? (
            <div style={{ marginTop: 22 }}>
              <div className="field"><label>이 컴퓨터에서 만든 편지 ({made.length}개)</label>
                <div className="checks">
                  {made.slice(0, 30).map((m) => (
                    <div key={m.code} className="check" style={{ alignItems: 'center' }}>
                      <span style={{ flex: 1 }}>{m.child} <span style={{ color: 'var(--soft)', fontSize: 13 }}>· {m.at}</span></span>
                      <a className="btn small line" href={`/l/${m.code}`} target="_blank" rel="noreferrer">열기</a>
                      <button className="btn small" disabled={busy === 'load'} onClick={() => loadMade(m)}>고치기</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>먼저, 누구에게 보내는 편지인가요?</h2>
          <p className="help">어린이집 정보는 한 번만 적으면 다음 아이 때 그대로 남아 있어요.</p>
          <div className="field"><label>어린이집 이름</label><input type="text" value={d.center} onChange={(e) => set({ center: e.target.value })} placeholder="예: 햇살어린이집" /></div>
          <div className="field"><label>원장님 이름</label><input type="text" value={d.director} onChange={(e) => set({ director: e.target.value })} placeholder="예: 김햇살" /></div>
          <div className="field"><label>아이 이름</label><input type="text" value={d.child} onChange={(e) => set({ child: e.target.value })} placeholder="예: 이서윤" /></div>
          <div className="field">
            <label>신청서를 받을 원장님 메일</label>
            <input type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} placeholder="예: sunny@naver.com" />
            {d.email && !okEmail(d.email)
              ? <div className="warn">구글(@gmail.com) 또는 네이버(@naver.com) 메일만 쓸 수 있어요. 한메일 등은 신청서가 도착하지 않을 수 있어요.</div>
              : <div className="hint">구글(@gmail.com)·네이버(@naver.com) 메일만 받을 수 있어요.</div>}
          </div>
          <div className="field"><label>신청 마감일 (선택)</label><input type="date" value={d.deadline} onChange={(e) => set({ deadline: e.target.value })} /></div>
          <Nav />
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>2026년, {d.child || '아이'}를 처음 만났을 때 어떤 모습이었나요?</h2>
          <p className="help">떠오르는 것을 눌러 주세요. 여러 개 골라도 돼요.</p>
          <div className="chips">
            {FIRST_TAGS.map((t) => <button key={t} className={`chip${d.firstTags.includes(t) ? ' on' : ''}`} onClick={() => set((p) => ({ firstTags: toggle(p.firstTags, t) }))}>{t}</button>)}
          </div>
          <div className="field" style={{ marginTop: 16 }}><label>더 적고 싶은 첫 모습 (선택)</label>
            <textarea value={d.firstDay} onChange={(e) => set({ firstDay: e.target.value })} placeholder="예: 첫날 가방을 꼭 안고 문 앞에서 한참을 서 있었어요." /></div>
          <Nav />
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>1년 동안 {d.child || '아이'}는 어떻게 자랐나요?</h2>
          <p className="help">지금의 모습을 골라 주세요.</p>
          <div className="chips">
            {GROW_TAGS.map((t) => <button key={t} className={`chip${d.growTags.includes(t) ? ' on' : ''}`} onClick={() => set((p) => ({ growTags: toggle(p.growTags, t) }))}>{t}</button>)}
          </div>
          <div className="field" style={{ marginTop: 16 }}><label>가장 많이 자란 점 (선택)</label>
            <textarea value={d.grow} onChange={(e) => set({ grow: e.target.value })} placeholder="예: 이제는 먼저 선생님 손을 잡고 오늘 있었던 일을 이야기해 줘요." /></div>
          <div className="field"><label>{d.child || '아이'}만의 매력은요? (선택)</label>
            <input type="text" value={d.charm} onChange={(e) => set({ charm: e.target.value })} placeholder="예: 눈이 반달이 되는 웃음, 친구를 챙기는 따뜻한 마음" /></div>
          <Nav />
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h2>함께한 1년 중 가장 기억에 남는 장면은요?</h2>
          <p className="help">한 장면만 구체적으로 적어 주시면 편지가 훨씬 감동적이 돼요.</p>
          <div className="field">
            <textarea style={{ minHeight: 140 }} value={d.moment} onChange={(e) => set({ moment: e.target.value })}
              placeholder="예: 가을 산책길에 주운 빨간 낙엽을 ‘선생님 선물’이라며 주머니에서 꺼내 주던 날" />
          </div>
          <Nav />
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <h2>전하고 싶은 말이 있나요?</h2>
          <p className="help">짧게 적어도 괜찮아요. 비워 두면 AI가 자연스럽게 채워요.</p>
          <div className="field"><label>{d.child || '아이'}에게</label>
            <textarea value={d.toChild} onChange={(e) => set({ toChild: e.target.value })} placeholder="예: 너의 웃음 덕분에 우리 반이 매일 환했어. 고마워." /></div>
          <div className="field"><label>부모님께</label>
            <textarea value={d.toParent} onChange={(e) => set({ toParent: e.target.value })} placeholder="예: 늘 믿고 맡겨 주셔서 감사합니다." /></div>
          <Nav />
        </div>
      )}

      {step === 6 && (
        <div className="card">
          <h2>2027년 {d.center || '우리 원'}의 계획은요?</h2>
          <p className="help">샘플을 골라 쓰셔도 되고, 직접 추가하셔도 돼요. 신청서 화면에 소개됩니다.</p>
          <div className="checks">
            {[...new Set([...PLAN_SAMPLES, ...d.plans])].map((t) => (
              <button key={t} className={`check${d.plans.includes(t) ? ' on' : ''}`} onClick={() => set((p) => ({ plans: toggle(p.plans, t) }))}>
                <span className="box">{d.plans.includes(t) ? '✓' : ''}</span>{t}
              </button>
            ))}
          </div>
          <AddRow placeholder="직접 추가: 예) 텃밭 가꾸기 프로젝트" onAdd={(t) => set((p) => ({ plans: p.plans.includes(t) ? p.plans : [...p.plans, t] }))} />
          <Nav />
        </div>
      )}

      {step === 7 && (
        <div className="card">
          <h2>2027년의 포부와 재원의 좋은 점</h2>
          <p className="help">샘플이 들어 있어요. 원장님 말투로 고쳐 주세요.</p>
          <div className="field"><label>2027년 {d.center || '우리 원'}의 포부</label>
            <textarea style={{ minHeight: 130 }} value={d.vision} onChange={(e) => set({ vision: e.target.value })} />
            <button className="btn small ghost" style={{ marginTop: 6 }} onClick={() => set({ vision: VISION_SAMPLE })}>샘플로 되돌리기</button></div>
          <div className="field"><label>재원하면 좋은 점 (메모로 보여요)</label>
            {d.merits.map((m, i) => (
              <div key={i} className="addrow" style={{ marginTop: i ? 8 : 0 }}>
                <input type="text" value={m} onChange={(e) => set((p) => ({ merits: p.merits.map((x, j) => (j === i ? e.target.value : x)) }))} />
                <button className="btn small ghost" onClick={() => set((p) => ({ merits: p.merits.filter((_, j) => j !== i) }))}>빼기</button>
              </div>
            ))}
            <AddRow placeholder="좋은 점 추가" onAdd={(t) => set((p) => ({ merits: [...p.merits, t] }))} />
          </div>
          <Nav />
        </div>
      )}

      {step === 8 && (
        <div className="card">
          <h2>{d.child || '아이'}의 사진 4장을 넣어 주세요</h2>
          <p className="help">입학했을 때부터 지금까지 순서대로 넣으면, 아이 얼굴이 같은 자리에서 서서히 자라나는 영상이 돼요. (최소 2장)</p>
          <p className="help" style={{ fontSize: 13 }}>💡 얼굴이 정면으로 크게 나온 사진일수록 자연스러워요. 얼굴을 못 찾은 사진은 부드럽게 겹쳐서 넘어가요.</p>
          <div className="photos">
            {d.photos.map((p, i) => (
              <div key={i} className={`slot${p.src ? ' filled' : ''}`}>
                <label className="pic">
                  <span className="num">{i + 1}</span>
                  {p.src ? <img src={p.src} alt="" /> : <span>{busy === 'photo' + i ? '줄이는 중…' : <>📷<br />{PHOTO_LABELS[i]}<br />사진 고르기</>}</span>}
                  {p.src ? <span className="facetag">{busy === 'face' + i ? '얼굴 찾는 중…' : p.face ? '😊 얼굴 맞춤' : '얼굴을 못 찾았어요'}</span> : null}
                  <input type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(i, e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <input type="text" value={p.caption} placeholder="사진 아래 글귀"
                  onChange={(e) => set((prev) => ({ photos: prev.photos.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) }))} />
              </div>
            ))}
          </div>
          {d.photos.some((p) => p.src) ? (
            <>
              <div className="field" style={{ marginTop: 18 }}><label>미리 보기</label></div>
              <div className="preview-film"><GrowthFilm photos={d.photos} child={d.child} /></div>
            </>
          ) : null}
          {msg.err ? <div className="err">{msg.err}</div> : null}
          <Nav nextLabel="편지 쓰러 가기" onNext={() => { go(9); if (!d.letter) writeLetter(false); }} />
        </div>
      )}

      {step === 9 && (
        <div className="card">
          <h2>원장님의 편지</h2>
          <p className="help">인터뷰 내용으로 AI가 쓴 편지예요. 읽어 보시고 자유롭게 고쳐 주세요.</p>
          <textarea className="letterbox" value={busy === 'letter' ? '편지를 쓰고 있어요… (20초쯤 걸려요)' : d.letter}
            disabled={busy === 'letter'} onChange={(e) => set({ letter: e.target.value })} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn small line" disabled={busy === 'letter'} onClick={() => writeLetter(!!d.letter)}>✨ {d.letter ? '다른 느낌으로 다시 쓰기' : 'AI로 편지 쓰기'}</button>
          </div>
          {msg.err ? <div className="err">{msg.err}</div> : null}
          {msg.ok ? <div className="ok">{msg.ok}</div> : null}
          <Nav nextLabel="부모님 링크 만들기" onNext={() => go(10)} />
        </div>
      )}

      {step === 10 && (
        <div className="card">
          <h2>{d.child} 가족에게 보낼 링크</h2>
          {!d.code ? (
            <>
              <p className="help">아래 단추를 누르면 부모님께 보낼 짧은 링크가 만들어져요.</p>
              <button className="btn green" style={{ width: '100%' }} disabled={busy === 'save'} onClick={() => save(true)}>
                {busy === 'save' ? '만드는 중…' : '💌 링크 만들기'}
              </button>
            </>
          ) : (
            <>
              <div className="linkbox">{link}</div>
              <div className="row">
                <button className="btn small green" onClick={() => copy(kakao, '카톡 보낼 글')}>카톡 보낼 글 복사</button>
                <button className="btn small line" onClick={() => copy(link, '링크')}>링크만 복사</button>
                <a className="btn small line" href={link} target="_blank" rel="noreferrer">부모님 화면 미리 보기</a>
              </div>
              <p className="help" style={{ marginTop: 14 }}>내용을 고쳤다면 아래 단추로 <b>같은 링크에 반영</b>할 수 있어요.</p>
              <button className="btn small ghost" disabled={busy === 'save'} onClick={() => save(false)}>고친 내용 같은 링크에 반영하기</button>
              <div className="alarm">
                <b>🔔 신청서가 오면 알림 받기</b>
                <p className="help" style={{ margin: '4px 0 10px' }}>
                  부모님이 재원신청서나 답신을 보내면 <b>이 컴퓨터(또는 휴대폰)</b>에 알림이 떠요. 기기마다 한 번만 켜면 앞으로 만드는 편지에도 계속 적용돼요.
                </p>
                {iosNeedsInstall() ? (
                  <p className="help">아이폰은 먼저 사파리 아래 <b>공유(□↑) → 「홈 화면에 추가」</b>를 누르고, 홈 화면에 생긴 「재원신청서」로 들어와 이 단추를 눌러 주세요.</p>
                ) : !pushSupported() ? (
                  <p className="help">이 브라우저는 알림을 지원하지 않아요. 크롬이나 엣지로 열어 주세요.</p>
                ) : (
                  <button className={`btn small${alarm.on ? ' line' : ' green'}`} disabled={alarm.busy} onClick={turnOnAlarm}>
                    {alarm.busy ? '켜는 중…' : alarm.on ? '✓ 알림 켜짐 · 시험 알림 다시 보내기' : '🔔 이 기기로 알림 받기'}
                  </button>
                )}
                {alarm.ok ? <div className="ok">{alarm.ok}</div> : null}
                {alarm.err ? <div className="err">{alarm.err}</div> : null}
              </div>
            </>
          )}
          {msg.err ? <div className="err">{msg.err}</div> : null}
          {msg.ok ? <div className="ok">{msg.ok}</div> : null}
          <div className="nav">
            <button className="btn ghost" onClick={() => go(9)}>이전</button>
            {d.code ? <button className="btn" onClick={nextChild}>다음 아이 만들기</button> : null}
          </div>
        </div>
      )}

      <div className="foot">작성한 내용은 이 컴퓨터에 자동으로 임시저장돼요.</div>
    </div>
  );
}

function AddRow({ placeholder, onAdd }) {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim(); if (t) { onAdd(t); setV(''); } };
  return (
    <div className="addrow">
      <input type="text" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
      <button className="btn small" onClick={add}>추가</button>
    </div>
  );
}
