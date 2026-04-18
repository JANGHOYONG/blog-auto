'use client';

/**
 * 카테고리별 맞춤 쿠팡파트너스 상품 배너
 * CoupangDynamicBanner 대체 — 글 카테고리에 맞는 상품 3개 노출
 */

interface Product {
  name: string;
  url: string;
  image: string;
  price: string;
}

const ALL_PRODUCTS: Record<string, Product[]> = {
  blood_sugar: [
    { name: '와이즐리 혈당 콜레스테롤 배변 치커리 커트, 28회분', url: 'https://link.coupang.com/a/eiIcav', image: 'https://thumbnail2.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/997b/811bb1e34e08eb842c63ea7721556a2d06a8ae4baf0dcfda84dbe09d3bfd.jpg', price: '₩13,900' },
    { name: '바이탈레시피 혈당영양제 바나바잎 혈당케어', url: 'https://link.coupang.com/a/eiIwIR', image: 'https://thumbnail11.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/4aaa/275c2beb7dfb9c2f51176768b8f269085c7167bf5b0869f3c767f3459245.jpg', price: '₩6,000' },
    { name: 'JW중외제약 혈당건강 바나바정제 프로 30g, 60정', url: 'https://link.coupang.com/a/eiIyJ0', image: 'https://thumbnail1.coupangcdn.com/thumbnails/remote/212x212ex/image/retail/images/11a34274-0a53-4a18-acb1-161d4171f3c314932544700882900277.png', price: '₩22,500' },
  ],
  blood_pressure: [
    { name: '나우케어 혈압스타 코큐텐 마그네슘 홍국 코엔자임Q10', url: 'https://link.coupang.com/a/eiIQS9', image: 'https://t1a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/image_audit/prod/b21cf7f5-caa3-42c2-8225-124da019f466_fixing_v2.png', price: '₩55,230' },
    { name: '뉴트리바이옴 혈관건강 써큐프로', url: 'https://link.coupang.com/a/eiIRn7', image: 'https://thumbnail3.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/83f8/126e876611f433ab202a742af50474d163dfbce0d50784293475fee80c2f.jpg', price: '₩18,040' },
    { name: '닥터포틴 나토레드 영양제', url: 'https://link.coupang.com/a/ekMdpI', image: 'https://t4a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/2e6d/24b4c32e9f7330a69290eba1b92596ce7bc1bc197ace2362bcdcc093799a.png', price: '₩34,580' },
  ],
  joint: [
    { name: '프로바이오 관절연골 60정 2개', url: 'https://link.coupang.com/a/ekMfMm', image: 'https://thumbnail7.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/d40b/8b3caf67a763a84c454714af6b93cc2acf09cc7394a0c2214b209025b31a.jpg', price: '₩67,120' },
    { name: '김연자 관절보궁', url: 'https://link.coupang.com/a/ekMhdO', image: 'https://t5a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/b30e/6aa03c57b5f7359a7c1f00052e611ab340f9a40fa4f2f86c0c30f395c523.png', price: '₩29,800' },
    { name: '관절엔 콘드로이친 3개월분', url: 'https://link.coupang.com/a/ekMo2k', image: 'https://t3c.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/719c/75ce79f1a9ae6fc3a6a4f2989c9950720d23ce7be858780ddb3b782cb3ba.png', price: '₩172,260' },
  ],
  sleep: [
    { name: '뉴트리케이 수면 영양제', url: 'https://link.coupang.com/a/eiJkum', image: 'https://thumbnail15.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/aa35/2dbebe4dd0fcd8bac04dcdcb1be1a3aadfffe19173dc5eea9301e80c2c85.png', price: '₩18,900' },
    { name: '위드슬립 수면 영양제', url: 'https://link.coupang.com/a/eiJk6c', image: 'https://t3a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/8f76/bc65eef42afbb89c4572562765ea11281a461a550bc84c0cf0d13d40d664.jpg', price: '₩12,900' },
    { name: '수면 귀마개', url: 'https://link.coupang.com/a/eiJl49', image: 'https://thumbnail3.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/image_audit/prod/97af40b2-6a44-4bfc-8cde-f829238708bd_fixing_v2.png', price: '₩16,900' },
  ],
  brain: [
    { name: '뉴트리케이 두뇌 영양제', url: 'https://link.coupang.com/a/ekMDfH', image: 'https://thumbnail14.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/c799/1f31361cdaff0dc824dc44751108614a1923b5ad437776c57995e593c934.png', price: '₩170,100' },
    { name: '두뇌 하이루틴', url: 'https://link.coupang.com/a/ekMEW3', image: 'https://t1a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/image_audit/stage/manual/ee4798623e2bc22c9ca934d5d5a7b4cd3559192c5467927184cce5c38e33_1774868029163.png', price: '₩8,540' },
    { name: '포스파티딜세린 영양제', url: 'https://link.coupang.com/a/ekMF0V', image: 'https://t4a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/ceaa/14cf066280c5c43cc08e466c7f6b28543d414ebd9322fb9cf6a28f1318ad.png', price: '₩12,700' },
  ],
  menopause: [
    { name: '르시크릿 갱년기 영양제', url: 'https://link.coupang.com/a/eiJAps', image: 'https://thumbnail7.coupangcdn.com/thumbnails/remote/212x212ex/image/retail/images/67632237991394-5edc1b2b-fbde-4e62-b5b1-e9847626041c.jpg', price: '₩60,480' },
    { name: '이알하나 갱년기 영양제', url: 'https://link.coupang.com/a/eiJA2M', image: 'https://t4c.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/b21a/89013a6c115a7b66236ab460058d7aced72b90677f170410322064d855d1.jpg', price: '₩30,000' },
    { name: '자생앤 갱년기 영양제', url: 'https://link.coupang.com/a/eiJBAf', image: 'https://thumbnail2.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/e986/53c218fa2dbbef7019dde449f145f989507010f79801619cc13cdd9d301f.jpg', price: '₩21,700' },
  ],
  nutrition: [
    { name: '조선비책 조선황림 눈건강', url: 'https://link.coupang.com/a/ekM8Da', image: 'https://t2a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/9ccc/e5e5714761f0afb6dc07db4e91010f3da398b3f0c7034a29ced2ff507bf1.jpg', price: '₩98,000' },
    { name: '뉴트리정 프리미엄 눈건강', url: 'https://link.coupang.com/a/ekM90T', image: 'https://t1a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/4337/f4b90edd465b0ea6d3e162de6eaa32f7fa308ddf3195873024b44afa4bb7.png', price: '₩19,900' },
    { name: '바디바이블 식물성 영양제', url: 'https://link.coupang.com/a/ekNbTg', image: 'https://thumbnail15.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/869a/e05a196afd38622162cb0d568c195fae69ed869af48db164556d56d9cf0e.jpg', price: '₩13,980' },
  ],
  knowledge: [
    { name: '조선비책 조선황림 눈건강', url: 'https://link.coupang.com/a/ekM8Da', image: 'https://t2a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/9ccc/e5e5714761f0afb6dc07db4e91010f3da398b3f0c7034a29ced2ff507bf1.jpg', price: '₩98,000' },
    { name: '뉴트리정 프리미엄 눈건강', url: 'https://link.coupang.com/a/ekM90T', image: 'https://t1a.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/4337/f4b90edd465b0ea6d3e162de6eaa32f7fa308ddf3195873024b44afa4bb7.png', price: '₩19,900' },
    { name: '바디바이블 식물성 영양제', url: 'https://link.coupang.com/a/ekNbTg', image: 'https://thumbnail15.coupangcdn.com/thumbnails/remote/212x212ex/image/vendor_inventory/869a/e05a196afd38622162cb0d568c195fae69ed869af48db164556d56d9cf0e.jpg', price: '₩13,980' },
  ],
};

