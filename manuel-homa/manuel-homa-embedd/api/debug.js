// api/debug.js — Mostra os primeiros 5 produtos parseados do feed
// Usar uma vez para confirmar URLs de imagem, depois apagar
// Aceder em: https://SEU-PROJETO.vercel.app/api/debug

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const FEED_URL = process.env.FEED_URL || 'https://homastore.online/homa/feedhoma.xml';

  try {
    const feedRes = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)' },
      signal: AbortSignal.timeout(20000)
    });

    if (!feedRes.ok) {
      return res.status(200).json({ error: `Feed HTTP ${feedRes.status}`, url: FEED_URL });
    }

    const xml = await feedRes.text();
    const totalItems = (xml.match(/<item>/gi) || []).length;

    // Parse first 5 items manually
    const items = xml.split(/<item>/i).slice(1, 6);
    const sample = items.map(item => {
      const get = (tag) => {
        const patterns = [
          new RegExp(`<g:${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/g:${tag}>`, 'i'),
          new RegExp(`<g:${tag}[^>]*>([^<]{1,300})<\\/g:${tag}>`, 'i'),
          new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
          new RegExp(`<${tag}[^>]*>([^<]{1,300})<\\/${tag}>`, 'i'),
        ];
        for (const re of patterns) {
          const m = item.match(re);
          if (m && m[1].trim()) return m[1].trim();
        }
        return null;
      };
      return {
        id:    get('id'),
        title: get('title'),
        link:  get('link'),
        image_link: get('image_link') || get('image'),
        price: get('price'),
        availability: get('availability'),
        product_type: get('product_type'),
      };
    });

    // Also show raw first item for debugging
    const rawFirst = items[0] ? items[0].slice(0, 2000) : null;

    return res.status(200).json({
      feed_url: FEED_URL,
      feed_size_kb: Math.round(xml.length / 1024),
      total_items: totalItems,
      sample_products: sample,
      raw_first_item_preview: rawFirst
    });

  } catch (err) {
    return res.status(200).json({ error: err.message, feed_url: FEED_URL });
  }
}
