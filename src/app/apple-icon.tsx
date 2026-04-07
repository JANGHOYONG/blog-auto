import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: 'linear-gradient(135deg, #177A5E 0%, #1E9E7A 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {/* 흰색 십자 아이콘 */}
        <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* 세로 막대 */}
          <div style={{ position: 'absolute', width: 20, height: 64, background: 'white', borderRadius: 6 }} />
          {/* 가로 막대 */}
          <div style={{ position: 'absolute', width: 64, height: 20, background: 'white', borderRadius: 6 }} />
        </div>
        {/* 텍스트 */}
        <div style={{ color: 'white', fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginTop: 4 }}>
          건강백과
        </div>
      </div>
    ),
    { ...size }
  );
}
