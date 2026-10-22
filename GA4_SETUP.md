# Google Analytics 4 연동

## 측정 대상과 태그

현재 측정 ID는 **`G-8YXS25H07Z`**입니다.
`app/lib/analytics-config.ts`에서 한 번 정의하며, 루트 레이아웃의 `<head>`에
`GoogleTag`를 넣어 모든 페이지에서 Google tag를 로드합니다.
초기화 스크립트가 `dataLayer`와 `gtag`를 먼저 준비하므로 외부 스크립트가
다운로드되는 동안 발생한 이벤트도 큐에 보관됩니다.

이전 `@next/third-parties` 태그는 제거했습니다. 과거 Vercel 설정이 다른
속성으로 보내는 일을 막기 위해 `NEXT_PUBLIC_GA_MEASUREMENT_ID`는 더 이상
사용하지 않습니다. 해당 환경변수가 남아 있어도 현재 태그의 목적지는 바뀌지 않습니다.
측정 ID는 공개 식별자이며 Google 로그인용 Client ID/Secret과는 무관합니다.
개발·Preview에서도 동일한 태그가 로드되므로 실제 계측 테스트는 GA DebugView로 구분합니다.

## 이벤트 정의

| 이벤트 | 전송 시점 | 파라미터 |
|---|---|---|
| `template_start` | 오늘의 템플릿 또는 전체/저장 템플릿의 만들기 버튼 클릭. 로그인·이용권 안내로 이동하는 클릭도 포함. 준비 중/비활성 버튼은 제외 | `template_id`, `template_name` |
| `direct_camera` | 기존 카메라 훅에서 녹화가 실제 시작된 직후 | `template_id` |
| `media_upload` | 선택한 사진·영상 원본의 업로드 및 서버 등록 성공. 실패·취소·기존 원본 재사용은 제외 | `template_id`, `media_type` (`image` 또는 `video`) |
| `edit_start` | 제작 세션 로딩 후 갤러리 편집 화면 진입. 저장된 편집 프로젝트 재진입도 포함 | `template_id` |
| `edit_complete` | 처리 중인 영상이 `COMPLETED` 상태와 결과 URL을 반환할 때. 기존 완성 영상 열기는 제외 | `template_id` |
| `download_click` | 완성 영상 다운로드 실행. BGM 안내에서 다운로드하는 경우도 포함 | `template_id` |
| `instagram_share_click` | 인스타그램 공유 버튼 클릭. PC/미지원 안내나 공유 취소도 클릭으로 집계 | `template_id` |

현재 웹은 갤러리 전용 제작 화면이며 직접 촬영 UI는 연결되어 있지 않습니다.
따라서 `direct_camera`는 현재 사용자 흐름에서는 발생하지 않습니다.
카메라 훅을 다시 연결할 때 필수 `templateId`를 전달하면 계측됩니다.
공유 클릭 이벤트는 Instagram 게시 성공을 의미하지 않습니다.

모든 이벤트는 `app/lib/analytics.ts`의 타입이 지정된 `trackReelsEvent`를 사용하며,
`send_to`로 동일한 측정 ID를 지정합니다. 파일명·미디어 URL·이메일·OAuth 토큰은
커스텀 이벤트 파라미터에 넣지 않습니다. 태그 차단/실패는 제작 동작을 중단하지 않습니다.

## GA 콘솔에서 설정할 항목

1. GA4의 웹 데이터 스트림 측정 ID가 `G-8YXS25H07Z`인지 확인합니다.
2. 웹 스트림의 향상된 측정 → 페이지 조회에서 브라우저 기록 변경에 따른 페이지 조회를
   켭니다. Next.js 화면 전환은 이 기능으로 측정하며 수동 페이지뷰를 추가하지 않습니다.
3. 관리 → 맞춤 정의에서 아래 **이벤트 범위 맞춤 측정기준**을 등록합니다.
   - `template_id`
   - `template_name`
   - `media_type`
4. 필요하면 `edit_complete`를 주요 이벤트로 지정합니다.

위 콘솔 설정은 코드 배포와 별개입니다. 저장소 변경만으로 GA 계정 설정이 바뀌지는 않습니다.

## 배포 및 확인

1. WEB 변경본을 Vercel에 배포합니다. 별도 GA 시크릿이나 환경변수 추가는 필요 없습니다.
2. Google Tag Assistant 또는 Google Analytics Debugger로 테스트 브라우저의 디버그 모드를 활성화합니다.
3. GA 실시간 보고서/DebugView에서 페이지 조회와 다음 흐름을 확인합니다.
   - 템플릿 만들기 → `template_start`
   - 편집기 진입 → `edit_start`
   - 사진/영상 각각 업로드 성공 → `media_upload` 및 `media_type`
   - 완료 → 영상 생성 성공 후 `edit_complete`
   - 다운로드/공유 클릭 → 각 클릭 이벤트
4. 파일 선택 취소, 업로드 실패, 고정 컷 자동 로딩, 기존 완성 영상 재열기에서
   업로드·편집 완료 이벤트가 잘못 추가되지 않는지 확인합니다.
5. 같은 페이지에 Google tag를 추가로 붙이거나 GTM에서 동일 이벤트를 재설정하지 않습니다.

광고 차단이나 브라우저 추적 방지로 GA 요청이 차단되면 실제 수집은 누락될 수 있습니다.

공식 문서:
- [Google tag 이벤트 전송](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [이벤트 파라미터와 맞춤 측정기준](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)
- [Next.js의 페이지뷰 추적 안내](https://nextjs.org/docs/app/guides/third-party-libraries#tracking-pageviews)
