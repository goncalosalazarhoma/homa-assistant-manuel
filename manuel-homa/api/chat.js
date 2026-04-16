// api/chat.js — Manuel's brain: Claude-powered chat with hôma product search
// Deployed as a Vercel serverless function

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `És o Manuel, assistente de decoração da hôma — uma marca portuguesa de artigos para casa que opera em Portugal e Espanha (homa.pt / homa.es).

## Personalidade e Estilo
- Simpático, próximo, entusiasta com decoração mas sem exagerar
- Fala de forma natural e calorosa — como um amigo especializado
- Quando o utilizador fala português, respondes em português europeu (tu/você)
- Quando fala espanhol, respondes em espanhol castelhano
- Nunca usas linguagem excessivamente formal nem excessivamente casual
- Às vezes usas emojis com moderação (1-2 por mensagem no máximo)
- Tens 10+ anos de experiência em decoração de interiores e conheces bem o catálogo hôma

## O teu papel
1. Ajudar utilizadores a encontrar produtos específicos no catálogo hôma
2. Sugerir produtos para completar ou criar projetos de decoração
3. Analisar fotos de espaços enviadas pelos utilizadores e dar recomendações
4. Inspirar e orientar — não apenas vender

## Fluxo de pesquisa de produtos
Quando precisas de sugerir produtos, usa a tool search_homa_products com termos de pesquisa relevantes (em português). Baseia-te no pedido do utilizador para escolher as queries certas.

Exemplos de queries:
- "sofá cinzento sala" 
- "candeeiro mesa de cabeceira"
- "tapete sala estar"
- "almofadas decorativas"
- "mesa de jantar madeira"
- "prateleiras parede"
- "plantas artificiais"
- "cesto rattan"

## Quando analisas uma foto
Descreve o que vês (estilo, cores predominantes, pontos de melhoria) e sugere produtos concretos com base nisso. Sê específico e útil.

## Formato das respostas
- Respostas conversacionais, fluidas, em texto natural
- Quando sugeres produtos, apresenta-os de forma contextualizada (não em lista seca)
- Máximo 3-4 sugestões de produtos por mensagem para não sobrecarregar
- Inclui sempre o link para o produto (fornecido pelos resultados da search)

## Limites
- Só podes recomendar produtos disponíveis no site hôma (homa.pt / homa.es)
- Se não encontrares um produto adequado, diz honestamente e sugere uma alternativa próxima
- Não inventas produtos ou preços que não existem
`;

// ─── Product search via hôma SFCC ────────────────────────────────────────────
const HOMA_SEARCH_TOOLS = [
  {
    name: 'search_homa_products',
    description: 'Pesquisa produtos no catálogo hôma por palavras-chave. Retorna nome, preço, URL e imagem de cada produto encontrado.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termos de pesquisa em português (ex: "sofá cinzento", "candeeiro sala", "tapete algodão")'
        },
        locale: {
          type: 'string',
          enum: ['pt_PT', 'es_ES'],
          description: 'Locale do site (default: pt_PT)'
        },
        limit: {
          type: 'integer',
          description: 'Número máximo de produtos a retornar (default: 4, max: 8)',
          default: 4
        }
      },
      required: ['query']
    }
  }
];

