// 알림 전용 서비스워커: 부모님이 신청서·답신을 보내면 원장님 컴퓨터/휴대폰에 알림을 띄운다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '감동의 재원신청서', {
    body: d.body || '새 소식이 도착했어요.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    requireInteraction: true, // 원장님이 누를 때까지 화면에 남겨 둔다
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.openWindow(url));
});
