// 보관함(Vercel Blob) 읽기·쓰기 도우미 — 서버에서만 쓴다.
// ⚠ list()는 무료 한도(고급 작업 월 2,000회)를 깎으니 쓰지 않는다.
//    보관함 주소(origin)를 head()로 한 번만 알아내 기억해 두고 그 뒤엔 곧바로 읽는다.
import { put, head } from '@vercel/blob';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
let blobOrigin = '';

export function makeCode(len = 6) {
  let out = '';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export const pathOf = (code) => `letters/${code}.json`;
export const validCode = (code) => typeof code === 'string' && /^[a-z0-9]{4,12}$/.test(code);

async function readJson(url) {
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function readRecord(code) {
  const path = pathOf(code);
  if (blobOrigin) {
    const rec = await readJson(`${blobOrigin}/${path}`);
    if (rec) return rec;
  }
  let info;
  try {
    info = await head(path);
  } catch (err) {
    return null;
  }
  blobOrigin = new URL(info.url).origin;
  return readJson(info.url);
}

export async function exists(code) {
  try {
    await head(pathOf(code));
    return true;
  } catch (err) {
    return false;
  }
}

export async function writeRecord(code, rec) {
  await put(pathOf(code), JSON.stringify(rec), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

// 받을 메일은 구글·네이버만 (한메일 등은 도착이 잘 안 됨)
export function okEmail(email) {
  return /^[^@\s]+@(gmail\.com|naver\.com)$/i.test(String(email || '').trim());
}
