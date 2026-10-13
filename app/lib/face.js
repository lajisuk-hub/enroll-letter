// 사진에서 아이 얼굴의 눈·코·입·얼굴선 위치를 찾는다 (구글 MediaPipe, 원장님 브라우저에서만 실행).
// 찾은 점은 사진과 함께 저장해 두고, 부모님 화면은 이 점으로 얼굴을 맞춰 서서히 변하게(모핑) 보여 준다.
// 못 찾으면 null — 그 사진은 예전처럼 부드럽게 겹치기만 한다.

const VER = '0.10.14';
const LIB = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`;
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// 얼굴선 36 + 눈썹 10 + 눈 12 + 코 7 + 입 14 = 79점 (전체 478점 중 모양을 잡는 데 필요한 것만)
export const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const REST = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
  33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380,
  1, 4, 168, 98, 327, 2, 195,
  61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, 13, 14];
export const KEY = [...OVAL, ...REST];
// KEY 안에서 눈꼬리 위치 (왼눈 33·133, 오른눈 362·263)
export const EYE = { l1: KEY.indexOf(33), l2: KEY.indexOf(133), r1: KEY.indexOf(362), r2: KEY.indexOf(263) };

let loader = null;
function getLandmarker() {
  if (!loader) {
    loader = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(/* webpackIgnore: true */ LIB);
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: 'IMAGE',
        numFaces: 3,
      });
    })().catch((e) => { loader = null; throw e; });
  }
  return loader;
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// 사진 주소(data URL)를 받아 [[x,y],...] (0~1 비율) 79점, 못 찾으면 null
export async function findFace(src) {
  try {
    const [lm, img] = await Promise.all([getLandmarker(), loadImg(src)]);
    const r = lm.detect(img);
    const faces = r?.faceLandmarks || [];
    if (!faces.length) return null;
    // 여러 얼굴이면 가장 큰 얼굴(아이가 주인공)
    const size = (f) => { const xs = OVAL.map((i) => f[i].x); return Math.max(...xs) - Math.min(...xs); };
    const f = faces.reduce((a, b) => (size(b) > size(a) ? b : a));
    return KEY.map((i) => [Math.round(f[i].x * 10000) / 10000, Math.round(f[i].y * 10000) / 10000]);
  } catch (e) {
    console.warn('얼굴 찾기 실패', e);
    return null;
  }
}
