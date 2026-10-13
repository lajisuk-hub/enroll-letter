// 인터뷰 답을 바탕으로 원장님 편지를 AI가 쓴다.
// JSON으로 받으면 따옴표 때문에 깨지는 일이 있어 편지글을 그대로 받는다.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-5';

export async function POST(req) {
  try {
    const d = await req.json();
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'AI 열쇠(환경변수)가 설정되지 않았어요.' }, { status: 500 });
    }
    const list = (a) => (Array.isArray(a) && a.length ? a.join(', ') : '');
    const prompt = [
      '너는 어린이집 원장이다. 한 해를 함께 보낸 아이의 부모님께 손편지를 쓴다.',
      '이 편지는 내년(2027년) 재원 신청서를 드리기 직전에 열어 보는 편지다. 부모님이 아이의 1년을 떠올리며 마음이 뭉클해지도록 쓴다.',
      '',
      `어린이집: ${d.center}`,
      `원장: ${d.director}`,
      `아이 이름: ${d.child}`,
      d.firstDay || d.firstTags?.length ? `처음 왔을 때 모습: ${[list(d.firstTags), d.firstDay].filter(Boolean).join(' / ')}` : '',
      d.growTags?.length || d.grow ? `1년 동안 자란 점: ${[list(d.growTags), d.grow].filter(Boolean).join(' / ')}` : '',
      d.moment ? `기억에 남는 장면: ${d.moment}` : '',
      d.charm ? `이 아이만의 매력: ${d.charm}` : '',
      d.toChild ? `아이에게 하고 싶은 말: ${d.toChild}` : '',
      d.toParent ? `부모님께 드리고 싶은 말: ${d.toParent}` : '',
      d.plans?.length ? `2027년 우리 원의 계획: ${list(d.plans)}` : '',
      d.vision ? `2027년 포부: ${d.vision}` : '',
      d.again ? '\n앞서 쓴 편지와는 다른 표현과 흐름으로 새로 써라.' : '',
      '',
      '쓰는 법:',
      `- 첫 줄은 부르는 말 한 줄(예: 사랑하는 ${d.child} 어머님, 아버님께). 마지막 줄은 날짜 없이 ${d.center} 원장 ${d.director} 드림.`,
      '- 본문은 4~6문단, 전체 600~850자. 처음 만난 날 → 함께 자란 1년 → 기억에 남는 장면 → 아이에게 건네는 말 → 2027년에도 곁에서 함께하고 싶은 마음 순서로 자연스럽게 잇는다.',
      '- 인터뷰에 적힌 사실만 쓰고, 없는 사건이나 활동을 지어내지 않는다. 구체적인 장면 묘사로 감동을 주고, 과장된 칭찬이나 상투적인 말은 줄인다.',
      '- 따뜻한 존댓말. 느낌표는 2개 이하. 이모지 쓰지 않는다.',
      '- 마지막 문단에서 2027년에도 함께하길 바라는 마음을 담되, 재원을 강요하는 느낌은 주지 않는다.',
      '- 큰따옴표와 작은따옴표는 쓰지 않는다. 제목·설명 없이 편지글만 출력한다. 문단 사이는 빈 줄 하나.',
    ].filter(Boolean).join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error('Anthropic 오류:', (await res.text()).slice(0, 500));
      return Response.json({ error: 'AI 응답을 받지 못했어요. 잠시 뒤 다시 눌러 주세요.' }, { status: 502 });
    }
    const data = await res.json();
    const letter = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!letter) return Response.json({ error: '편지를 만들지 못했어요. 다시 눌러 주세요.' }, { status: 502 });
    return Response.json({ letter });
  } catch (err) {
    console.error(err);
    return Response.json({ error: '오류가 났어요: ' + err.message }, { status: 500 });
  }
}
