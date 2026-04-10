import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 112,
          background: 'linear-gradient(135deg, #177A5E 0%, #1E9E7A 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {/* 흰색 십자 */}
        <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 56, height: 180, background: 'white', borderRadius: 18 }} />
          <div style={{ position: 'absolute', width: 180, height: 56, background: 'white', borderRadius: 18 }} />
        </div>
        {/* 텍스트 */}
        <div style={{ color: 'white', fontSize: 68, fontWeight: 900, letterSpacing: -2 }}>
          건강백과
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
