import './globals.css';

export const metadata = {
  title: '감동의 재원신청서',
  description: '한 해의 성장을 담은 편지와 함께 받는 2027년 재원신청서',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6efe4' };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