// 기본값 (health 또는 매핑 없는 카테고리)
const DEFAULT_PRODUCTS: Product[] = ALL_PRODUCTS.blood_sugar;

export default function CoupangCategoryBanner({ categorySlug }: { categorySlug: string }) {
  const products = ALL_PRODUCTS[categorySlug] ?? DEFAULT_PRODUCTS;

  return (
    <div style={{ margin: '2rem 0' }}>
      {/* 헤더 */}
      <div style={{
        background: 'linear-gradient(90deg, #1E9E7A 0%, #158060 100%)',
        borderRadius: '12px 12px 0 0',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>🛒 관련 상품 추천</span>
        <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>🔥 오늘의 특가</span>
      </div>

      {/* 상품 3개 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1px',
        background: 'var(--border)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 12px 12px',
        overflow: 'hidden',
      }}>
        {products.map((p, i) => (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener sponsored"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '12px 8px',
              background: 'var(--bg)',
              textDecoration: 'none',
              gap: '6px',
            }}
          >
            <img
              src={p.image}
              alt={p.name}
              style={{
                width: '72px',
                height: '72px',
                objectFit: 'contain',
                borderRadius: '8px',
                background: '#fff',
                border: '1px solid var(--border)',
              }}
            />
            <p style={{
              fontSize: '11px',
              color: 'var(--text)',
              textAlign: 'center',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              margin: 0,
              fontWeight: 500,
            }}>
              {p.name}
            </p>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#E53E3E', margin: 0 }}>
              {p.price}
            </p>
            <span style={{
              fontSize: '11px',
              background: 'linear-gradient(90deg, #1E9E7A, #158060)',
              color: '#fff',
              borderRadius: '20px',
              padding: '3px 10px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              바로가기 →
            </span>
          </a>
        ))}
      </div>

      <p style={{ fontSize: '10px', color: '#AAAAAA', textAlign: 'center', marginTop: '6px', lineHeight: 1.5 }}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
