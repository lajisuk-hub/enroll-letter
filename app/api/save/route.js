// 원장님이 만든 편지(기관 정보·편지글·사진 4장)를 보관함에 넣고 짧은 번호를 돌려준다.
// 이미 만든 링크를 고칠 때는 code + editKey를 같이 보내면 같은 주소에 덮어쓴다.
import { makeCode, validCode, exists, readRecord, writeRecord, okEmail } from '../../lib/store';
import { mergeSubs } from '../../lib/push';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json({ error: '보관함이 아직 연결되지 않았어요.' }, { status: 500 });
    }
    const raw = await req.text();
    if (raw.length > 4_200_000) {
      return Response.json({ error: '사진 용량이 너무 커요. 사진을 다시 골라 주세요.' }, { status: 413 });
    }
    const body = JSON.parse(raw);
    const data = body?.data || {};
    if (!data.center || !data.child || !data.letter) {
      return Response.json({ error: '어린이집 이름·아이 이름·편지글이 필요해요.' }, { status: 400 });
    }
    if (!okEmail(data.email)) {
      return Response.json({ error: '받을 메일은 구글(@gmail.com)이나 네이버(@naver.com) 주소만 쓸 수 있어요.' }, { status: 400 });
    }

    let code = '';
    let editKey = '';
    let oldPush = [];
    if (body.code && validCode(body.code)) {
      const old = await readRecord(body.code);
      if (!old) return Response.json({ error: '고칠 링크를 찾지 못했어요.' }, { status: 404 });
      if (!body.editKey || old.editKey !== body.editKey) {
        return Response.json({ error: '이 링크를 고칠 권한이 없어요. 새 링크로 만들어 주세요.' }, { status: 403 });
      }
      code = body.code;
      editKey = old.editKey;
      oldPush = old.push || [];
    } else {
      for (let i = 0; i < 5; i += 1) {
        const c = makeCode();
        if (!(await exists(c))) { code = c; break; }
      }
      if (!code) code = makeCode(8);
      editKey = makeCode(12);
    }

    const push = mergeSubs(oldPush, body.push ? [body.push] : []); // 고쳐 저장해도 알림 기기는 그대로
    const { push: _ignore, ...clean } = data;
    await writeRecord(code, { ...clean, push, editKey, savedAt: new Date().toISOString() });
    return Response.json({ code, editKey });
  } catch (err) {
    console.error(err);
    return Response.json({ error: '저장 중 문제가 생겼어요: ' + err.message }, { status: 500 });
  }
}
