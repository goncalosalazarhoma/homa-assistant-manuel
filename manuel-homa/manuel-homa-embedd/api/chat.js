// api/chat.js — Manuel, Assistente hôma
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });
    const result = await runManuel(messages, apiKey);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Manuel error:', err);
    return res.status(500).json({ error: err.message });
  }
}

const SYSTEM_PROMPT = `És o Manuel, assistente de decoração da hôma — marca portuguesa de artigos para casa (homa.pt / homa.es).

Personalidade: simpático, próximo, caloroso, especialista em decoração. Português europeu com PT, castelhano com ES. Emojis com moderação.

Papel: encontrar produtos hôma, sugerir para projetos de decoração, analisar fotos de espaços.

Pesquisa: usa SEMPRE a tool search_homa_products quando precisas sugerir produtos. Queries em português descritivas: "sofá cinzento sala", "candeeiro cabeceira", "tapete sala", "mesa jantar madeira", "vaso plantas", "espelho hall".

Formato de resposta: responde SEMPRE com JSON válido sem markdown:
{"text": "resposta aqui", "products": []}`;

const TOOLS = [{
  name: 'search_homa_products',
  description: 'Pesquisa produtos no catálogo hôma.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      locale: { type: 'string', enum: ['pt_PT', 'es_ES'], default: 'pt_PT' },
      limit: { type: 'integer', default: 4 }
    },
    required: ['query']
  }
}];

async function runManuel(messages, apiKey) {
  let current = [...messages];
  let allProducts = [];
  let finalText = '';

  for (let round = 0; round < 3; round++) {
    const response = await callClaude(current, apiKey);
    const texts = response.content.filter(b => b.type === 'text');
    if (texts.length) finalText = texts.map(b => b.text).join('\n');

    const tools = response.content.filter(b => b.type === 'tool_use');
    if (!tools.length || response.stop_reason === 'end_turn') break;

    const results = [];
    for (const t of tools) {
      if (t.name === 'search_homa_products') {
        const r = await searchHomaProducts(t.input);
        allProducts.push(...r.products);
        results.push({ type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(r) });
      }
    }
    current = [...current, { role: 'assistant', content: response.content }, { role: 'user', content: results }];
  }

  let parsedText = finalText;
  try {
    const parsed = JSON.parse(finalText.replace(/```json|```/g, '').trim());
    if (parsed.text) parsedText = parsed.text;
  } catch (_) {}

  const seen = new Set();
  const products = allProducts.filter(p => {
    if (!p.url || seen.has(p.url)) return false;
    seen.add(p.url); return true;
  }).slice(0, 6);

  return { text: parsedText, products };
}

async function callClaude(messages, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: SYSTEM_PROMPT, tools: TOOLS, messages })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return res.json();
}

async function searchHomaProducts({ query, locale = 'pt_PT', limit = 4 }) {
  const site = locale === 'es_ES' ? 'homa-es' : 'homa-pt';
  const lang = locale === 'es_ES' ? 'es_ES' : 'pt_PT';
  const base = locale === 'es_ES' ? 'https://www.homa.es' : 'https://www.homa.pt';
  const url = `${base}/on/demandware.store/Sites-${site}-Site/${lang}/Search-Show?q=${encodeURIComponent(query)}&format=ajax&sz=${Math.min(limit,6)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)', 'X-Requested-With': 'XMLHttpRequest' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`SFCC ${res.status}`);
    const html = await res.text();
    return { products: parseProducts(html, base, limit), query };
  } catch (err) {
    console.error('Search:', err.message);
    return { products: [{ name: `Ver "${query}" em hôma`, url: `${base}/search?q=${encodeURIComponent(query)}`, image: null, price: null }], query };
  }
}

function parseProducts(html, base, limit) {
  const products = [];
  const urlM = [...html.matchAll(/href="(\/[^"]*?(?:\/p\/|\.html)[^"]*?)"/gi)];
  const imgM = [...html.matchAll(/(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]+)?)"/gi)];
  const nameM = [...html.matchAll(/class="[^"]*(?:product-name|pdp-link)[^"]*"[\s\S]*?<a[^>]*>([^<]{4,80})<\/a>/gi)];
  const priceM = [...html.matchAll(/(\d+[,.]?\d{0,2})\s*€/g)];

  const urls = [...new Set(urlM.map(m => base + m[1]))].filter(u => !u.includes('wishlist') && !u.includes('compare'));
  urls.slice(0, limit).forEach((url, i) => {
    products.push({
      name: nameM[i]?.[1]?.trim() || 'Produto hôma',
      url,
      image: imgM[i + 2]?.[1] || null, // skip logo/nav images
      price: priceM[i] ? `${priceM[i][1]} €` : null
    });
  });
  return products.slice(0, limit);
}
