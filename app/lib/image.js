// 휴대폰 사진은 크고 무거워서, 긴 쪽 1080px · JPEG로 줄여서 담는다 (한 장 200KB 안팎).
export function shrinkImage(file, max = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했어요. 다른 사진(JPG·PNG)으로 골라 주세요.'));
    };
    img.src = url;
  });
}
