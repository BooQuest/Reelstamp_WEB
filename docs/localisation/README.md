# 한국어·영어 전환 운영 안내

## 설정과 공개

WEB 서버 환경변수 `REELSTAMP_ENGLISH_ENABLED=true`일 때 영어 선택기를 표시합니다. 생략하거나 false이면 한국어만 제공하며, 영어 쿠키로도 영어 화면을 활성화할 수 없습니다. Backend에도 같은 설정을 적용해야 합니다. 개발 환경에서만 먼저 활성화하세요. 실제 영어 템플릿은 이번 변경에 포함하지 않았습니다.

기존 URL은 유지됩니다. `reelstamp_locale` 쿠키는 1년 동안 유효하며, 서버 첫 렌더링과 클라이언트가 같은 언어를 사용합니다. 언어를 바꾸면 Next.js 서버 컴포넌트를 갱신하지만 인증·캐시·편집기 Provider는 재생성하지 않습니다. 계정이나 다른 기기로 설정을 동기화하지 않습니다.

운영 적용 순서는 다음과 같습니다.

1. Backend의 `reelstamp-api/docs/localisation/01-preflight.sql` 결과를 확인합니다.
2. 사용자가 `02-migrate.sql`을 실행한 뒤 `03-verify.sql`로 확인합니다.
3. 영어 비활성 상태로 Backend, WEB 순서로 배포합니다.
4. 검토한 영어 템플릿 3개와 영어 자산을 등록하고 개발 환경에서 검증합니다.
5. Backend, WEB의 영어 설정을 활성화하고 서비스를 재시작합니다.

비활성으로 되돌리면 신규 영어 조회·제작을 차단합니다. 이미 만든 영어 프로젝트는 소유자 전용 API와 저장된 contentLocale로 계속 재개할 수 있습니다. DB 테이블이나 한국어 원본을 삭제하는 롤백은 필요하지 않습니다.

## 언어별 템플릿 등록 원칙

한국어도 영어와 마찬가지로 해당 locale의 번역 행이 있어야 표시됩니다. 공통 테이블의 제목 언어로 노출을 판단하거나 번역이 없는 문구를 대체하지 않습니다. A·B·C의 ko와 A·D의 en이 공개되어 있다면 한국어는 A·B·C, 영어는 A·D만 표시됩니다. 필요한 컷 번역과 기존 공개 조건도 충족해야 합니다.

최초 DB 마이그레이션은 기존 한국어 콘텐츠를 한 번 복사하고 완료 이력을 기록합니다. 이후 새 템플릿은 공통 구조와 지원할 언어의 번역을 함께 명시적으로 등록합니다. 영어 전용 템플릿에 ko 행을 만들 필요가 없으며, 마이그레이션을 다시 실행해도 ko가 자동 생성되지 않습니다. 한국어의 미연결 트렌드 제작 요청 카드는 유지됩니다.

아래 도구는 기존 한국어 콘텐츠의 영어판을 만드는 용도입니다. 공통 구조 생성 및 영어 전용 템플릿의 최초 등록은 별도 등록 SQL로 처리하며, 해당 Backend 안내를 따릅니다.

## 번역 데이터 준비

입력 예제는 `scripts/localisation/example.bundle.json`, 재사용할 번역 지침은 `scripts/localisation/TRANSLATION.md`입니다. 예제 ID는 테스트 전용이며 운영 등록용이 아닙니다. DB에 있는 실제 ID와 최신 한국어 텍스트·컷 구조·자산을 source에 넣습니다. source를 임의로 영어 데이터에 맞춰 수정하면 안 됩니다.

```sh
# 최신 한국어 source의 지문을 확인해 translation.sourceHash에 기록
node scripts/localisation/template-tool.mjs input.json --fingerprint

# 필수 텍스트·컷 대응·구조·변수·줄바꿈·자산 URL·미번역 문구 검증
node scripts/localisation/template-tool.mjs input.json --out /tmp/reelstamp-translation-review
```

출력물:

- `review.json`: 한영 비교, 컷 ID, sourceHash, 자산 및 검토 상태.
- `register-draft.sql`: 영어 비공개 초안을 등록하는 트랜잭션. 공통 템플릿·컷·한국어 데이터는 수정하지 않습니다. 같은 ID를 다시 등록해도 중복하지 않으며 재등록하면 비공개 상태가 됩니다.
- `publish.sql`: `--publish`를 명시한 경우에만 생성됩니다. 이전 공개 파일은 새 초안 생성 시 제거됩니다.

한국어 source가 바뀌면 sourceHash가 달라져 검증이 실패합니다. 기존 review.json의 hash와 비교하고 번역을 다시 검토한 후 갱신합니다. 자산 URL 검증은 형식만 확인합니다. 영상·이미지 속 한국어, 자막, 소리, 썸네일은 개발 환경에서 직접 검토하세요. 언어 중립 자산도 번역 쪽에 동일 URL을 명시해야 합니다.

번역과 자산 검토가 끝나면 translation.review.translation 및 assets를 true로 설정합니다.

```sh
node scripts/localisation/template-tool.mjs input.json --out /tmp/reelstamp-translation-reviewed --publish
```

사용자가 검토된 `register-draft.sql`을 실행하고 개발 환경에서 확인한 뒤 `publish.sql`을 실행합니다. 공개 SQL은 등록된 텍스트·자산·컷·예시가 검토 파일과 일치하는지 다시 검사하며, 이전 파일로 다른 초안을 공개하려 하면 실패합니다. 카테고리 번역은 공통 카테고리 ID별로 공유되므로 다른 템플릿의 번역과 표현을 통일하세요.

도구는 로컬 JSON을 읽고 파일만 생성합니다. AI API나 DB 연결은 하지 않습니다.

## 코드 유지보수

- UI 번역: `app/i18n/messages/{ko,en}` 기능별 파일, source→key 매핑은 `sources.json`.
- `useUiText()` / 서버의 `getUiText()`는 미리 작성한 카탈로그를 조회합니다. 한국어 UI 원문을 입력으로 받으며 실시간 기계번역을 하지 않습니다. 동적 UI에는 `t.format(source, values)`를 우선 사용합니다.
- 사용자 프로젝트명·직접 쓴 자막·템플릿 DB 콘텐츠는 `t()`에 넣지 않습니다. 템플릿은 API가 요청 언어로 반환합니다.
- 언어별 목록은 locale이 포함된 요청과 effect 의존성을 사용하며 이전 요청은 무효화합니다. 새 React Query 조회를 추가할 때도 locale을 queryKey에 넣으세요.
- 제작 언어는 `ProjectContentContext`가 최초 요청에서 고정합니다. UI locale을 편집기 key나 세션 생성 재실행 조건으로 사용하면 안 됩니다.
- 영어 온보딩은 HTML 안내입니다. 한국어 이미지와 기존 자동 자막 비활성 설정은 유지합니다.
- 표시 날짜는 기존 시간대 정책을 유지합니다. 원화 가격·결제 금액은 환산하지 않습니다.

검증 명령: `npm test`, `npm run test:localisation`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. 실행 중인 개발 서버와 겹치면 `REELSTAMP_BUILD_DIR=.next/localisation-build`로 빌드 산출물을 분리할 수 있습니다.

이번 구현의 실행 결과와 미실행 항목은 [검증 기록](./VALIDATION.md)에 정리했습니다.
