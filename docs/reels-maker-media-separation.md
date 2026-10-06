# Reels maker media boundaries

Historical record of the camera/gallery separation refactor. The subsequent gallery-only feature supersedes this page’s UI and file map; see [the current gallery architecture](reels-maker-gallery-only.md). Removed gallery/trim modules remain available in Git history.

This refactor preserves the camera and gallery UI, browser encoding settings, and the existing upload/processing API. It changes only WEB. Backend, AI, and the database schema are unchanged.

## Ownership and dependency direction

- `useCameraCapture` owns recording and its timers. Its internal `useCameraStream` owns camera requests, stream switching, diagnostics, and stream disposal.
- `useGalleryImport` owns the native/fallback file picker and image conversion. It receives callbacks for pausing capture, opening video trimming, and submitting prepared media; it does not import camera code.
- `useVideoTrim` owns video preparation, selection, playback, pointer events, and conversion. `useTrimPreviewLayout` owns viewport measurement and resize subscriptions.
- `useClipLibrary` owns clip previews, source markers, upload state, fixed media, reset, restoration, and replacement. Its save operation returns the server snapshot, clip ID, and next incomplete cut index.
- `services/clipUpload` retains the presign → PUT → upload-complete sequence. It does not own React state.
- `utils/media` contains browser media primitives shared by the input paths. `MediaRecorder` remains necessary for gallery video trimming and image-to-video conversion even if camera capture is later disabled.
- The page coordinates these modules and the existing draft, caption, and final-processing flows. It clears input errors and opens the next guide after a successful save.

Both input paths submit `PreparedClip { blob, mimeType, duration }` with the target cut index and `ClipSource`. Source markers remain client-only; restored sessions retain the existing unknown-source behavior. Camera duration metadata still uses the current template duration, as before this refactor.

A replacement is committed locally only after upload completion succeeds. Failed replacement keeps the previous clip and completion state; failed poster generation does not block upload. Fixed clips are not sent through the upload flow.

Each owner releases its own URLs, event listeners, timers, and streams. Reset/unmount invalidates pending work, and cancellation prevents late results from modifying a newer operation. Aborting a client request does not roll back an upload already accepted by the server.

## Future camera disablement

No camera feature flag or gallery-only UI is introduced here. A later change can disable the camera's `previewActive` condition and remove camera entry points from the page while continuing to use gallery, trimming, shared media tools, and the clip library. All camera initialization and recording entry points must be covered; hiding a button alone is insufficient. Native-app reuse depends on the app's media interfaces; browser-specific capture is not assumed to be portable.

## Verification

Automated coverage includes the production page's controls and hooks with mocked browser media boundaries and HTTP responses, the actual upload protocol, replacement failure, fixed-cut progression, project restoration, picker cancellation, recording timing, and media cleanup. Existing UI render markup is retained.

Commands:

```sh
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Before refactoring, the whole WEB suite had 141 passing tests and type checking passed. Repository lint already reported 18 errors and 21 warnings; unrelated violations are not part of this refactor.

Physical-device validation is separate from jsdom tests. Desktop Chrome, Android Chrome, and iOS Safari still need camera/microphone permission, front/rear switching, recording audio/video, native/fallback file selection, video trim, and mixed camera/video/image/fixed-cut production checked in a test environment. Real-server caption generation and final encoded media also require that environment. Automated mocks and a successful build do not establish device codec or final-media correctness.