// ─── Execute product search ───────────────────────────────────────────────────
async function searchHomaProducts({ query, locale = 'pt_PT', limit = 4 }) {
  const site = locale === 'es_ES' ? 'homa-es' : 'homa-pt';
  const langCode = locale === 'es_ES' ? 'es_ES' : 'pt_PT';
  const baseUrl = locale === 'es_ES' ? 'https://www.homa.es' : 'https://www.homa.pt';

  // SFCC Search-Show endpoint (same pattern used in Shop the Look)
  const searchUrl = `${baseUrl}/on/demandware.store/Sites-${site}-Site/${langCode}/Search-Show?q=${encodeURIComponent(query)}&format=ajax&sz=${limit}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomaBot/1.0)',
        'Accept': 'text/html,application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);

    const html = await res.text();

    // Parse product tiles from SFCC HTML response
    const products = parseProductTiles(html, baseUrl, limit);
    return { products, query, total: products.length };

  } catch (err) {
    console.error('Search error:', err.message);
    // Fallback: return search link
    return {
      products: [{
        name: `Ver resultados para "${query}"`,
        url: `${baseUrl}/search?q=${encodeURIComponent(query)}`,
        image: null,
        price: null,
        id: null
      }],
      query,
      total: 1
    };
  }
}

// ─── Parse SFCC product tiles HTML ───────────────────────────────────────────
function parseProductTiles(html, baseUrl, limit) {
  const products = [];

  // Match product tile blocks
  const tileRegex = /<div[^>]+class="[^"]*product-tile[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let match;

  while ((match = tileRegex.exec(html)) !== null && products.length < limit) {
    const block = match[0];

    // Extract product URL
    const urlMatch = block.match(/href="([^"]*\/p\/[^"?#]+)/i) ||
                     block.match(/href="([^"]*product[^"]*?)"/i);
    const url = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : baseUrl + urlMatch[1]) : null;
    if (!url) continue;

    // Extract product name
    const nameMatch = block.match(/class="[^"]*product-name[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) ||
                      block.match(/class="[^"]*tile-body[^"]*"[\s\S]*?<a[^>]*>([^<]{5,80})<\/a>/i) ||
                      block.match(/aria-label="([^"]{5,100})"/i);
    const name = nameMatch ? nameMatch[1].trim() : 'Produto hôma';

    // Extract image
    const imgMatch = block.match(/data-src="([^"]+\.(?:jpg|png|webp)[^"]*)"/i) ||
                     block.match(/src="([^"]+\.(?:jpg|png|webp)[^"]*)"/i);
    const image = imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : baseUrl + imgMatch[1]) : null;

    // Extract price
    const priceMatch = block.match(/class="[^"]*price[^"]*"[\s\S]*?(\d+[,.]?\d*)\s*€/i) ||
                       block.match(/(\d+[,.]?\d*)\s*€/i);
    const price = priceMatch ? `${priceMatch[1]} €` : null;

    // Extract product ID from URL
    const idMatch = url.match(/\/([A-Z0-9\-]+)\.html/) || url.match(/\/p\/([^/?]+)/);
    const id = idMatch ? idMatch[1] : null;

    products.push({ name, url, image, price, id });
  }

  // Fallback: try simpler patterns if structured parsing fails
  if (products.length === 0) {
    const simpleUrlRegex = /href="(\/[a-zA-Z0-9\-_\/]+\.html)"/gi;
    const simpleImgRegex = /src="(https:\/\/[^"]+\.(?:jpg|png|webp)[^"]*)"/gi;
    const simplePriceRegex = /(\d+[,.]?\d{2})\s*€/g;

    const urls = [...html.matchAll(simpleUrlRegex)].map(m => baseUrl + m[1]).filter(u => u.includes('/p/') || u.includes('.html')).slice(0, limit);
    const imgs = [...html.matchAll(simpleImgRegex)].map(m => m[1]).slice(0, limit);
    const prices = [...html.matchAll(simplePriceRegex)].map(m => m[1] + ' €').slice(0, limit);

    urls.forEach((url, i) => {
      if (products.length >= limit) return;
      products.push({
        name: `Produto hôma ${i + 1}`,
        url,
        image: imgs[i] || null,
        price: prices[i] || null,
        id: null
      });
    });
  }

  return products.slice(0, limit);
}

// ─── Agentic loop with tool use ───────────────────────────────────────────────
async function runManuel(messages) {
  let currentMessages = [...messages];
  let allProducts = [];
  let finalText = '';

  // Up to 3 tool-use rounds
  for (let round = 0; round < 3; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: HOMA_SEARCH_TOOLS,
      messages: currentMessages
    });

    // Collect text
    const textBlocks = response.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) finalText = textBlocks.map(b => b.text).join('\n');

    // Check for tool use
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') break;

    // Execute tool calls
    const toolResults = [];
    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'search_homa_products') {
        const result = await searchHomaProducts(toolUse.input);
        allProducts.push(...result.products);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }
    }

    // Continue conversation with tool results
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults }
    ];
  }

  // Deduplicate products by URL
  const seen = new Set();
  const uniqueProducts = allProducts.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  }).slice(0, 6);

  return { text: finalText, products: uniqueProducts };
}

// ─── Vercel handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const result = await runManuel(messages);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Manuel error:', err);
    return res.status(500).json({ error: err.message });
  }
};
