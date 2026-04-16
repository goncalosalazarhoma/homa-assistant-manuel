# Manuel — Assistente de Decoração hôma 🏡

Chat assistant powered by Claude, deployed on Vercel. O Manuel analisa pedidos dos clientes, pesquisa produtos no catálogo hôma em tempo real (via SFCC), e recomenda produtos com links diretos.

---

## Arquitetura

```
public/
  index.html        ← Frontend: chat UI com persona Manuel
api/
  chat.js           ← Serverless function: Claude + tool use + SFCC search
vercel.json         ← Routing e build config
package.json        ← Deps (apenas @anthropic-ai/sdk)
```

**Fluxo:**
1. Utilizador envia mensagem (texto + opcional foto)
2. Frontend → `POST /api/chat` com histórico da conversa
3. `chat.js` corre loop agentic: Claude decide se precisa de pesquisar produtos
4. Se sim, chama `search_homa_products` → faz request SFCC search endpoint
5. Parse do HTML de resultados → extrai nome, preço, URL, imagem
6. Claude formula resposta final com produtos contextualizados
7. Frontend renderiza resposta + product cards clicáveis

---

## Deploy em Vercel

### 1. Pré-requisitos
- Conta em [vercel.com](https://vercel.com)
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- API key da Anthropic: [console.anthropic.com](https://console.anthropic.com)

### 2. Clonar / copiar o projeto
```bash
git init manuel-homa
cd manuel-homa
# copiar todos os ficheiros deste pacote
```

### 3. Instalar dependências
```bash
npm install
```

### 4. Configurar variável de ambiente
```bash
# Adicionar a secret no Vercel
vercel env add ANTHROPIC_API_KEY
# → Colar a tua API key quando pedido
# → Selecionar: Production, Preview, Development
```

### 5. Deploy
```bash
vercel --prod
```

O Vercel vai dar-te um URL tipo `https://manuel-homa-xxx.vercel.app` ✅

---

## Configuração local (dev)

```bash
# Criar ficheiro .env.local
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# Correr servidor local
vercel dev
# → http://localhost:3000
```

---

## Personalização

### Foto do Manuel
No chat, clica no placeholder da foto na sidebar esquerda para fazer upload da foto. 
Para tornar a foto permanente (sem ter de fazer upload a cada sessão), substitui o URL no HTML ou aloja a imagem no CDN hôma e faz:
```html
<!-- Em public/index.html, substitui o avatar-placeholder por: -->
<img id="avatarImg" class="avatar-img" src="https://cdn.homa.pt/assets/manuel.jpg" alt="Manuel" />
```

### Locale PT vs ES
O assistente detecta automaticamente o idioma do utilizador. Para forçar ES:
No `api/chat.js`, ajusta o default locale na chamada `searchHomaProducts`.

### Limite de produtos por resposta
Em `api/chat.js`, linha `limit = 4` — ajusta conforme necessário (máx 8).

### Persona / system prompt
Edita `SYSTEM_PROMPT` em `api/chat.js` para ajustar o tom, competências ou restrições do Manuel.

---

## Como funciona o crawling SFCC

Usa o mesmo endpoint AJAX do SFCC que alimenta o Search-UpdateGrid no homa.pt:

```
GET /on/demandware.store/Sites-homa-pt-Site/pt_PT/Search-Show?q={query}&format=ajax&sz={limit}
```

O HTML retornado é parseado com regex para extrair:
- `.product-tile` blocks
- `href` com URLs de produto
- `data-src` / `src` com imagem principal  
- Preço em formato `XX,XX €`

Este é o mesmo padrão usado no **Shop the Look** (homa-stl.vercel.app).

---

## Variáveis de ambiente necessárias

| Variável | Descrição |
|----------|-----------|
| `ANTHROPIC_API_KEY` | API key da Anthropic (obrigatória) |

---

## Custos estimados

- Modelo: `claude-sonnet-4-20250514`
- Tokens por conversa: ~1.000–3.000 (input) + ~500–800 (output)
- Com pesquisa de produtos: +~2.000 tokens por tool call
- **Estimativa:** ~$0.005–0.015 por conversa completa

---

## Limitações conhecidas

- O parsing HTML do SFCC pode falhar se a Demandware mudar a estrutura dos product tiles → ajustar regex em `parseProductTiles()`
- Imagens com lazy loading (`data-src`) podem não ser capturadas em todos os casos
- Rate limiting do SFCC pode afetar pesquisas muito rápidas/frequentes — considera adicionar cache (Upstash Redis, como no CDN hôma)

---

## Roadmap sugerido

- [ ] Cache de resultados de pesquisa com Upstash Redis (TTL 1h)
- [ ] Integração com SFCC Product-Variation API para mostrar variantes disponíveis
- [ ] Widget embeddable (iframe) para colocar no homa.pt
- [ ] Histórico de conversas por sessão (localStorage)
- [ ] Analytics: rastrear produtos recomendados vs clicados (GA4 events)
- [ ] Modo ES com redirect automático para homa.es
