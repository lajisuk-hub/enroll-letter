// html2canvas 1.4는 object-fit을 몰라 사진이 늘어나므로 배경그림(cover/contain)으로 넣는다.
// 서명이 들어간 재원신청서를 A4 한 장 PDF로 만든다 (화면에 안 보이는 곳에 그려서 찍기).
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const koDate = (v) => { const [y, m, d] = String(v || '').split('-'); return y && m && d ? `${y}년 ${Number(m)}월 ${Number(d)}일` : v; };

export function todayKo() {
  const t = new Date();
  return `${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일`;
}

export async function makeApplyPdf({ rec, form, sign, mode = 'stay' }) {
  const leave = mode === 'leave';
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const host = document.createElement('div');
  host.className = 'pdf-host';
  const photos = (rec.photos || []).slice(0, 4);
  const row = (k, v) => `<tr><th style="width:150px;background:#f7efe3;border:1px solid #cdbba4;padding:12px 14px;text-align:left;font-weight:700">${k}</th><td style="border:1px solid #cdbba4;padding:12px 14px">${esc(v) || '&nbsp;'}</td></tr>`;
  host.innerHTML = `
  <div style="width:794px;height:1123px;background:#fff;padding:70px 72px;box-sizing:border-box;font-family:'Gowun Dodum','Malgun Gothic',sans-serif;color:#2f2620;position:relative">
    <div style="text-align:center;color:#a85744;font-size:15px;letter-spacing:.2em">${esc(rec.center)}</div>
    <div style="text-align:center;font-family:'Gowun Batang',serif;font-size:36px;font-weight:700;margin:8px 0 6px;letter-spacing:.12em">${leave ? '2027학년도 재원 관련 답신' : '2027학년도 재원 신청서'}</div>
    <div style="height:3px;background:#c8735f;margin:18px 0 26px"></div>
    <table style="width:100%;border-collapse:collapse;font-size:17px">
      ${row('원아 이름', form.child)}
      ${leave ? '' : row('생년월일', koDate(form.birth))}
      ${row('보호자 이름', form.parent)}
      ${row('아이와의 관계', form.relation)}
      ${row('연락처', form.phone)}
      ${leave ? '' : row('원에 남기는 말', form.memo)}
    </table>
    ${leave ? `
    <div style="margin-top:22px;font-size:16px;font-weight:700;color:#a85744">사유 및 어린이집에 드리고 싶은 답신</div>
    <div style="border:1px solid #cdbba4;border-radius:6px;padding:16px 18px;margin-top:8px;font-size:17px;line-height:1.8;white-space:pre-wrap;min-height:110px;max-height:180px;overflow:hidden">${esc(form.reason)}</div>
    <div style="font-family:'Gowun Batang',serif;font-size:19px;line-height:1.9;text-align:center;margin:22px 0 14px">
      자녀 <b>${esc(form.child)}</b>의 2027학년도 <b>${esc(rec.center)}</b> 재원이 어려워<br/>위와 같이 답신을 드립니다.
    </div>` : `
    <div style="font-family:'Gowun Batang',serif;font-size:20px;line-height:1.9;text-align:center;margin:40px 0 28px">
      본인은 자녀 <b>${esc(form.child)}</b>의<br/>2027학년도 <b>${esc(rec.center)}</b> 재원을 희망하며<br/>이에 재원 신청서를 제출합니다.
    </div>`}
    <div style="text-align:center;font-size:18px;margin-bottom:20px">${todayKo()}</div>
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;font-size:19px;margin-right:10px">
      <span>보호자</span>
      <span style="font-family:'Gowun Batang',serif;font-size:22px;font-weight:700;min-width:90px;text-align:center">${esc(form.parent)}</span>
      ${leave ? '' : `<span style="position:relative;display:inline-block;width:190px;height:80px;border-bottom:1px solid #9c8b7a">
        ${sign ? `<span style="position:absolute;left:0;top:-6px;width:190px;height:86px;background:url(${sign}) center/contain no-repeat"></span>` : ''}
      </span>
      <span>(서명)</span>`}
    </div>
    <div style="font-family:'Gowun Batang',serif;font-size:24px;font-weight:700;margin-top:${leave ? 22 : 40}px">${esc(rec.center)} 원장 귀하</div>
    ${photos.length ? `
    <div style="position:absolute;left:72px;right:72px;bottom:58px">
      <div style="font-size:13px;color:#8a7766;margin-bottom:8px">함께 자란 2026년</div>
      <div style="display:flex;gap:10px">
        ${photos.map((p) => `<div style="flex:1;height:120px;border-radius:8px;background:#eee url(${p.src}) center/cover no-repeat"></div>`).join('')}
      </div>
    </div>` : ''}
  </div>`;
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297);
    pdf.setProperties({ title: `2027 ${leave ? '재원 답신' : '재원신청서'} ${form.child}` });
    const blob = pdf.output('blob');
    const base64 = pdf.output('datauristring').split(',')[1];
    return { blob, base64 };
  } finally {
    host.remove();
  }
}
