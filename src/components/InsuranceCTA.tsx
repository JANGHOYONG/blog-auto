/**
 * 보험·건강검진 제휴 CTA 컴포넌트
 * - 텐핑(tenping.kr) 또는 링크프라이스(linkprice.com) 제휴 링크 삽입
 * - 환경변수: NEXT_PUBLIC_INSURANCE_LINK (제휴 링크 URL)
 *             NEXT_PUBLIC_HEALTH_CHECK_LINK (건강검진 제휴 링크 URL)
 * - 링크가 없으면 null 반환
 */

interface Props {
  type?: 'insurance' | 'healthcheck' | 'both';
  topicId?: string;
}

// 주제별 CTA 문구
const TOPIC_CTA: Record<string, { insurance: string; check: string }> = {
  blood_sugar:    { insurance: '당뇨·합병증 대비 건강보험 무료 비교', check: '당뇨 합병증 조기 발견 건강검진 알아보기' },
  blood_pressure: { insurance: '고혈압·심혈관 대비 건강보험 무료 비교', check: '심혈관 위험도 측정 건강검진 알아보기' },
  joint:          { insurance: '관절·근골격 수술비 대비 보험 무료 비교', check: '관절 건강 정밀 검진 알아보기' },
  brain:          { insurance: '치매·뇌졸중 대비 건강보험 무료 비교', check: '뇌 건강 정밀 MRI 검진 알아보기' },
  menopause:      { insurance: '갱년기·여성암 대비 건강보험 무료 비교', check: '여성 갱년기 호르몬 검사 알아보기' },
  default:        { insurance: '내 나이·상태 맞춤 건강보험 무료 비교', check: '종합건강검진 패키지 비교하기' },
};

export default function InsuranceCTA({ type = 'both', topicId = 'default' }: Props) {
  const insuranceLink = process.env.NEXT_PUBLIC_INSURANCE_LINK || '';
  const healthCheckLink = process.env.NEXT_PUBLIC_HEALTH_CHECK_LINK || '';

  const cta = TOPIC_CTA[topicId] || TOPIC_CTA.default;

  const showInsurance = (type === 'insurance' || type === 'both') && insuranceLink;
  const showCheck = (type === 'healthcheck' || type === 'both') && healthCheckLink;

  if (!showInsurance && !showCheck) return null;

  return (
    <div
      style={{
        margin: '2rem 0',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        border: '1.5px solid #86efac',
        borderRadius: '12px',
      }}
    >
      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#166534', marginBottom: '0.75rem' }}>
        📋 이 글을 읽으셨다면 확인해보세요
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {showInsurance && (
          <a
            href={insuranceLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.875rem 1.25rem',
              background: '#ffffff',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              textDecoration: 'none',
              color: '#15803d',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <span>{cta.insurance}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>→</span>
          </a>
        )}
        {showCheck && (
          <a
            href={healthCheckLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.875rem 1.25rem',
              background: '#ffffff',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              textDecoration: 'none',
              color: '#15803d',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🏥</span>
            <span>{cta.check}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>→</span>
          </a>
        )}
      </div>
      <p style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.75rem', marginBottom: 0 }}>
        * 파트너 링크를 통한 가입·신청 시 소정의 수수료가 발생할 수 있습니다.
      </p>
    </div>
  );
}
