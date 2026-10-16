import Letter from './Letter';

export const metadata = {
  title: '2027년 재원신청서가 도착하였습니다 💌',
  description: '한 해 동안 자란 우리 아이의 이야기와 원장님의 편지',
};

export default function Page({ params }) {
  return <Letter code={params.code} />;
}
