// One destination for the Google tag and all Reelstamp funnel events.
// Keep this explicit so a legacy deployment environment variable cannot route
// events to the previous Analytics property.
export const GA_MEASUREMENT_ID = 'G-8YXS25H07Z';

export const GOOGLE_TAG_INIT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`;
