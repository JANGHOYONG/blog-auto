import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 | Smart Info Blog',
  description: 'Smart Info Blog의 개인정보처리방침입니다.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>개인정보처리방침</h1>
      <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>최종 수정일: 2026년 4월 4일</p>

      <div className="prose-custom space-y-10">

        <section>
          <h2>1. 개인정보 수집 항목 및 목적</h2>
          <p>
            Smart Info Blog(이하 "본 사이트")는 별도의 회원가입 없이 운영되며, 이용자의 개인정보를 직접 수집하지 않습니다.
            다만, 아래의 제3자 서비스를 통해 일부 정보가 자동으로 수집될 수 있습니다.
          </p>
        </section>

        <section>
          <h2>2. 제3자 서비스 이용</h2>
          <h3>Google Analytics (구글 애널리틱스)</h3>
          <p>
            본 사이트는 방문자 통계 분석을 위해 Google Analytics를 사용합니다.
            Google Analytics는 쿠키를 사용하여 이용자의 사이트 방문 정보(접속 페이지, 체류 시간, 유입 경로 등)를 수집합니다.
            수집된 정보는 익명으로 처리되며 개인을 식별하는 데 사용되지 않습니다.
            자세한 내용은 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a>을 참고하시기 바랍니다.
          </p>
          <h3>Google AdSense (구글 애드센스)</h3>
          <p>
            본 사이트는 Google AdSense를 통해 광고를 게재합니다. Google AdSense는 이용자의 관심사에 맞는 광고를 제공하기 위해
            쿠키를 사용할 수 있습니다. 이용자는 <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>에서
            맞춤 광고를 비활성화할 수 있습니다.
          </p>
        </section>

        <section>
          <h2>3. 쿠키(Cookie) 사용</h2>
          <p>
            본 사이트는 방문자 통계 및 광고 서비스를 위해 쿠키를 사용합니다.
            쿠키는 이용자의 브라우저에 저장되는 소규모 데이터 파일로, 이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.
            단, 쿠키를 비활성화할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
          </p>
        </section>

        <section>
          <h2>4. 개인정보의 보유 및 이용 기간</h2>
          <p>
            본 사이트는 이용자의 개인정보를 직접 수집·보관하지 않습니다.
            제3자 서비스(Google Analytics, Google AdSense)를 통해 수집된 정보는 해당 서비스의 정책에 따라 관리됩니다.
          </p>
        </section>

        <section>
          <h2>5. 면책 조항</h2>
          <p>
            본 사이트에서 제공하는 정보는 일반적인 참고 목적으로만 제공되며, 의학적·법적·재정적 전문 조언을 대체하지 않습니다.
            중요한 결정을 내리기 전에 반드시 해당 분야의 전문가와 상담하시기 바랍니다.
            본 사이트는 정보의 정확성, 완전성에 대해 보증하지 않으며, 정보 이용으로 인한 손해에 대해 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2>6. 개인정보처리방침 변경</h2>
          <p>
            본 개인정보처리방침은 법령·정책 변경이나 서비스 개선을 위해 수정될 수 있습니다.
            변경 시 본 페이지에 최종 수정일을 업데이트하여 공지합니다.
          </p>
        </section>

        <section>
          <h2>7. 문의</h2>
          <p>
            개인정보처리방침에 관한 문의사항은 아래 이메일로 연락해 주시기 바랍니다.
          </p>
          <p>
            이메일: <a href="mailto:smartinfoblog@gmail.com">smartinfoblog@gmail.com</a>
          </p>
        </section>

      </div>
    </div>
  );
}
