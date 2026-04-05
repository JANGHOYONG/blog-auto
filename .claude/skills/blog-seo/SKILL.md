---
description: 블로그 사이트의 SEO와 UX를 점검합니다. 검색 노출이나 사용자 경험을 개선하고 싶을 때 사용하세요.
allowed-tools: Read, Grep, Glob
---

# 블로그 SEO & UX 점검

`src/app/`, `src/components/`를 분석해서 아래 항목을 점검하세요.

## SEO 체크
- [ ] 각 페이지 `<title>`, `<meta description>` 올바르게 생성되는가
- [ ] `og:image`, `og:title` Open Graph 태그 있는가
- [ ] 구조화 데이터(JSON-LD) Article 스키마 있는가
- [ ] 이미지에 `alt` 텍스트가 있는가
- [ ] `robots.txt`, `sitemap.xml` 생성되는가
- [ ] 내부 링크(관련 글) 연결이 잘 되는가
- [ ] URL 구조가 SEO 친화적인가 (`/health/slug` 형태)

## 시니어 UX 체크 (50~60대 타겟)
- [ ] 폰트 크기 최소 16px 이상인가
- [ ] 버튼/링크 터치 영역 44px 이상인가
- [ ] 색상 대비율 WCAG AA 기준(4.5:1) 충족하는가
- [ ] 글 목차(TOC)가 있어 긴 글 탐색이 쉬운가
- [ ] 모바일 가독성이 좋은가

## 출력 형식
**즉시 수정 가능한 것 / 중기 개선 필요한 것** 으로 나눠서 우선순위 제시
