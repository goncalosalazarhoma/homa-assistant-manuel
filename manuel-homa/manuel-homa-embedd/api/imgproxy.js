// api/imgproxy.js — Proxy de imagens para evitar CORS no widget
// Serve imagens do feed XML sem restrições de origem

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url param');

  let parsed;
  try {
    parsed = new URL(decodeURIComponent(url));
  } catch {
    return res.status(400).send('Invalid url');
  }

  // Must be https and an image path
  if (parsed.protocol !== 'https:') return res.status(403).send('HTTPS only');

  // Block obviously non-image extensions (allow blank extension — CDN URLs often have none)
  const ext = parsed.pathname.split('.').pop().toLowerCase();
  const blocked = ['html', 'php', 'js', 'css', 'xml'];
  if (blocked.includes(ext)) return res.status(403).send('Not an image');

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)',
        'Referer': 'https://www.homa.pt/',
        'Accept': 'image/*,*/*'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      console.error('imgproxy upstream error:', upstream.status, parsed.toString());
      return res.status(upstream.status).send('Upstream ' + upstream.status);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    
    // Reject if upstream returned non-image content
    if (!contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      return res.status(415).send('Not an image content-type: ' + contentType);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Proxied-From', parsed.hostname);
    return res.status(200).send(buffer);

  } catch (err) {
    console.error('imgproxy error:', err.message, parsed.toString());
    return res.status(502).send('Proxy fetch failed');
  }
}
