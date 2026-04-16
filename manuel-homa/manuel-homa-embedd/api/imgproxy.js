// api/debug.js — Diagnóstico: feed + teste de acesso a imagens
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const FEED_URL = process.env.FEED_URL || 'https://homastore.online/homa/feedhoma.xml';
  const results = {};

  // 1. Test image access from Vercel server
  const testImgUrl = 'https://homastore.online/images/products/000031_conjunto_de_2_travessas_quadradas_borcam_em_vidro_homa_1.jpg';
  try {
    const imgRes = await fetch(testImgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*',
        'Referer': 'https://www.homa.pt/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site',
      },
      signal: AbortSignal.timeout(8000)
    });
    results.image_test = {
      url: testImgUrl,
      status: imgRes.status,
      ok: imgRes.ok,
      content_type: imgRes.headers.get('content-type'),
      content_length: imgRes.headers.get('content-length'),
    };
  } catch (err) {
    results.image_test = { error: err.message, url: testImgUrl };
  }

  // 2. Parse a few products from feed
  try {
    const feedRes = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)' },
      signal: AbortSignal.timeout(20000)
    });
    const xml = await feedRes.text();
    const totalItems = (xml.match(/<item>/gi) || []).length;
    const firstItem = xml.split(/<item>/i)[1] || '';
    const getField = (tag, text) => {
      const m = text.match(new RegExp(`<g:${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/g:${tag}>`, 'i'));
      return m ? m[1].trim() : null;
    };
    results.feed = {
      status: feedRes.status,
      total_items: totalItems,
      first_product_image: getField('image_link', firstItem),
      first_product_title: firstItem.match(/<title>([^<]+)/)?.[1],
    };
  } catch (err) {
    results.feed = { error: err.message };
  }

  // 3. Proxy test — simulate what imgproxy does
  if (results.image_test?.ok) {
    results.proxy_verdict = 'IMAGE ACCESS OK — proxy will work';
  } else {
    results.proxy_verdict = `IMAGE BLOCKED (${results.image_test?.status || results.image_test?.error}) — need alternative image source`;
    // Suggest: use homa.pt SFCC CDN instead
    results.suggested_fix = 'Extract product ID from feed and build homa.pt CDN URL instead of homastore.online';
  }

  return res.status(200).json(results);
}
