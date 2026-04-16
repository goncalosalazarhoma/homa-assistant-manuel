// api/chat.js — Manuel, Assistente hôma
// Pesquisa produtos via feed XML Google Shopping (em memória, cache 1h)

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

// ── Product index (module-level cache, survives warm invocations) ─────────────
const FEED_URL = process.env.FEED_URL || 'https://homastore.online/homa/feedhoma.xml';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let productCache = {
  products: [],   // [{id, name, url, image, price, description, category, keywords}]
  loadedAt: 0
};

async function getProducts() {
  const now = Date.now();
  if (productCache.products.length > 0 && now - productCache.loadedAt < CACHE_TTL_MS) {
    return productCache.products;
  }

  console.log('Loading product feed...');
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)' },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);

  const xml = await res.text();
  const products = parseFeed(xml);
  console.log(`Feed loaded: ${products.length} products`);

  productCache = { products, loadedAt: now };
  return products;
}

// ── XML parser (no external deps — pure regex for Google Shopping feed) ────────
function parseFeed(xml) {
  const products = [];

  // Split into <item> blocks
  const items = xml.split(/<item>/i).slice(1);

  for (const item of items) {
    const get = (tag) => {
      // Try namespaced (g:tag) first, then plain
      const patterns = [
        new RegExp(`<g:${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/g:${tag}>`, 'i'),
        new RegExp(`<g:${tag}[^>]*>([^<]*)<\\/g:${tag}>`, 'i'),
        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
        new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'),
      ];
      for (const re of patterns) {
        const m = item.match(re);
        if (m && m[1].trim()) return m[1].trim();
      }
      return '';
    };

    const name = get('title') || get('name');
    const url = get('link');
    const image = get('image_link') || get('image');
    const priceRaw = get('price') || get('sale_price');
    const description = get('description').slice(0, 300);
    const category = get('product_type') || get('google_product_category') || '';
    const id = get('id');

    if (!name || !url) continue;

    // Normalise price — "29.99 EUR" → "29,99 €"
    const price = priceRaw
      ? priceRaw.replace(/(\d+)\.(\d+)\s*(EUR|€)?/i, '$1,$2 €').replace(/\s+EUR$/i, ' €')
      : null;

    // Build searchable keyword string (lowercase, accents kept)
    const keywords = [name, description, category]
      .join(' ')
      .toLowerCase()
      .normalize('NFD')           // decompose accents
      .replace(/[\u0300-\u036f]/g, ''); // strip diacritics for matching

    products.push({ id, name, url, image, price, description, category, keywords });
  }

  return products;
}

// ── Search function ───────────────────────────────────────────────────────────
function searchProducts(products, query, limit = 5) {
  // Normalise query the same way as keywords
  const normQuery = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const terms = normQuery.split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return [];

  // Score each product
  const scored = products.map(p => {
    let score = 0;
    for (const term of terms) {
      if (p.keywords.includes(term)) {
        // Higher score for matches in name vs description
        if (p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term)) score += 3;
        else if (p.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(term)) score += 2;
        else score += 1;
      }
    }
    return { ...p, score };
  });

  return scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, keywords, ...p }) => p); // strip internal fields
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `És o Manuel, assistente de decoração da hôma — marca portuguesa de artigos para casa (homa.pt / homa.es).

Personalidade: simpático, próximo, caloroso, especialista em decoração. Português europeu com PT, espanhol castelhano com ES. Emojis com moderação (1-2 por mensagem).

Papel: encontrar produtos hôma, sugerir para projetos de decoração, analisar fotos de espaços.

Pesquisa de produtos:
- Usa SEMPRE a tool search_products quando precisas sugerir produtos concretos.
- Faz pesquisas com termos simples e descritivos em português: "sofá", "candeeiro", "tapete sala", "mesa madeira", "almofada", "espelho", "vaso", "cesto".
- Se a primeira pesquisa não devolver resultados relevantes, tenta termos alternativos ou mais genéricos.
- Nunca inventes produtos — só recomendas o que a tool devolver.

Formato de resposta: JSON válido sem markdown fences:
{"text": "resposta conversacional aqui", "products": []}
O campo products é preenchido automaticamente. Nunca o preenchas manualmente.`;

// ── Tools ─────────────────────────────────────────────────────────────────────
const TOOLS = [{
  name: 'search_products',
  description: 'Pesquisa produtos no catálogo hôma por palavras-chave. Retorna produtos reais com nome, preço, URL e imagem.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Termos de pesquisa em português. Simples e descritivos: "sofá cinzento", "candeeiro pé", "tapete algodão".' },
      limit: { type: 'integer', description: 'Número de produtos a retornar (default 4, max 6)', default: 4 }
    },
    required: ['query']
  }
}];

// ── Agentic loop ──────────────────────────────────────────────────────────────
async function runManuel(messages, apiKey) {
  // Pre-load product feed (cached after first call)
  const products = await getProducts();

  let current = [...messages];
  let allProducts = [];
  let finalText = '';

  for (let round = 0; round < 3; round++) {
    const response = await callClaude(current, apiKey);
    const texts = response.content.filter(b => b.type === 'text');
    if (texts.length) finalText = texts.map(b => b.text).join('\n');

    const toolCalls = response.content.filter(b => b.type === 'tool_use');
    if (!toolCalls.length || response.stop_reason === 'end_turn') break;

    const results = [];
    for (const t of toolCalls) {
      if (t.name === 'search_products') {
        const found = searchProducts(products, t.input.query, Math.min(t.input.limit || 4, 6));
        allProducts.push(...found);
        results.push({
          type: 'tool_result',
          tool_use_id: t.id,
          content: JSON.stringify({
            query: t.input.query,
            count: found.length,
            products: found.map(p => ({ name: p.name, url: p.url, image: p.image, price: p.price, category: p.category }))
          })
        });
      }
    }
    current = [...current, { role: 'assistant', content: response.content }, { role: 'user', content: results }];
  }

  // Parse JSON wrapper from Claude's response
  let parsedText = finalText;
  try {
    const parsed = JSON.parse(finalText.replace(/```json|```/g, '').trim());
    if (parsed.text) parsedText = parsed.text;
  } catch (_) {}

  // Deduplicate products by URL
  const seen = new Set();
  const unique = allProducts.filter(p => {
    if (!p.url || seen.has(p.url)) return false;
    seen.add(p.url); return true;
  }).slice(0, 6);

  return { text: parsedText, products: unique };
}

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(messages, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages
    })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return res.json();
}
