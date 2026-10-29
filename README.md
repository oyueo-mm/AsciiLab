# AsciiLab

이미지와 영상을 문자로 다시 그리는 브라우저 기반 ASCII 아트 스튜디오.

**사이트:** https://oyueo-mm.github.io/AsciiLab/

## 실행

Node.js 22.15 이상과 npm이 필요합니다.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

개발 주소는 `http://127.0.0.1:5173/AsciiLab/`입니다.

## 기능

- **Home**: 한글 픽셀 타이틀, 실제 문자로 렌더링하는 회전 토러스. 일시정지와 운영체제의 동작 줄이기 설정 지원.
- **Image Studio**: 이미지 업로드·드래그 앤 드롭, 내장 달 샘플, 원본/ASCII/비교 보기. 밀도, 사용자 문자, 밝기, 대비, 반전, 흑백/민트/원본 색상, 배경, 글자 크기, 줄 간격 조절. PNG·TXT·HTML 내보내기.
- **Video Studio**: 로컬 영상 업로드, HTMLVideoElement + Canvas 실시간 ASCII 프리뷰, 재생/일시정지, 탐색, 음소거, FPS 제한 및 변환 설정. 현재 프레임 PNG 저장.
- **Gallery**: IndexedDB에 원본과 설정, 썸네일, 텍스트 저장. 새로고침 후 유지, 스튜디오로 다시 열기, 확인 후 삭제.
- 접이식 사이드바, 모바일 드로어, 모바일에서 접을 수 있는 설정 패널, 키보드 포커스 표시.

파일은 서버로 업로드되지 않습니다. 외부 이미지나 폰트를 요청하지 않도록 폰트와 샘플을 프로젝트에 포함했습니다.

## 구조

```text
src/
  app/                 앱 셸과 HashRouter 라우트
  components/ascii/    공유 프리뷰와 설정 패널
  components/home/     절차적으로 생성하는 ASCII 애니메이션
  pages/               Home / Image / Video / Gallery
  utils/ascii.ts       픽셀 샘플링·명암 매핑·컬러 렌더링·파일 출력
  utils/storage.ts     IndexedDB 저장소
  utils/sample.ts      외부 요청 없는 내장 달 샘플
  assets/              Neo둥근모 픽셀 폰트와 OFL 라이선스
tests/browser.mjs      실제 Edge 브라우저 통합 검증
```

Canvas로 원본을 문자 셀 해상도에 맞게 축소 샘플링하고, 알파를 적용한 RGB의 상대 밝기를 문자 세트에 매핑합니다. 셀 가로·세로 비율로 원본 종횡비를 보정합니다. 컬러 출력은 각 셀의 RGB를 유지합니다. 영상은 요청한 FPS 이내에서 현재 프레임만 변환하며, 탭이 숨겨지면 프레임 변환을 건너뜁니다.

## 검증

`npm test`는 명암, 반전, 밝기/대비 범위, 사용자 문자, 투명도, 행 구조, 색상, HTML 이스케이프를 확인합니다.

로컬 서버를 실행한 뒤 아래 명령으로 브라우저 통합 검증을 실행합니다. Windows의 설치된 Edge를 사용하며, 다른 환경에서는 Playwright 브라우저를 설치하고 `TEST_BROWSER=chromium`으로 지정할 수 있습니다.

```sh
node tests/browser.mjs
```

`TEST_URL`로 프로덕션 또는 프리뷰 URL을 지정할 수 있습니다. 테스트는 업로드·옵션 변경·다운로드·갤러리 영속성·다시 편집·삭제·실제 WebM 재생·탐색·스냅샷·390/768px 레이아웃·콘솔 오류를 검사합니다. 생성한 영상과 다운로드, 화면 캡처는 Git에서 제외된 `.qa/`에 남습니다.

## GitHub Pages

- Vite의 `base`는 `/AsciiLab/`입니다.
- `HashRouter`를 사용하므로 `#/image`, `#/video`, `#/gallery` 직접 방문 및 새로고침이 정적 호스팅에서 동작합니다.
- `.github/workflows/deploy.yml`이 `main` 푸시 때 `npm ci`, 단위 테스트, TypeScript 검사와 빌드 후 Pages에 배포합니다.
- 저장소 **Settings → Pages → Source → GitHub Actions**를 사용합니다. 초기 Pages 설정에는 저장소 관리 권한이 필요합니다.
- 저장소 이름을 변경하면 `vite.config.ts`와 `index.html`의 favicon 경로를 함께 수정하세요.

## 제한

- 영상 전체의 GIF/WebM 내보내기는 지원하지 않습니다. 현재 프레임 PNG를 사용할 수 있습니다.
- 영상 재생 가능 여부는 브라우저/운영체제 코덱에 따릅니다. H.264 MP4 또는 VP8/VP9 WebM을 권장합니다.
- 이미지는 30MB·8천만 픽셀 이내이며 편집용 원본은 긴 변 2400px, 갤러리 보관 원본은 1600px 이내로 축소합니다. 세로 문자 수는 400행까지입니다. GIF는 첫 프레임을 사용합니다.
- 갤러리는 이 브라우저에만 저장됩니다. 브라우저 데이터 삭제/저장 공간 회수 시 사라질 수 있으므로 중요한 작품은 파일로 내보내세요.
- TXT는 색상 정보가 없습니다. 색상과 배경을 보존하려면 PNG 또는 HTML을 사용하세요.

## 폰트

한글 제목은 [Neo둥근모](https://github.com/neodgm/neodgm-webfont) v1.530을 사용합니다. SIL Open Font License 1.1 전문과 저작권 고지는 `src/assets/OFL.txt`에 포함했습니다.
