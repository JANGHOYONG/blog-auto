/**
 * 쿠팡파트너스 다이나믹 배너 (비건강 카테고리용)
 * srcdoc iframe 방식 — 스크립트 실행 가장 안정적
 */
export default function CoupangDynamicBanner() {
  const bannerHtml = `<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { overflow: hidden; background: transparent; }
</style>
</head>
<body>
<script src="https://ads-partners.coupang.com/g.js"><\/script>
<script>
new PartnersCoupang.G({"id":978610,"template":"carousel","trackingCode":"AF2509108","width":"728","height":"90","tsource":""});
<\/script>
</body>
</html>`;

  return (
    <div style={{ margin: '2rem 0' }}>
      <div style={{ overflowX: 'auto' }}>
        <iframe
          srcDoc={bannerHtml}
          width="728"
          height="90"
          frameBorder={0}
          scrolling="no"
          referrerPolicy="unsafe-url"
          style={{ display: 'block', maxWidth: '100%' }}
          title="쿠팡 추천 상품"
        />
      </div>
      <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0, color: '#AAAAAA', lineHeight: 1.6, textAlign: 'center' }}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
