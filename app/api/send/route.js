// 학부모님이 쓴 재원신청서 PDF를 원장님 메일로 보낸다 (Brevo).
// 받는 주소는 브라우저가 아니라 보관함에 저장된 원장님 메일을 쓴다 — 아무 주소로나 보내지 못하게.
import { validCode, readRecord, writeRecord } from '../../lib/store';
import { sendPush, mailUrl } from '../../lib/push';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const KEY = process.env.BREVO_API_KEY;
    const FROM = process.env.FROM_EMAIL;
    const FROMNAME = process.env.FROM_NAME || '감동의 재원신청서';
    if (!KEY || !FROM) return Response.json({ error: '메일 설정이 아직 안 되어 있어요.', noMail: true }, { status: 500 });

    const b = await req.json();
    if (!validCode(b.code)) return Response.json({ error: '주소가 올바르지 않아요.' }, { status: 400 });
    if (!b.pdfBase64 || b.pdfBase64.length > 6 * 1024 * 1024) {
      return Response.json({ error: '신청서 파일이 없거나 너무 커요.' }, { status: 400 });
    }
    const rec = await readRecord(b.code);
    if (!rec?.email) return Response.json({ error: '받을 메일을 찾지 못했어요.' }, { status: 404 });

    const child = String(b.child || rec.child).slice(0, 30);
    const parent = String(b.parent || '').slice(0, 30);
    const leave = b.mode === 'leave';
    const subject = leave
      ? `[2027 재원 어려움 답신] ${child} (보호자 ${parent})`
      : `[2027 재원신청서] ${child} (보호자 ${parent})`;
    const who = `${child} 보호자 ${parent}${b.relation ? `(${b.relation})` : ''}님이`;
    const text =
      `${rec.center} 원장님, 안녕하세요.\n\n` +
      (leave ? `${who} 2027년 재원이 어렵다는 답신을 보내셨습니다.\n` : `${who} 2027년 재원신청서를 보내셨습니다.\n`) +
      (b.phone ? `· 연락처: ${b.phone}\n` : '') +
      (leave && b.reason ? `· 사유 및 답신:\n${String(b.reason).slice(0, 2000)}\n` : '') +
      (!leave && b.memo ? `· 남기신 말씀: ${String(b.memo).slice(0, 500)}\n` : '') +
      `· 작성 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n\n` +
      (leave ? '답신 내용을 PDF로 첨부했습니다.' : '서명이 담긴 신청서 PDF를 첨부했습니다.') + `\n\n— 감동의 재원신청서`;

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: FROMNAME, email: FROM },
        to: [{ email: rec.email }],
        subject,
        textContent: text,
        attachment: [{ content: b.pdfBase64, name: `2027_${leave ? '재원답신' : '재원신청서'}_${child}.pdf` }],
      }),
    });
    const mailed = r.status >= 200 && r.status < 300;
    if (!mailed) console.error('Brevo 오류', (await r.text()).slice(0, 300));

    // 원장님이 「알림 받기」를 켜 둔 기기로 알림 (메일과 별개 — 실패해도 신청은 그대로)
    if (rec.push?.length) {
      try {
        const who = `${child} ${b.relation || '보호자'} ${parent}님`;
        const res = await sendPush(rec.push, {
          title: leave ? '📮 재원 어려움 답신이 도착했어요' : '🔔 재원신청서가 도착했어요',
          body: `${who}이 ${leave ? '답신을' : '2027 재원신청서를'} 보냈어요.${mailed ? ' 메일함에서 확인해 주세요.' : ''}`,
          url: mailUrl(rec.email),
        });
        if (res.dead.length) {
          const fresh = await readRecord(b.code);
          if (fresh) await writeRecord(b.code, { ...fresh, push: (fresh.push || []).filter((x) => !res.dead.includes(x.endpoint)) });
        }
      } catch (e) {
        console.error('알림 오류', e?.message);
      }
    }

    if (mailed) return Response.json({ ok: true });
    return Response.json({ error: '메일 전송 실패' }, { status: 502 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
