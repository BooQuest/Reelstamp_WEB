# Gallery-only reels maker

## Responsibilities

- `gallery/GalleryMaker.tsx` coordinates the empty-cut import action, preview, text gestures and controls. `CutStrip` keeps cut navigation in place; there is no web source list.
- `useSingleMediaPicker` opens a single-file device picker synchronously from the click, captures the session/clip/index destination, and handles cancellation and validation. `GalleryMaker.openPicker` lets guide actions use the same synchronous path without effects.
- `useGalleryWorkspace` prepares the explicitly targeted source and coordinates conversion, uploads and atomic server state application. `useMediaSources` owns temporary editing URLs and session-local file-to-asset associations. Uploaded originals are reused by ID without retaining a visible list or unused local files.
- `MediaEditModal`, `SegmentTimeline`, `useCropGesture` and `geometry` own temporary length/crop editing. Crops are normalized source coordinates: the same rectangle positions the editor preview and feeds `drawImage` during export. Cancel does not change the clip.
- `useEditorHistory` holds the last 10 project-wide edits. Snapshots contain revision IDs and caption data, never copied blobs. Undo/redo applies existing revisions; it does not convert or upload again. Leaving this screen discards history, not saved media.
- `useDraftAutosave.serializeEdit` serializes draft saves and edit-state requests against `draftVersion`. It flushes pending project metadata before an edit, then synchronizes caption refs before releasing the queue. A version conflict requires reload; no forced overwrite is attempted.
- `CaptionToolbar` changes V2 font, color, preset, alignment and background settings. Its buttons preserve textarea focus. Mobile positioning follows the visual viewport; desktop tools sit below the preview. Caption gestures use pinch or Alt/Option + wheel.
- `utils/media` continues to own browser conversion and media-resource cleanup. Local URLs are released by their owner, not by history snapshots.

## Direct selection flow

- Empty cut click (including the active empty cut), import, replacement, and the per-cut guide action open the device picker immediately. One image or video opens the existing length/segment/crop editor directly.
- Closing the initial overview, restoring a project, and undoing to an empty cut never open the picker automatically. The empty cut shows `사진·영상 불러오기`.
- Selecting an existing cut shows its preview. Cancelling the picker/editor preserves that cut; conversion/upload failure preserves its media and history. Successful apply stays on the same cut.
- Fixed cuts keep their existing preview/retry behavior and cannot select a file. Original re-edit remains available through `길이 다듬기` on normal registered cuts.
- The picker appearance belongs to the OS/browser. Cut navigation remains on the web page, outside the picker. Android/iOS picker return behavior requires device verification.
- The former `GalleryList` and `useGalleryLibrary` were removed along with list-only state and tests. Original/revision APIs, retention and deployment requirements below are unchanged by this input-flow update.

## Camera preservation

The existing camera hooks, camera-only components and their tests remain in the repository for future camera integration. The gallery page does not mount them or request camera/microphone permission. The superseded single-file gallery hook, old trim hook/layout/modal and their implementation-specific tests were removed. Their current behaviors are covered by the new gallery, editor and page tests. Camera-specific components and the common clip library remain preserved. `MediaRecorder` is still required for file conversion and must not be removed as camera-only code.

To reintroduce capture, connect a separately enabled capture entry point to the source/revision upload protocol. Do not reinstate automatic camera startup in gallery selection, restoration, or error recovery.

## Persistence and compatibility

New source assets and output revisions use additive APIs under a session. Preparing/completing an upload does not activate it. `PUT edit-state` commits clip references and caption data together using the draft version. Only successful application creates a history step and replaces the visible cut.

An older project has no original before its saved output. On first re-edit/replacement, `revisions/adopt-legacy` attaches that output as its source under a version check. Already removed frames cannot be recovered. Failed/cancelled replacement preserves the previous revision. Persisted sources are accessed through the applied revision when re-editing; they are not displayed as a gallery.

A selected file is temporary until applied. Its editing URL is released on cancel, success, preparation failure, or screen exit; URLs owned by the clip preview are unaffected. Previously applied sources remain available until project retention/cleanup. Successful production is followed by server cleanup of unused originals/versions; current clip outputs and the final video remain.

## Deployment and verification

1. User applies `Reelstamp_Backend/reelstamp-api/docs/reels-maker-gallery-migration.sql` and its verification queries. No migration is automatically executed by WEB.
2. Deploy compatible Backend and AI, including the bundled fonts. Configure server-side OCI deletion credentials as described in the Backend gallery document.
3. Deploy WEB. Current PAR upload/read configuration must remain valid; PAR rotation is outside this feature.
4. In the development environment, verify original re-edit after re-login, failed replacement, media/text undo, fixed cuts, automatic captions and final download. Then perform the normal release check in the target environment.

Automated tests mock storage/API boundaries. Local browser checks use a mock server contract and actual browser media conversion. They do not validate deployed authentication, real OCI permissions, Android Chrome, or iOS Safari. Device keyboard, pinch, supported codecs and actual server round trips require those environments.

## Duration and cancellation

Browser MediaRecorder may include startup padding even when a 0.1-second segment was requested. The preview stops at the selected duration. Backend supplies `targetDurationSeconds` only for newly generated gallery revision outputs, and AI trims/pads video and audio to that duration before concatenation. Old saved clips and fixed-template clips keep their prior duration behavior. This avoids silently changing the user's chosen length.

Conversion and uploads can be cancelled before atomic state application starts. Cancellation leaves the existing cut intact; any abandoned upload is reclaimed by project cleanup. Once the atomic apply request begins, cancel is disabled until its outcome is known. A session switch invalidates queued client updates.

## Initial gallery implementation verification (2026-10-06)

- WEB: 36 test files / 199 tests passed; TypeScript and production build passed. ESLint on all changed TS/JS files passed. Full repository lint still reports 18 existing errors and 18 warnings in unchanged code.
- Backend: 55 tests passed, 28 skipped, and bootJar succeeded with the DB-dependent application-context test excluded. The full-suite context test failed schema validation against the pre-migration database; it must be rerun after the user applies the SQL.
- AI: 26 tests passed, including actual FFmpeg normalization/concatenation. A separate Korean two-font sample with alignment, shadow and translucent backgrounds rendered at 1080×1920 with H.264/AAC and 0.4-second video/audio streams.
- Isolated desktop/mobile-viewport browser smoke checks exercised actual video/photo conversion and the mocked upload/apply/text/undo flow. These checks do not replace Android/iOS hardware or a real storage/server integration test.
- Source binaries and font licenses match between WEB and AI. No DB migration, commit, push, merge or deployment was performed.

## Direct picker update verification (2026-10-06)

- WEB: 37 test files / 208 tests passed. TypeScript, ESLint for the gallery area and changed page/tests, and the production build passed.
- Integration tests cover direct image/video editing, empty/registered/fixed cut navigation, synchronous guide selection, picker/edit cancellation, decode/upload failure, source re-edit, undo/redo and existing final production flow. Picker tests verify destination capture, same-file reselection, invalid files and stale-session selection; source tests verify asset reuse and URL cleanup.
- Isolated Chromium checks received an actual single-file chooser event and converted both a video and a photo. The mocked upload/apply flow, text edit and undo passed at desktop/mobile viewport sizes. Empty-cut and replacement selection/cancel were also checked. The API/storage boundaries were mocked; no real storage or production data was changed.
- Android Chrome and iOS Safari hardware were not accessible. Native picker presentation/return behavior on those devices remains unverified.
- Only WEB changed for this update. Overview bottom padding remains `pb-8`; Backend, AI, API contracts, DB and original retention are unchanged. No commit, push, merge or deployment was performed.
