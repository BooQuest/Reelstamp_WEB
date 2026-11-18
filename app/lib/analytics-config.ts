// One destination for the Google tag and all Reelstamp funnel events.
// Keep this explicit so a legacy deployment environment variable cannot route
// events to the previous Analytics property.
export const GA_MEASUREMENT_ID = 'G-8YXS25H07Z';

export const GOOGLE_TAG_INIT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
// OAuth query strings contain one-use credentials. Do not send this page view.
var oauthCallback = window.location.pathname === '/login' &&
  /[?&](code|state|error)=/.test(window.location.search);
if (!oauthCallback) gtag('config', '${GA_MEASUREMENT_ID}');
`;
