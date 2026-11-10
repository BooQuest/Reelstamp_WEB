import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
const root = fileURLToPath(new URL('../../', import.meta.url));
const server = await createServer({
  configFile: false,
  root,
  define: { 'process.env': {} },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      {
        find: '@/app/i18n/LocaleProvider',
        replacement: root + 'scripts/caption-browser/locale.js',
      },
      {
        find: '@/app/lib/analytics',
        replacement: root + 'scripts/caption-browser/analytics.js',
      },
      { find: '@', replacement: root },
    ],
  },
  server: { host: '127.0.0.1', port: 5192, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.error(e.message);
});
await mkdir(root + 'artifacts/caption-browser', { recursive: true });
const base = 'http://127.0.0.1:5192/scripts/caption-browser/index.html';
let cases = 0;
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const version of ['CAPTION_RENDER_V1', 'CAPTION_RENDER_V2']) {
      await page.goto(base + '?' + new URLSearchParams({ source: 'TEMPLATE', version }));
      const node = page.locator('[data-caption-id="original"]');
      await expect(node).toHaveCSS('font-weight', '400');
      await page.evaluate(() => document.fonts.ready);
      const before = await node.boundingBox();
      await node.click();
      await expect(page.locator('textarea')).toHaveCSS('font-weight', '400');
      await page.getByRole('button', { name: '스타일', exact: true }).click();
      await expect(page.getByRole('button', { name: '기본', exact: true })).toHaveAttribute('aria-pressed', 'true');
      expect(await node.boundingBox()).toEqual(before);
      await page.locator('textarea').press('Escape');
      await expect(node).toHaveCSS('font-weight', '400');
      await expect(page.getByRole('button', { name: '실행 취소', exact: true })).toBeDisabled();
    }
    for (const version of ['CAPTION_RENDER_V1', 'CAPTION_RENDER_V2'])
      for (const align of ['left', 'center', 'right'])
        for (const font of [
          'ReelstampCaptionPretendard',
          'ReelstampCaptionNotoSerif',
        ])
          for (const boxed of ['true', 'false']) {
            const text =
              cases % 3 === 0
                ? '한 줄'
                : cases % 3 === 1
                  ? '두 줄 자막\n짧은 줄'
                  : '긴 한글 자막의 줄바꿈을 확인합니다 '.repeat(5);
            await page.goto(
              base +
                '?' +
                new URLSearchParams({ version, align, font, boxed, text }),
            );
            await page.evaluate(() => document.fonts.ready);
            const node = page.locator('[data-caption-id="original"]');
            await expect(node).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            await expect
              .poll(() =>
                page.evaluate(() => window.captionFixture.previewScale),
              )
              .toBeLessThan(1);
            const before = await node.boundingBox();
            const stored = await page.evaluate(() =>
              JSON.stringify(window.captionFixture.captions),
            );
            await node.click();
            const input = page.locator('textarea');
            await expect(input).toBeFocused();
            const after = await node.boundingBox();
            // Compare in render coordinates too: desktop toolbar may take layout space.
            const geometry = await node.evaluate((n) => ({
              w: n.offsetWidth,
              h: n.offsetHeight,
              align: getComputedStyle(n.querySelector('textarea')).textAlign,
              scroll: n.querySelector('textarea').scrollHeight,
              client: n.querySelector('textarea').clientHeight,
            }));
            expect(geometry.align).toBe(
              version === 'CAPTION_RENDER_V1' ? 'center' : align,
            );
            expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 2);
            expect(
              await page.evaluate(() =>
                JSON.stringify(window.captionFixture.captions),
              ),
            ).toBe(stored);
            expect(after.width).toBeCloseTo(before.width, 1);
            expect(after.height).toBeCloseTo(before.height, 1);
            await page
              .getByRole('button', { name: '정렬', exact: true })
              .click();
            await expect(
              page.getByRole('button', {
                name:
                  version === 'CAPTION_RENDER_V1' || align === 'center'
                    ? '가운데'
                    : align === 'left'
                      ? '왼쪽'
                      : '오른쪽',
                exact: true,
              }),
            ).toHaveAttribute('aria-pressed', 'true');
            await input.press('Escape');
            await expect(
              page.getByRole('button', { name: '실행 취소', exact: true }),
            ).toBeDisabled();
            if (cases % 24 === 0) {
              await node.click();
              await input.fill('수정한 자막');
              await input.press('Escape');
              await page
                .getByRole('button', { name: '실행 취소', exact: true })
                .click();
              await expect
                .poll(() =>
                  page.evaluate(() =>
                    JSON.stringify(window.captionFixture.captions),
                  ),
                )
                .toBe(stored);
            }
            // Absolute-positioned captions must not shrink to the space left
            // between their anchor and the right edge while being dragged.
            const initialBox = await node.boundingBox();
            const originalStyle = await page.evaluate(() => window.captionFixture.captions[0].style);
            for (const dx of [40, -80, 40]) {
              const box = await node.boundingBox();
              const x = box.x + box.width / 2;
              const y = box.y + box.height / 2;
              await page.mouse.move(x, y);
              await page.mouse.down();
              await page.mouse.move(x + dx, y + 10, { steps: 5 });
              const during = await node.boundingBox();
              expect(during.width).toBeCloseTo(initialBox.width, 1);
              expect(during.height).toBeCloseTo(initialBox.height, 1);
              expect(during.y).not.toBeCloseTo(box.y, 1);
              await page.mouse.up();
              await expect(input).toHaveCount(0);
              const afterDrag = await node.boundingBox();
              expect(afterDrag.width).toBeCloseTo(initialBox.width, 1);
              expect(afterDrag.height).toBeCloseTo(initialBox.height, 1);
              const movedStyle = await page.evaluate(() => window.captionFixture.captions[0].style);
              expect({ ...movedStyle, xRatio: originalStyle.xRatio, yRatio: originalStyle.yRatio }).toEqual(originalStyle);
            }
            cases++;
          }
    await page.goto(base + '?version=CAPTION_RENDER_V2');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-caption-id="original"]').click();
    await page.getByRole('button', { name: '스타일', exact: true }).click();
    const preview = page.locator('div.aspect-\\[9\\/16\\]').first();
    const before = await preview.boundingBox();
    const scale = await page.evaluate(() => window.captionFixture.previewScale);
    for (let i = 0; i < 4; i++)
      for (const [name, weight] of [
        ['기본', 400],
        ['굵게', 700],
      ]) {
        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.locator('[data-caption-id="original"]')).toHaveCSS(
          'font-weight',
          String(weight),
        );
        expect(await preview.boundingBox()).toEqual(before);
        expect(
          await page.evaluate(() => window.captionFixture.previewScale),
        ).toBe(scale);
      }
    await page.goto(base + '?version=CAPTION_RENDER_V2&text=' + encodeURIComponent('크기 조절\n두 번째 줄'));
    const captionNode = page.locator('[data-caption-id="original"]');
    await captionNode.click();
    const textInput = page.locator('textarea');
    const originalBox = await captionNode.boundingBox();
    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      const handle = await page.locator(`[data-caption-resize="${corner}"]`).boundingBox();
      const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + (corner.endsWith('left') ? -8 : 8), y + (corner.startsWith('top') ? -8 : 8), { steps: 4 });
      await page.mouse.up();
      await expect(textInput).toBeFocused();
      const resized = await captionNode.boundingBox();
      expect(resized.width / resized.height).toBeCloseTo(originalBox.width / originalBox.height, 1);
    }
    await page.getByRole('button', { name: '크기', exact: true }).click();
    const slider = page.getByRole('slider');
    const percent = Number(await slider.getAttribute('aria-valuenow'));
    await page.getByRole('button', { name: '텍스트 확대', exact: true }).click();
    await expect(slider).toHaveAttribute('aria-valuenow', String(percent + 1));
    await expect(textInput).toBeFocused();
    await expect(page.locator('[data-caption-size-panel] output')).toHaveText(/글자 크기 .* px/);
    await page.getByRole('button', { name: '텍스트 복제', exact: true }).click();
    await expect(textInput).toBeFocused();
    await expect(page.locator('[data-caption-id]')).toHaveCount(2);
    const copyId = await page.evaluate(() => window.captionFixture.captions.find(c => c.id !== 'original').id);
    await page.getByRole('button', { name: '스타일', exact: true }).click();
    await page.getByRole('button', { name: '굵게', exact: true }).click();
    await page.getByRole('button', { name: '스타일 초기화', exact: true }).click();
    await expect(textInput).toHaveCSS('font-weight', '400');
    await page.getByRole('button', { name: '순서', exact: true }).click();
    await page.getByRole('button', { name: '맨 뒤로', exact: true }).click();
    await expect(page.locator('[data-caption-layer]').last()).toHaveAttribute('data-caption-layer', copyId);
    await page.locator('[data-caption-layer="original"]').click();
    await expect(textInput).toBeFocused();
    const clip = await page.locator('[data-caption-content-clip]').boundingBox();
    const original = await captionNode.boundingBox();
    const moveEdge = await page.locator('[data-caption-move="left"]').boundingBox();
    const sx = moveEdge.x + moveEdge.width / 2, sy = moveEdge.y + moveEdge.height / 2;
    await page.mouse.move(sx, sy); await page.mouse.down();
    await page.mouse.move(sx + 4, sy + clip.y + clip.height / 2 - original.y - original.height / 2 + 4, { steps: 5 });
    await expect(page.locator('[data-caption-guide]')).toHaveCount(2);
    await page.mouse.up();
    await expect(page.locator('[data-caption-guide]')).toHaveCount(0);
    await expect(textInput).toBeFocused();
    await page.screenshot({ path: root + `artifacts/caption-browser/caption-actions-${viewport.width}.png` });
    await page.screenshot({ path: root + `artifacts/caption-browser/text-tools-${viewport.width}.png` });
    await page.screenshot({
      path: root + `artifacts/caption-browser/web-${viewport.width}.png`,
    });
  }
  expect(errors).toEqual([]);
  console.log(
    `PASS: 4 prefilled template cases, ${cases} WEB geometry/style/drag cases and mobile/desktop basic-bold preview stability`,
  );
} finally {
  await browser.close();
  await server.close();
}
