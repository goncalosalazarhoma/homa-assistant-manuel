/**
 * Manuel — Assistente de Decoração hôma
 * Widget bubble para embebed em qualquer página do site.
 *
 * Instalação (adicionar antes de </body>):
 * <script src="https://SEU-PROJETO.vercel.app/manuel-widget.js"></script>
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  const API_URL = (window.ManuelConfig && window.ManuelConfig.apiUrl)
    || (document.currentScript && document.currentScript.src.replace('/manuel-widget.js', '/api/chat'))
    || '/api/chat';

  const AVATAR_URL = (window.ManuelConfig && window.ManuelConfig.avatarUrl) || null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const CSS = `
    #manuel-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Arial', sans-serif; }

    #manuel-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 60px; height: 60px; border-radius: 50%;
      background: #DAAA00; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(88,61,62,0.3);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      overflow: hidden;
    }
    #manuel-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(88,61,62,0.4); }
    #manuel-bubble img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    #manuel-bubble svg { width: 28px; height: 28px; fill: #181818; }

    #manuel-badge {
      position: fixed; bottom: 76px; right: 24px; z-index: 99999;
      background: #583D3E; color: #FAEEC9; font-size: 12px; font-weight: 600;
      padding: 6px 12px; border-radius: 20px;
      box-shadow: 0 2px 12px rgba(88,61,62,0.25);
      white-space: nowrap; pointer-events: none;
      animation: manuelFadeIn 0.4s ease 1s both;
    }
    #manuel-badge::after {
      content: ''; position: absolute; bottom: -5px; right: 20px;
      border: 5px solid transparent; border-top-color: #583D3E; border-bottom: none;
    }

    #manuel-panel {
      position: fixed; bottom: 96px; right: 24px; z-index: 99998;
      width: 380px; max-width: calc(100vw - 32px);
      height: 560px; max-height: calc(100vh - 120px);
      background: #FFFFFF; border-radius: 20px;
      box-shadow: 0 8px 48px rgba(88,61,62,0.18);
      display: none; flex-direction: column;
      overflow: hidden; transform-origin: bottom right;
      animation: manuelOpen 0.25s ease;
    }
    #manuel-panel.open { display: flex; }
    @keyframes manuelOpen { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes manuelFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* Header */
    #manuel-header {
      background: #583D3E; padding: 16px 18px;
      display: flex; align-items: center; gap: 12px; flex-shrink: 0;
    }
    #manuel-header-avatar {
      width: 42px; height: 42px; border-radius: 50%; overflow: hidden;
      border: 2px solid #DAAA00; flex-shrink: 0;
      background: #796465; display: flex; align-items: center; justify-content: center;
    }
    #manuel-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
    #manuel-header-avatar svg { width: 22px; height: 22px; fill: #DAAA00; }
    #manuel-header-info { flex: 1; }
    #manuel-header-info h3 { font-size: 14px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.02em; }
    #manuel-header-info p { font-size: 11px; color: #DAAA00; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
    .manuel-online { width: 7px; height: 7px; background: #41B658; border-radius: 50%; display: inline-block; }
    #manuel-close {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: rgba(255,255,255,0.6); font-size: 20px; line-height: 1;
      transition: color 0.2s;
    }
    #manuel-close:hover { color: #fff; }

    /* Messages */
    #manuel-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 14px;
      background: #F5F0E8;
      scrollbar-width: thin; scrollbar-color: #DED8D8 transparent;
    }
    #manuel-messages::-webkit-scrollbar { width: 3px; }
    #manuel-messages::-webkit-scrollbar-thumb { background: #DED8D8; border-radius: 3px; }

    .manuel-msg-row { display: flex; gap: 8px; align-items: flex-end; }
    .manuel-msg-row.user { flex-direction: row-reverse; }

    .manuel-avatar-sm {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: #583D3E; border: 2px solid #DAAA00; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .manuel-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
    .manuel-avatar-sm svg { width: 14px; height: 14px; fill: #DAAA00; }
    .manuel-avatar-sm.user-sm { background: #FAEEC9; border-color: #DED8D8; }
    .manuel-avatar-sm.user-sm svg { fill: #583D3E; }

    .manuel-bubble-wrap { display: flex; flex-direction: column; max-width: 78%; }
    .manuel-msg-row.user .manuel-bubble-wrap { align-items: flex-end; }

    .manuel-bubble {
      padding: 10px 14px; border-radius: 16px; font-size: 13px; line-height: 1.6;
      color: #181818;
    }
    .manuel-bubble.bot { background: #fff; border-bottom-left-radius: 4px; box-shadow: 0 2px 8px rgba(88,61,62,0.07); }
    .manuel-bubble.user { background: #583D3E; color: #fff; border-bottom-right-radius: 4px; }
    .manuel-bubble img.attached { max-width: 160px; border-radius: 8px; margin-bottom: 6px; display: block; }
    .manuel-time { font-size: 10px; color: #AC9E9F; margin-top: 3px; padding: 0 2px; }
    .manuel-msg-row.user .manuel-time { text-align: right; }

    /* Product cards */
    .manuel-products { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .manuel-product-card {
      display: flex; gap: 10px; align-items: center;
      background: #F5F0E8; border: 1px solid #E8DDD0; border-radius: 10px;
      padding: 8px; text-decoration: none; color: inherit;
      transition: box-shadow 0.2s, transform 0.15s;
    }
    .manuel-product-card:hover { box-shadow: 0 4px 16px rgba(88,61,62,0.12); transform: translateY(-1px); }
    .manuel-product-img {
      width: 52px; height: 52px; border-radius: 6px; object-fit: cover;
      background: #DED8D8; flex-shrink: 0;
    }
    .manuel-product-placeholder {
      width: 52px; height: 52px; border-radius: 6px;
      background: #DED8D8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .manuel-product-placeholder svg { width: 20px; height: 20px; fill: #AC9E9F; }
    .manuel-product-info { flex: 1; min-width: 0; }
    .manuel-product-name { font-size: 12px; font-weight: 600; color: #181818; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .manuel-product-price { font-size: 13px; font-weight: 700; color: #583D3E; margin-top: 2px; }
    .manuel-product-link { font-size: 11px; color: #DAAA00; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 3px; }

    /* Typing */
    .manuel-typing { display: flex; align-items: center; gap: 4px; padding: 10px 14px; background: #fff; border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; }
    .manuel-typing span { width: 6px; height: 6px; background: #AC9E9F; border-radius: 50%; animation: manuelBlink 1.2s infinite; }
    .manuel-typing span:nth-child(2) { animation-delay: 0.2s; }
    .manuel-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes manuelBlink { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }

    /* Quick replies */
    .manuel-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .manuel-qr {
      padding: 5px 11px; background: #fff; border: 1px solid #DAAA00;
      border-radius: 14px; font-size: 11px; color: #583D3E; cursor: pointer;
      font-weight: 600; transition: all 0.18s; white-space: nowrap;
    }
    .manuel-qr:hover { background: #DAAA00; color: #181818; }

    /* Input */
    #manuel-input-area {
      padding: 12px; background: #fff; border-top: 1px solid #E5E5E5; flex-shrink: 0;
    }
    #manuel-image-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .manuel-preview-wrap { position: relative; }
    .manuel-preview-wrap img { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 2px solid #DAAA00; display: block; }
    .manuel-preview-rm {
      position: absolute; top: -5px; right: -5px; width: 16px; height: 16px;
      background: #583D3E; border: none; border-radius: 50%; color: #fff;
      font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;
    }
    #manuel-input-row { display: flex; align-items: flex-end; gap: 8px; }
    #manuel-input-box {
      flex: 1; background: #F5F0E8; border: 1.5px solid #E5E5E5; border-radius: 20px;
      padding: 9px 14px; display: flex; align-items: flex-end; gap: 8px;
      transition: border-color 0.2s;
    }
    #manuel-input-box:focus-within { border-color: #DAAA00; }
    #manuel-textarea {
      flex: 1; border: none; background: transparent; outline: none; resize: none;
      font-size: 13px; color: #181818; font-family: Arial, sans-serif;
      line-height: 1.5; max-height: 80px;
    }
    #manuel-textarea::placeholder { color: #AC9E9F; }
    #manuel-img-btn {
      background: none; border: none; cursor: pointer; color: #AC9E9F; padding: 2px;
      transition: color 0.2s; flex-shrink: 0; display: flex; align-items: center;
    }
    #manuel-img-btn:hover { color: #DAAA00; }
    #manuel-img-btn svg { width: 18px; height: 18px; fill: currentColor; }
    #manuel-img-input { display: none; }
    #manuel-send {
      width: 38px; height: 38px; border-radius: 50%; background: #DAAA00; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, transform 0.1s; flex-shrink: 0;
    }
    #manuel-send:hover { background: #c49a00; }
    #manuel-send:active { transform: scale(0.92); }
    #manuel-send:disabled { background: #E5E5E5; cursor: not-allowed; }
    #manuel-send svg { width: 16px; height: 16px; fill: #181818; }

    @media (max-width: 420px) {
      #manuel-panel { right: 0; bottom: 80px; width: 100vw; border-radius: 20px 20px 0 0; height: 70vh; }
      #manuel-bubble { bottom: 16px; right: 16px; }
      #manuel-badge { right: 16px; bottom: 88px; }
    }
  `;

  // ── SVG icons ────────────────────────────────────────────────────────────────
  const ICON_PERSON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;
  const ICON_CHAT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  const ICON_SEND = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const ICON_IMG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
  const ICON_PRODUCT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>`;
  const ICON_LINK = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`;
  const ICON_X = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

  // ── State ────────────────────────────────────────────────────────────────────
  let history = [];
  let pendingImgs = [];
  let isOpen = false;
  let isSending = false;

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Bubble button
    const bubble = document.createElement('button');
    bubble.id = 'manuel-bubble';
    bubble.title = 'Fala com o Manuel, assistente hôma';
    bubble.innerHTML = AVATAR_URL ? `<img src="${AVATAR_URL}" alt="Manuel" />` : ICON_CHAT;
    bubble.addEventListener('click', togglePanel);
    document.body.appendChild(bubble);

    // Tooltip badge
    const badge = document.createElement('div');
    badge.id = 'manuel-badge';
    badge.textContent = 'Precisa de ajuda?';
    document.body.appendChild(badge);
    setTimeout(() => { badge.style.display = 'none'; }, 5000);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'manuel-panel';
    panel.innerHTML = buildPanel();
    document.body.appendChild(panel);

    // Wire events
    document.getElementById('manuel-close').addEventListener('click', togglePanel);
    document.getElementById('manuel-send').addEventListener('click', sendMessage);
    document.getElementById('manuel-textarea').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('manuel-textarea').addEventListener('input', autoResize);
    document.getElementById('manuel-img-btn').addEventListener('click', () => document.getElementById('manuel-img-input').click());
    document.getElementById('manuel-img-input').addEventListener('change', handleImageUpload);

    // Welcome message
    showWelcome();
  }

  function buildPanel() {
    const avatarHtml = AVATAR_URL
      ? `<img src="${AVATAR_URL}" alt="Manuel" />`
      : ICON_PERSON;

    return `
      <div id="manuel-header">
        <div id="manuel-header-avatar">${avatarHtml}</div>
        <div id="manuel-header-info">
          <h3>Manuel — hôma</h3>
          <p><span class="manuel-online"></span>Assistente de decoração</p>
        </div>
        <button id="manuel-close" title="Fechar">${ICON_X}</button>
      </div>
      <div id="manuel-messages"></div>
      <div id="manuel-input-area">
        <div id="manuel-image-preview"></div>
        <div id="manuel-input-row">
          <div id="manuel-input-box">
            <button id="manuel-img-btn" title="Enviar foto do espaço">${ICON_IMG}</button>
            <input type="file" id="manuel-img-input" accept="image/*" multiple />
            <textarea id="manuel-textarea" rows="1" placeholder="Pergunta ao Manuel…"></textarea>
          </div>
          <button id="manuel-send" title="Enviar">${ICON_SEND}</button>
        </div>
      </div>`;
  }

  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById('manuel-panel');
    const badge = document.getElementById('manuel-badge');
    if (isOpen) {
      panel.classList.add('open');
      badge.style.display = 'none';
      document.getElementById('manuel-textarea').focus();
    } else {
      panel.classList.remove('open');
      panel.style.animation = 'none';
    }
  }

  // ── Welcome ──────────────────────────────────────────────────────────────────
  function showWelcome() {
    const msg = {
      role: 'assistant',
      content: 'Olá! Sou o **Manuel**, assistente de decoração da hôma. 👋\n\nPosso ajudar-te a encontrar o produto certo ou a criar um projeto para a tua casa.\n\nO que preferes?'
    };
    history.push(msg);
    appendMessage(msg, true);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function appendMessage(msg, showQR = false, products = []) {
    const container = document.getElementById('manuel-messages');
    const isBot = msg.role === 'assistant';
    const row = document.createElement('div');
    row.className = `manuel-msg-row ${isBot ? '' : 'user'}`;

    const avatarHtml = isBot
      ? `<div class="manuel-avatar-sm">${AVATAR_URL ? `<img src="${AVATAR_URL}" alt="Manuel"/>` : ICON_PERSON}</div>`
      : `<div class="manuel-avatar-sm user-sm">${ICON_PERSON}</div>`;

    let bubbleContent = '';

    // Images in user msg
    if (msg._imgs && msg._imgs.length) {
      msg._imgs.forEach(img => {
        bubbleContent += `<img class="attached" src="${img}" alt="foto" />`;
      });
    }

    // Text with basic markdown (bold)
    const text = (typeof msg.content === 'string' ? msg.content : '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
    bubbleContent += text;

    const now = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    let extras = '';
    // Product cards
    if (products.length) {
      extras += `<div class="manuel-products">${products.map(p => `
        <a href="${p.url}" target="_blank" rel="noopener" class="manuel-product-card">
          ${p.image
            ? `<img class="manuel-product-img" src="${p.image}" alt="${p.name}" onerror="this.parentNode.innerHTML='<div class=manuel-product-placeholder>${ICON_PRODUCT}</div>'" />`
            : `<div class="manuel-product-placeholder">${ICON_PRODUCT}</div>`}
          <div class="manuel-product-info">
            <div class="manuel-product-name">${p.name}</div>
            ${p.price ? `<div class="manuel-product-price">${p.price}</div>` : ''}
            <div class="manuel-product-link">${ICON_LINK} Ver produto</div>
          </div>
        </a>`).join('')}</div>`;
    }
    // Quick replies
    if (showQR && isBot) {
      extras += `<div class="manuel-quick-replies">
        <button class="manuel-qr" onclick="manuelQuickReply('Procuro um produto específico')">🔍 Produto específico</button>
        <button class="manuel-qr" onclick="manuelQuickReply('Preciso de ajuda com um projeto de decoração')">🏡 Projeto de decoração</button>
        <button class="manuel-qr" onclick="manuelQuickReply('Vou enviar uma foto do meu espaço')">📸 Enviar foto</button>
      </div>`;
    }

    const wrapHtml = `
      <div class="manuel-bubble-wrap">
        <div class="manuel-bubble ${isBot ? 'bot' : 'user'}">${bubbleContent}</div>
        ${extras}
        <div class="manuel-time">${now}</div>
      </div>`;

    row.innerHTML = isBot ? avatarHtml + wrapHtml : wrapHtml + avatarHtml;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('manuel-messages');
    const row = document.createElement('div');
    row.className = 'manuel-msg-row';
    row.id = 'manuel-typing-row';
    row.innerHTML = `
      <div class="manuel-avatar-sm">${AVATAR_URL ? `<img src="${AVATAR_URL}" alt="Manuel"/>` : ICON_PERSON}</div>
      <div class="manuel-typing"><span></span><span></span><span></span></div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('manuel-typing-row');
    if (el) el.remove();
  }

  // ── Quick reply (global) ─────────────────────────────────────────────────────
  window.manuelQuickReply = function (text) {
    document.getElementById('manuel-textarea').value = text;
    sendMessage();
  };

  // ── Image upload ─────────────────────────────────────────────────────────────
  function handleImageUpload(e) {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const id = Date.now() + Math.random();
        pendingImgs.push({ id, dataUrl: ev.target.result, base64: ev.target.result.split(',')[1], mimeType: file.type });
        renderPreviews();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function renderPreviews() {
    const bar = document.getElementById('manuel-image-preview');
    bar.innerHTML = pendingImgs.map(img => `
      <div class="manuel-preview-wrap">
        <img src="${img.dataUrl}" alt="preview" />
        <button class="manuel-preview-rm" onclick="manuelRemoveImg('${img.id}')">✕</button>
      </div>`).join('');
  }

  window.manuelRemoveImg = function (id) {
    pendingImgs = pendingImgs.filter(i => i.id != id);
    renderPreviews();
  };

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (isSending) return;
    const ta = document.getElementById('manuel-textarea');
    const text = ta.value.trim();
    const imgs = [...pendingImgs];
    if (!text && !imgs.length) return;

    isSending = true;
    ta.value = '';
    ta.style.height = 'auto';
    pendingImgs = [];
    renderPreviews();
    document.getElementById('manuel-send').disabled = true;

    // Build API content
    const userContent = [];
    imgs.forEach(img => userContent.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } }));
    if (text) userContent.push({ type: 'text', text });

    // Show user message
    const userMsg = { role: 'user', content: userContent, _imgs: imgs.map(i => i.dataUrl), _text: text };
    history.push({ role: 'user', content: userContent });
    appendMessage({ role: 'user', content: text, _imgs: imgs.map(i => i.dataUrl) });

    showTyping();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      removeTyping();

      history.push({ role: 'assistant', content: data.text || '' });
      appendMessage({ role: 'assistant', content: data.text || 'Peço desculpa, não consegui responder.' }, false, data.products || []);

    } catch (err) {
      removeTyping();
      console.error('Manuel widget error:', err);
      appendMessage({ role: 'assistant', content: 'Peço desculpa, ocorreu um problema técnico. Tenta novamente! 🙏' });
    }

    isSending = false;
    document.getElementById('manuel-send').disabled = false;
    document.getElementById('manuel-textarea').focus();
  }

  function autoResize() {
    const ta = document.getElementById('manuel-textarea');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
  }

  // ── Boot ─────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
