# 인증 세션 변경 및 WEB 배포

운영 적용은 아직 하지 않았습니다. SQL은 사용자가 실행하고, DNS/HTTPS/OCI/Vercel 전환은 순서대로 진행해야 합니다.

전체 운영 절차와 SQL: [Backend 인증 전환 문서](../../Reelstamp_Backend/reelstamp-api/docs/auth/README.md)

## 기존 세션 전체 초기화

전환 SQL에서 기존 소셜·게스트 로그인 세션을 모두 삭제합니다. 계정·영상·프로젝트·결제 데이터는 유지하며 기존 게스트 세션은 복구하지 않습니다. 소셜 사용자는 다시 로그인하면 기존 계정을 이용합니다. 새 유효 게스트의 소셜 계정 전환은 유지합니다. 서버 재시작·재배포로 세션을 다시 초기화하지 않습니다.

전환 기한 안내와 API의 `legacyGuest` 필드는 제거합니다. 기존 게스트 로그인 시 데이터 소실 고지는 유지하며, 별도 재접근 불가 안내·팝업·확인창은 추가하지 않습니다. 공통 만료 안내의 동일 계정 재로그인 복구 설명은 소셜 사용자에게만 표시합니다. 기존 쿠키의 401은 정리하되 네트워크/서버 장애는 쿠키를 보존합니다.

DB 백업 → 01 사전 점검 → 같은 DB를 쓰는 구버전 Backend/쓰기 작업 모두 중지 → 02 전체 스크립트 실행 → 03으로 빈 세션 테이블/구조 확인 → 새 Backend → 새 WEB → 재로그인 검증 순서입니다. 과거 시간대 입력이나 04 정리 SQL은 필요 없습니다. DB 적용은 사용자가 직접 합니다.

## WEB 변경

- `proxy.ts`: 페이지 GET/HEAD에서만 필요 시 갱신. 브라우저 Set-Cookie와 해당 SSR 요청 Cookie를 함께 갱신. 변경 API의 쿠키 인증 요청은 출처 확인.
- `app/lib/auth`: 쿠키·갱신 통신·오류 분류·OAuth state·브라우저 알림 분리. cookie 만료는 Backend 절대 시각을 사용.
- `getServerApiClient`: 렌더링 전용, 쿠키를 변경하지 않음. `getMutableServerApiClient`: Route/Action 전용, 업무 호출 전에 갱신.
- 401 인증 오류만 세션 만료 처리. 429/5xx/네트워크 문제는 쿠키 보존. 갱신 교환은 8초 timeout과 최대 1회 재시도. 업무 요청은 네트워크 실패 후 자동 재실행하지 않음.
- 계정 설정에서 브라우저 목록/개별/전체 종료. 확인 및 서버 응답 뒤 완료 표시.
- 편집 중 인증 만료는 화면을 유지하고 새 탭 로그인을 안내. 서버에서 동일 계정을 확인할 때만 요청 재개. 편집 요청의 `X-Reelstamp-User`도 Backend가 비교하므로 탭 전환 경합으로 다른 계정에 저장되지 않음.
- OAuth state를 sessionStorage의 임의 값만으로 신뢰하지 않고, 같은 출처 POST로 준비한 10분짜리 HttpOnly 쿠키와 서버에서 비교. 카카오/네이버/구글은 provider까지 일치해야 함.
- 영상 다운로드는 caller URL을 fetch하지 않고 소유권 확인된 제작 세션의 결과 URL을 서버에서 선택.

## 설정

Vercel의 **서버 전용** `WEB_API_BASE_URL=https://api.reelstamp.co.kr`를 설정합니다. `NEXT_PUBLIC_BASE_URL`은 실제 웹 origin과 일치해야 합니다. HTTPS 준비 전에 HTTP 값을 넣어 배포하지 마세요. Production/Preview 빌드는 모두 HTTPS를 요구합니다. 운영에서는 이전 `NEXT_PUBLIC_WEB_API_BASE_URL` 대체 경로가 없습니다.

다른 설정과 소셜 provider callback은 기존 값을 유지합니다. 쿠키는 HttpOnly / Secure(운영) / SameSite=Lax / Path=/이며 Domain을 지정하지 않습니다. 서비스 토큰을 localStorage/sessionStorage/BroadcastChannel에 넣지 않습니다.

## 재현 가능한 검사

```sh
npm test
npx tsc --noEmit
WEB_API_BASE_URL=https://api.reelstamp.co.kr npm run build
node scripts/auth/http-smoke.mjs
```

마지막 검사는 운영 서버를 사용하지 않습니다. 임시 자체 서명 인증서를 만든 loopback HTTPS fixture와 빌드된 Next 서버를 각각 18443/13100에서 실행하고 종료합니다. 이 테스트 프로세스에만 인증서를 신뢰시킵니다. 운영 TLS 검증을 끄지 않습니다.

검사 범위: 실제 production Next HTTP 서버의 SSR 새 쿠키 전달, API 선갱신, 503/429 쿠키 보존, 401 제거, 재시도 상한, CSRF, 서버 응답 확인 뒤 logout. fixture는 **Backend/JWT 검증 대체가 아니며**, 그것은 별도의 Java/PostgreSQL 테스트에서 수행합니다.

실제 브라우저 자동 검증은 Browser 연결 도구 초기화(`node:process` 모듈 제한)로 실행하지 못했습니다. jsdom 화면 테스트와 HTTP 검사는 실제 브라우저 통과로 표기하지 않았습니다. 배포 전 스테이징에서 PC/모바일, 세 제공자 OAuth, 새 탭 복귀, 영상 업로드/편집/다운로드/결제/쿠폰을 직접 확인해야 합니다.

## 커밋 메시지 제안

WEB: `refactor(auth): remove legacy guest session transition handling`

Backend: `refactor(auth): reset existing sessions and remove legacy token support`

커밋은 생성하지 않았습니다.
