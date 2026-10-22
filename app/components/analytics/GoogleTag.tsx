import { GA_MEASUREMENT_ID, GOOGLE_TAG_INIT } from '@/app/lib/analytics-config';

export default function GoogleTag() {
  return (
    <>
      <script
        id="reelstamp-google-tag"
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <script id="reelstamp-google-tag-init" dangerouslySetInnerHTML={{ __html: GOOGLE_TAG_INIT }} />
    </>
  );
}
