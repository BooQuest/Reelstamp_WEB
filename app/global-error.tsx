'use client';
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return <html lang="ko"><body><main style={{ padding: 32, textAlign: 'center' }}>
    <h1>잠시 연결이 원활하지 않아요</h1><p>잠시 후 다시 시도해 주세요.</p>
    <button onClick={reset}>다시 시도</button>
  </main></body></html>;
}
