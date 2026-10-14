// 원장님 브라우저에서 「알림 받기」를 켜는 도우미.
// 한 번 허락하면 이 기기의 알림 주소를 기억해 두고, 다음에 만드는 편지에도 자동으로 붙인다.
export const VAPID_PUBLIC_KEY = 'BLLa5gSm3sSSxHvoyw8AfMD3OJdQX8WEQFGROZM43yvQ_LqMca3EytMqDXvLpS0ZO2LMslzSodgCnSiv-ppYX50';
const SUB_KEY = 'enroll.push.v1';

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// 아이폰은 「홈 화면에 추가」한 앱 안에서만 알림을 받을 수 있다
export function iosNeedsInstall() {
  if (typeof window === 'undefined') return false;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

export function savedSub() {
  try { return JSON.parse(localStorage.getItem(SUB_KEY) || 'null'); } catch (e) { return null; }
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// 알림 허락 받고 이 기기 알림 주소 만들기 (실패하면 이유를 담아 throw)
export async function enablePush() {
  if (!pushSupported()) throw new Error('이 브라우저는 알림을 지원하지 않아요. 크롬이나 엣지로 열어 주세요.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('알림이 「차단」되어 있어요. 주소창 왼쪽 자물쇠(또는 ⓘ) → 알림 → 「허용」으로 바꾼 뒤 다시 눌러 주세요.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  try { localStorage.setItem(SUB_KEY, JSON.stringify(json)); } catch (e) { /* 기억 못 해도 이번 등록은 됨 */ }
  return json;
}

// 이 컴퓨터에서 만든 편지들에 이 기기를 등록(+시험 알림)
export async function registerPush(sub, items, test) {
  let added = 0;
  let sent = 0;
  for (let i = 0; i < Math.max(items.length, 1); i += 25) {
    const r = await fetch('/api/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sub, items: items.slice(i, i + 25), test: test && i === 0 }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '알림 등록에 실패했어요.');
    added += j.added || 0;
    sent += j.sent || 0;
  }
  return { added, sent };
}
