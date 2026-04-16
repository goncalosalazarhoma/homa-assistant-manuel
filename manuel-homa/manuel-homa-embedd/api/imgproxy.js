// api/imgproxy.js — Proxy de imagens de produto (server-side, sem CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  let parsed;
  try { parsed = new URL(decodeURIComponent(url)); }
  catch { return res.status(400).send('Invalid url'); }

  if (parsed.protocol !== 'https:') return res.status(403).send('HTTPS only');

  // Block non-image extensions
  const ext = parsed.pathname.split('.').pop().toLowerCase();
  if (['html','php','js','css','xml','json'].includes(ext)) return res.status(403).send('Not an image');

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        // Full browser-like headers to bypass hotlink protection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.homa.pt/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site',
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      console.error(`imgproxy: ${upstream.status} for ${parsed.hostname}${parsed.pathname}`);
      return res.status(upstream.status).send(`Upstream ${upstream.status}`);
    }

    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buffer);

  } catch (err) {
    console.error('imgproxy fetch error:', err.message);
    return res.status(502).send('Proxy fetch failed');
  }
}
