import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GoogleTag from '@/app/components/analytics/GoogleTag';
import { GA_MEASUREMENT_ID, GOOGLE_TAG_INIT } from './analytics-config';
import { trackReelsEvent } from './analytics';

afterEach(() => {
  Reflect.deleteProperty(window, 'gtag');
  Reflect.deleteProperty(window, 'dataLayer');
});

it('installs one async tag in the head and queues events before the network script loads', () => {
  const html = renderToStaticMarkup(<html><head><GoogleTag /></head><body /></html>);
  const head = new DOMParser().parseFromString(html, 'text/html').head;
  expect(head.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]')).toHaveLength(1);
  expect(head.querySelector('script[src]')?.getAttribute('src')).toContain(`id=${GA_MEASUREMENT_ID}`);
  expect(head.querySelector('script[src]')?.hasAttribute('async')).toBe(true);
  expect(head.querySelector('#reelstamp-google-tag-init')?.textContent).toBe(GOOGLE_TAG_INIT);
  window.eval(GOOGLE_TAG_INIT);
  trackReelsEvent('template_start', { template_id: 'template', template_name: '테스트' });
  const queue = (window as unknown as { dataLayer: IArguments[] }).dataLayer.map(item => Array.from(item));
  expect(queue).toEqual([
    ['js', expect.any(Date)],
    ['config', 'G-8YXS25H07Z'],
    ['event', 'template_start', { template_id: 'template', template_name: '테스트', send_to: 'G-8YXS25H07Z' }],
  ]);
});

it('does not interrupt the user action when analytics is blocked or throws', () => {
  expect(() => trackReelsEvent('download_click', { template_id: 'template' })).not.toThrow();
  window.gtag = vi.fn(() => { throw new Error('blocked'); });
  expect(() => trackReelsEvent('download_click', { template_id: 'template' })).not.toThrow();
});
