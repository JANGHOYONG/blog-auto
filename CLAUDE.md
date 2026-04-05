# 시니어 건강백과 - 블로그 자동화 프로젝트

## 🏢 블로그 개발팀 (Blog Dev Team)
5명의 전문 에이전트가 병렬로 분석하고 팀장이 종합합니다.
상세 프롬프트: `.claude/skills/blog-team/`

| 에이전트 | 역할 | 호출 방법 |
|----------|------|-----------|
| 🔍 SEO | 검색 유입·키워드·색인 | "SEO 에이전트 분석해줘" |
| ✍️ 콘텐츠 | 글 품질·주제 전략·체류시간 | "콘텐츠 에이전트 분석해줘" |
| 🎨 UX | 접근성·디자인·모바일 | "UX 에이전트 분석해줘" |
| 📊 수익화 | 애드센스·제휴·유튜브 수익 | "수익화 에이전트 분석해줘" |
| 🤝 팀장 | 종합 조율·우선순위 | "블로그 팀 전체 분석해줘" |

**수익화 채널**: 애드센스(현재) → 쿠팡파트너스·유튜브 → 뉴스레터·전자책 → 강의·멤버십



## 프로젝트 개요
- **사이트명**: 시니어 건강백과 (smartinfoblog.co.kr)
- **타겟**: 50~60대 시니어 건강 정보 블로그
- **스택**: Next.js 14 App Router · Prisma ORM · Neon PostgreSQL · Vercel
- **자동화**: GitHub Actions (블로그 5개/일 · 쇼츠 1개/일 · 롱폼 1개/일)

## 핵심 아키텍처

### 자동화 파이프라인
```
[GitHub Actions 스케줄]
  09:00 KST → auto-publish.yml → 블로그 글 생성·발행
  13:00 KST → auto-publish.yml → 블로그 글 생성·발행
  17:00 KST → auto-publish.yml → 블로그 글 생성·발행
  21:00 KST → auto-publish.yml → 블로그 글 생성·발행
  01:00 KST → auto-publish.yml → 블로그 글 생성·발행

  09:30 KST → longform-auto.yml → 롱폼 유튜브 생성·업로드 (1개/일)
  10:00 KST → shorts-auto.yml  → 쇼츠 유튜브 생성·업로드 (1개/일)
```

### 워크플로우 파일
| 파일 | 역할 |
|------|------|
| `.github/workflows/auto-publish.yml` | 블로그 글 생성+발행 (5회/일) |
| `.github/workflows/shorts-auto.yml` | 쇼츠 생성+YouTube 업로드 (1회/일) |
| `.github/workflows/longform-auto.yml` | 롱폼 생성+YouTube 업로드 (1회/일) |
| `.github/workflows/collect-keywords.yml` | 키워드 수동 수집 |

### 핵심 스크립트
| 파일 | 역할 |
|------|------|
| `scripts/content-generator.js` | GPT-4o-mini로 블로그 글 생성 (Pexels 이미지 포함) |
| `scripts/publisher.js` | DRAFT → PUBLISHED 상태 전환 |
| `scripts/keyword-collector.js` | 건강 7대 주제별 키워드 수집 |
| `scripts/shorts-generator.js` | 쇼츠 영상 생성 (이미지 슬라이드 5장 × 10초) |
| `scripts/longform-generator.js` | 롱폼 영상 생성 (7챕터 × ~60초) |

## 건강 7대 주제 (네비게이션 순서 = 발행 순환 순서)
```
혈당·당뇨 → 혈압·심장 → 관절·근육 → 수면·피로
→ 뇌건강·치매 → 갱년기 → 영양·식이 → 반복
```
- `content-generator.js`의 `HEALTH_TOPICS` 배열이 이 순서를 관리
- 마지막 발행 글의 주제를 DB에서 파악 → 다음 주제 자동 선택

## 외부 API 연동
| API | 용도 | 비용 |
|-----|------|------|
| OpenAI GPT-4o-mini | 블로그 글·영상 스크립트 생성 | 유료 (저렴) |
| Google TTS `ko-KR-Standard-C` | 영상 한국어 성우 | 무료 (4M자/월) |
| Pexels Photo API | 블로그+영상 이미지 | 무료 |
| YouTube Data API v3 | 영상 업로드 | 무료 (10,000유닛/일) |
| Neon PostgreSQL | DB | 무료 티어 |

## GitHub Secrets 목록
```
DATABASE_URL           - Neon PostgreSQL 연결 문자열
OPENAI_API_KEY         - GPT-4o-mini용
GOOGLE_TTS_API_KEY     - Google Cloud TTS (AIzaSy...)
PEXELS_API_KEY         - Pexels 이미지
YOUTUBE_CLIENT_ID      - YouTube OAuth2
YOUTUBE_CLIENT_SECRET  - YouTube OAuth2
YOUTUBE_REFRESH_TOKEN  - YouTube OAuth2
NEXT_PUBLIC_SITE_URL   - https://smartinfoblog.co.kr
REVALIDATE_SECRET      - 캐시 갱신 시크릿
```

