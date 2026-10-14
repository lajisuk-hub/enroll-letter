// 원장님이 「알림 받기」를 누르면 이 기기를 편지들에 등록한다. test:true면 시험 알림도 보낸다.
// 고치기 열쇠(editKey)가 맞는 편지에만 등록할 수 있다.
import { validCode, readRecord, writeRecord } from '../../lib/store';
import { okSub, mergeSubs, sendPush, mailUrl } from '../../lib/push';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const b = await req.json();
    if (!okSub(b.sub)) return Response.json({ error: '알림 정보가 올바르지 않아요.' }, { status: 400 });
    const items = (Array.isArray(b.items) ? b.items : []).filter((x) => validCode(x?.code) && x?.editKey).slice(0, 25);
    let added = 0;
    let email = '';
    for (const it of items) {
      const rec = await readRecord(it.code);
      if (!rec || rec.editKey !== it.editKey) continue;
      email = email || rec.email;
      const push = mergeSubs(rec.push || [], [b.sub]);
      if ((rec.push || []).some((s) => s.endpoint === b.sub.endpoint)) { added += 1; continue; }
      await writeRecord(it.code, { ...rec, push });
      added += 1;
    }
    let sent = 0;
    if (b.test) {
      const r = await sendPush([b.sub], {
        title: '🔔 알림이 켜졌어요',
        body: '부모님이 재원신청서나 답신을 보내면 이렇게 알려 드릴게요.',
        url: mailUrl(email),
        tag: 'enroll-test',
      });
      sent = r.sent;
    }
    return Response.json({ ok: true, added, sent });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
