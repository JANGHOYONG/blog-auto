---
description: GitHub Actions 워크플로우 상태와 자동화 파이프라인을 점검합니다. 영상/블로그가 안 올라올 때 사용하세요.
allowed-tools: Read, Glob
---

# 자동화 파이프라인 점검

`.github/workflows/`와 `scripts/`를 분석해서 아래를 점검하세요.

## 워크플로우 점검
- `auto-publish.yml`: cron 시간, env 시크릿 누락 여부
- `shorts-auto.yml`: 트리거 조건, GOOGLE_TTS_API_KEY 포함 여부
- `longform-auto.yml`: 트리거 조건, 타임아웃 설정

## 스크립트 점검
- DB 쿼리에서 `shortsGenerated: false` / `longformGenerated: false` 조건 확인
- YouTube 업로드 쿼터 관련 에러 처리 있는가
- Google TTS API 호출 실패 시 fallback 처리 있는가

## 자주 발생하는 문제
1. **"쇼츠를 만들 글이 없습니다"** → 모든 글이 이미 처리됨 (정상)
2. **YouTube 업로드 한도 초과** → API 쿼터 10,000유닛/일 초과 (오후 4~5시 리셋)
3. **GOOGLE_TTS_API_KEY 없음** → GitHub Secrets 확인
4. **FFmpeg 오류** → complexFilter와 -vf 동시 사용 금지

## 출력 형식
발견된 문제와 해결 방법을 바로 실행 가능한 형태로 제시