## 프론트엔드 디자인 시스템
- **색상 테마**: 메디컬 그린
  ```css
  --bg: #F2FAF7;  --primary: #1E9E7A;  --primary-dark: #177A5E;
  --text: #1B3A32; --border: #C5E8DA;  --bg-bar: #E3F4ED;
  ```
- **브랜딩**: 🏥 시니어 건강백과
- **파비콘**: `src/app/icon.tsx` (Next.js App Router 방식)

## 영상 제작 스펙
### 쇼츠 (`shorts-generator.js`)
- 해상도: 1080×1920 (세로형)
- 구성: 5슬라이드 × ~10초 = 50초 이내
- 이미지: Pexels Portrait 사진
- 오버레이: 상단 브랜드 배지 + 하단 내레이션 자막 + 진행 바
- TTS: Google TTS `ko-KR-Standard-C`, speakingRate 0.90

### 롱폼 (`longform-generator.js`)
- 해상도: 1080×1920 (세로형)
- 구성: 7챕터 × ~60초
- 챕터 구조: 훅→위험성→자가진단→해결법→함정(반전)→즉시실천→마무리
- 스크립트: 블로그 전체 내용 기반 GPT 생성
- TTS: Google TTS `ko-KR-Standard-C`, speakingRate 0.90

## 주요 해결된 이슈들
| 이슈 | 원인 | 해결책 |
|------|------|--------|
| FFmpeg 오류 234 | `-vf`와 `complexFilter` 동시 사용 불가 | fade를 complexFilter 안으로 이동 |
| GPT가 "12자"를 그대로 출력 | 프롬프트 예시에 글자수 힌트 포함 | `narration`+`imageQuery`만 요청하도록 프롬프트 단순화 |
| 영어 음성 나옴 | OpenAI `onyx` 보이스 | Google TTS `ko-KR-Standard-C`로 전환 |
| 영상 끊김 | Pexels 동영상 stream_loop 문제 | 정지 이미지 + `-loop 1 -framerate 25`로 전환 |
| 무릎 글만 계속 발행 | 키워드 우선순위 순서 | 7대 주제 엄격 로테이션 도입 |
| 블로그 이미지 없음 | Unsplash 키 미설정 | Pexels API로 전환 (기존 키 재활용) |
| 쇼츠/롱폼 동시 실행 | workflow_run 트리거 중복 | 각각 cron 스케줄로 분리 |
| YouTube 업로드 한도 초과 | API 10,000유닛/일 초과 | 쇼츠+롱폼 각 1개/일로 제한 |

## 다음 개선 예정
- [ ] 유튜브 영상 품질 개선 (논의 중)
- [ ] 경제/재테크 주제 버전 추가

---

## 🔄 새 주제로 전환하는 방법 (예: 경제/재테크)

### 1단계: 카테고리 추가 (DB)
```sql
-- Neon DB에서 실행
INSERT INTO "Category" (name, slug, description)
VALUES ('경제·재테크', 'finance', '재테크·투자·절세 정보');
```

### 2단계: content-generator.js 수정
```javascript
// SYSTEM_ROLES에 추가
finance: '10년 경력 공인 재무설계사(CFP)...',

// HEALTH_TOPICS → FINANCE_TOPICS로 별도 배열 추가
const FINANCE_TOPICS = [
  { id: 'stock',      label: '주식·ETF',    words: ['주식', 'ETF', '배당'] },
  { id: 'realestate', label: '부동산',       words: ['부동산', '아파트', '청약'] },
  { id: 'pension',    label: '연금·노후',    words: ['연금', '국민연금', '노후'] },
  { id: 'tax',        label: '절세·세금',    words: ['절세', '세금', '공제'] },
  { id: 'savings',    label: '저축·예금',    words: ['저축', '예금', '적금', '금리'] },
  { id: 'insurance',  label: '보험',         words: ['보험', '실손', '종신'] },
  { id: 'crypto',     label: '가상화폐',     words: ['비트코인', '코인', '가상화폐'] },
];
```

### 3단계: 프론트엔드 테마 변경
- `globals.css`: primary 색상 → 파란/네이비 계열
- `Header.tsx`: 브랜딩 + 네비게이션 링크 변경
- `page.tsx`: 히어로 배너 문구 변경

### 4단계: keyword-collector.js
- `HEALTH_SUBTOPICS` → `FINANCE_SUBTOPICS` 배열 추가
- `auto-publish.yml`에서 `--category=finance`로 변경

### 5단계: GitHub Secrets
- 동일한 시크릿 재사용 가능 (API 키는 같음)

---
*마지막 업데이트: 2026-04-05*
