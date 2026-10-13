// 학부모님이 링크(/l/번호)를 열면 보관함에서 편지를 꺼내 온다.
// 원장님 메일 주소와 고치기 열쇠는 학부모님 화면에 보내지 않는다.
import { validCode, readRecord } from '../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req) {
  const code = new URL(req.url).searchParams.get('c');
  if (!validCode(code)) return Response.json({ error: '주소가 올바르지 않아요.' }, { status: 400 });
  const rec = await readRecord(code);
  if (!rec) return Response.json({ error: '편지를 찾지 못했어요.' }, { status: 404 });
  const key = new URL(req.url).searchParams.get('k');
  if (key && key === rec.editKey) return Response.json({ data: rec }); // 원장님이 고치려고 불러올 때
  const { email, editKey, ...safe } = rec;
  return Response.json({ data: safe });
}
