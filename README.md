# Nanobanana Prompt Studio

세계 명화를 `인기 만화 캐릭터 + 배경` 방식으로 빠르게 재구성하는 프롬프트 생성기입니다.

## 핵심 흐름
1. 상단에 프롬프트 생성용 Gemini API 키 저장
2. 하단 이미지 생성 영역에 이미지 생성용 Gemini API 키 저장
2. 모델 선택
3. 원본 명화 선택
4. 캐릭터 선택 (`귀멸의 칼날`, `도라에몽`, `헌터헌터`, `드래곤볼`, `코난` 등)
5. 배경 선택(또는 `자동 추천`)
6. 시스템 자동 제안 확인 후 생성

## 특징
- 복잡한 편집 항목 제거, 3가지 핵심 선택 중심
- 일반인도 아는 명화/유명 그림/팝아트 목록 확장
- 캐릭터/배경 조합에 맞춘 자동 제안 문구 생성
- 랜덤 조합 버튼으로 명화/캐릭터/배경/비율/강도 다양화
- 기본 프롬프트 모델은 `gemini-3-pro`
- 이미지 생성 모델 선택 지원 (`gemini-3-pro` 기본, 실패 시 서버 fallback)
- `Nanobanana Pro 최고 해상도` 품질 지시 문구 자동 포함
- 한 줄 프롬프트 결과 + 전체 응답 확인
- Gemini 모델 목록 조회 + 자동 fallback
- API 키 로컬 저장(localStorage)

## 실행
```bash
cd /Users/JeremyLee/Downloads/세계명화Bot
npm run dev
```

브라우저: http://localhost:3000

## GitHub 업로드 및 GitHub Pages

1. 로컬에서 Git 저장소를 초기화하고 커밋합니다.
2. GitHub에 원격 저장소를 생성한 뒤 `main` 브랜치로 푸시합니다.
3. 저장소의 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
4. `.github/workflows/pages.yml`이 `public` 폴더를 정적 페이지로 배포합니다.

배포된 GitHub Pages는 정적 웹만 제공합니다. Gemini API 키와 `/api/*` 호출은 로컬 서버 또는 별도 백엔드 배포(예: Cloud Run/Render/VPS)가 필요합니다.

## 파일
- `server.js`: 정적 서버 + Gemini 프록시
- `public/index.html`: 단순화된 UI
- `public/styles.css`: 반응형 스타일
- `public/app.js`: 캐릭터/배경 자동 제안 로직 및 생성 요청
