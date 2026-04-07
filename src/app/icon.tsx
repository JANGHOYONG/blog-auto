import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: 'linear-gradient(135deg, #177A5E 0%, #1E9E7A 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 흰색 십자 */}
        <div style={{ position: 'relative', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 5, height: 16, background: 'white', borderRadius: 2 }} />
          <div style={{ position: 'absolute', width: 16, height: 5, background: 'white', borderRadius: 2 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
