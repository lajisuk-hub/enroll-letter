// 원장님 기기로 알림 보내기(웹 푸시) — 서버에서만 쓴다.
// 알림 받을 기기 목록은 편지 기록의 push 칸에 들어 있다(부모님 화면에는 보내지 않음).
import webpush from 'web-push';

let ready = false;
function setup() {
  if (ready) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const pri = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !pri) return false;
  webpush.setVapidDetails('https://wmentor-enroll-letter.vercel.app', pub, pri);
  ready = true;
  return true;
}

export function okSub(s) {
  return !!(s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys?.p256dh && s.keys?.auth);
}

// 같은 기기는 한 번만, 최대 10대까지
export function mergeSubs(...lists) {
  const map = new Map();
  lists.flat().filter(okSub).forEach((s) => map.set(s.endpoint, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }));
  return [...map.values()].slice(-10);
}

export function mailUrl(email) {
  if (/@naver\.com$/i.test(email || '')) return 'https://mail.naver.com/';
  return 'https://mail.google.com/mail/u/0/#inbox';
}

// 보내고, 더 이상 없는 기기(404·410) 목록을 돌려준다
export async function sendPush(subs, payload) {
  if (!setup() || !subs?.length) return { sent: 0, dead: [] };
  const dead = [];
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 60 * 60 * 24 * 3, timeout: 8000 });
      sent += 1;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.endpoint);
      else console.error('알림 실패', err?.statusCode, String(err?.body || err?.message || '').slice(0, 200));
    }
  }));
  return { sent, dead };
}
