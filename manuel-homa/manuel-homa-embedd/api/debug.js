// api/debug.js — Testa feed + reconstrução de imagem via SFCC homa.pt
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const FEED_URL = process.env.FEED_URL || 'https://homastore.online/homa/feedhoma.xml';
  const SFCC_IMG_BASE = process.env.SFCC_IMG_BASE
    || 'https://www.homa.pt/dw/image/v2/BFDH_PRD/on/demandware.static/-/Sites-homa-catalog/default/dw6dfe17e3/images/large';

  const results = {};

  // 1. Parse first product from feed
  try {
    const feedRes = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)' },
      signal: AbortSignal.timeout(20000)
    });
    const xml = await feedRes.text();
    const firstItem = xml.split(/<item>/i)[1] || '';
    const get = (tag) => {
      const m = firstItem.match(new RegExp(`<g:${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/g:${tag}>`, 'i'));
      return m ? m[1].trim() : null;
    };
    const feedImageUrl = get('image_link');
    const filename = feedImageUrl ? feedImageUrl.split('/').pop() : null;
    const reconstructed = filename ? (SFCC_IMG_BASE + '/' + filename) : null;

    results.feed_product = {
      title: firstItem.match(/<title>([^<]+)/)?.[1],
      feed_image_url: feedImageUrl,
      filename_extracted: filename,
      reconstructed_homa_url: reconstructed,
    };

    // 2. Test if reconstructed URL is accessible from Vercel
    if (reconstructed) {
      try {
        const imgRes = await fetch(reconstructed, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Referer': 'https://www.homa.pt/',
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'same-origin',
          },
          signal: AbortSignal.timeout(8000)
        });
        results.image_access = {
          status: imgRes.status,
          ok: imgRes.ok,
          content_type: imgRes.headers.get('content-type'),
          size_bytes: imgRes.headers.get('content-length'),
        };
        results.verdict = imgRes.ok
          ? '✅ Images will work — SFCC CDN accessible from Vercel'
          : `❌ SFCC CDN blocked (${imgRes.status}) — update SFCC_IMG_BASE env var`;
      } catch (err) {
        results.image_access = { error: err.message };
        results.verdict = '❌ Fetch failed — ' + err.message;
      }
    }
  } catch (err) {
    results.error = err.message;
  }

  results.sfcc_img_base_in_use = SFCC_IMG_BASE;
  results.hint = 'If verdict is ❌, open any PDP on homa.pt, right-click a product image → "Open in new tab", copy that URL and update SFCC_IMG_BASE env var in Vercel with the base path up to /images/large';

  return res.status(200).json(results, null, 2);
}
