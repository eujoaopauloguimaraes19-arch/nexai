import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Sparkles, Plus, Search, Image as ImageIcon, Globe, FileText, Code2, Mic,
  Send, Paperclip, Settings, Menu, X, ChevronDown, Copy, Check, Trash2,
  Download, ExternalLink, MessageSquare, Sun, Moon, Volume2, StopCircle,
  WandSparkles, PanelLeftClose, Bot, User, LoaderCircle, KeyRound, ShieldCheck
} from 'lucide-react';
import './styles.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const STORAGE = {
  chats: 'nexai_chats_v1',
  key: 'nexai_openrouter_key',
  model: 'nexai_model',
  theme: 'nexai_theme'
};
const DEFAULT_MODEL = 'openrouter/free';
const starterPrompts = [
  { icon: MessageSquare, title: 'Tire uma dúvida', text: 'Explique um assunto difícil de forma simples.' },
  { icon: ImageIcon, title: 'Crie uma imagem', text: 'Crie uma imagem cinematográfica de uma cidade futurista à noite.' },
  { icon: Code2, title: 'Crie um site', text: 'Crie um site moderno para uma loja de tênis.' },
  { icon: Globe, title: 'Pesquise na web', text: 'Pesquise informações recentes sobre inteligência artificial.' }
];

function makeChat() {
  return { id: crypto.randomUUID(), title: 'Nova conversa', messages: [], updatedAt: Date.now() };
}
function readChats() {
  try { return JSON.parse(localStorage.getItem(STORAGE.chats) || '[]'); } catch { return []; }
}
function saveChats(chats) { localStorage.setItem(STORAGE.chats, JSON.stringify(chats)); }
function getTitle(text) {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 34 ? clean.slice(0, 34) + '…' : clean || 'Nova conversa';
}
function cleanImagePrompt(text) {
  return text.replace(/^(crie|gerar|gere|faça|fazer|produza)\s+(uma\s+)?imagem\s*(de|do|da|sobre)?\s*/i, '').trim() || text;
}

function App() {
  const [chats, setChats] = useState(() => readChats());
  const [activeId, setActiveId] = useState(() => readChats()[0]?.id || null);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE.key) || '');
  const [model, setModel] = useState(() => localStorage.getItem(STORAGE.model) || DEFAULT_MODEL);
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE.theme) || 'dark');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('chat');
  const [attachment, setAttachment] = useState(null);
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [listening, setListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [webResults, setWebResults] = useState(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeChat = chats.find(c => c.id === activeId) || null;
  const messages = activeChat?.messages || [];
  const filteredChats = useMemo(() => chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())), [chats, searchQuery]);

  useEffect(() => {
    saveChats(chats);
    if (!activeId && chats.length) setActiveId(chats[0].id);
  }, [chats]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem(STORAGE.theme, theme); }, [theme]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy, webResults, imageUrl]);
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function updateActive(mutator) {
    setChats(prev => prev.map(c => c.id === activeId ? mutator(c) : c));
  }
  function newChat() {
    const c = makeChat();
    setChats(prev => [c, ...prev]);
    setActiveId(c.id);
    setInput('');
    setAttachment(null);
    setMode('chat');
    setWebResults(null);
    setImageUrl('');
    setSidebarOpen(false);
  }
  function deleteChat(id) {
    const next = chats.filter(c => c.id !== id);
    setChats(next);
    if (activeId === id) setActiveId(next[0]?.id || null);
  }
  function ensureChat() {
    if (activeId && chats.some(c => c.id === activeId)) return activeId;
    const c = makeChat();
    setChats(prev => [c, ...prev]);
    setActiveId(c.id);
    return c.id;
  }
  function appendMessages(id, newMessages, titleText) {
    setChats(prev => prev.map(c => c.id === id ? {
      ...c,
      title: c.messages.length === 0 && titleText ? getTitle(titleText) : c.title,
      messages: [...c.messages, ...newMessages],
      updatedAt: Date.now()
    } : c));
  }
  async function callAI(allMessages, systemExtra = '') {
    if (!apiKey.trim()) {
      throw new Error('Adicione sua chave de API do OpenRouter nas Configurações. Você pode começar com modelos gratuitos quando disponíveis.');
    }
    const system = `Você é a NEXAI, uma assistente útil, honesta e inteligente. Responda em português brasileiro por padrão. Organize respostas longas com títulos e listas. Se não souber algo, diga claramente. Para código, entregue exemplos completos e explique como executar. Não afirme ter pesquisado na internet se a pesquisa não foi feita.${systemExtra ? '\n' + systemExtra : ''}`;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || DEFAULT_MODEL, messages: [{ role: 'system', content: system }, ...allMessages], temperature: 0.7, stream: false })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Falha na API (${response.status}). Confira a chave e o modelo.`);
    return data?.choices?.[0]?.message?.content || 'Não consegui gerar uma resposta. Tente novamente.';
  }
  async function sendMessage(textOverride) {
    const text = (textOverride ?? input).trim();
    if ((!text && !attachment) || busy) return;
    const id = ensureChat();
    const userText = text || 'Analise o arquivo anexado.';
    const attached = attachment;
    const userMessage = { id: crypto.randomUUID(), role: 'user', content: userText, attachment: attached ? { name: attached.name, text: attached.text?.slice(0, 12000) } : null };
    setInput('');
    setAttachment(null);
    setBusy(true);
    setMode('chat');
    setWebResults(null);
    setImageUrl('');
    appendMessages(id, [userMessage], userText);
    try {
      const current = (chats.find(c => c.id === id)?.messages || []).map(m => ({ role: m.role, content: m.content }));
      const fileContext = attached?.text ? `\nO usuário anexou o arquivo "${attached.name}". Conteúdo extraído (pode estar truncado):\n${attached.text.slice(0, 12000)}` : '';
      const answer = await callAI([...current, { role: 'user', content: userText + fileContext }]);
      setChats(prev => prev.map(c => c.id === id ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), role: 'assistant', content: answer }], updatedAt: Date.now() } : c));
    } catch (err) {
      setChats(prev => prev.map(c => c.id === id ? { ...c, messages: [...c.messages, { id: crypto.randomUUID(), role: 'assistant', content: `**Não consegui concluir a solicitação.**\n\n${err.message}\n\nAbra **Configurações** para configurar sua API. A chave fica salva somente neste navegador.` }], updatedAt: Date.now() } : c));
    } finally { setBusy(false); inputRef.current?.focus(); }
  }
  async function doWebSearch(queryOverride) {
    const q = (queryOverride ?? searchQuery).trim();
    if (!q) return;
    setSearchQuery(q); setMode('web'); setBusy(true); setWebResults(null);
    try {
      // DuckDuckGo Instant Answer is a free public endpoint; it does not provide comprehensive web search.
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('A pesquisa não respondeu.');
      const data = await res.json();
      const results = [];
      if (data.AbstractText) results.push({ title: data.Heading || q, text: data.AbstractText, url: data.AbstractURL, source: data.AbstractSource || 'DuckDuckGo' });
      for (const item of (data.RelatedTopics || [])) {
        if (item.Text && item.FirstURL) results.push({ title: item.Text.split(' - ')[0].slice(0, 100), text: item.Text, url: item.FirstURL, source: 'DuckDuckGo' });
        if (item.Topics) for (const sub of item.Topics) if (sub.Text && sub.FirstURL) results.push({ title: sub.Text.split(' - ')[0].slice(0, 100), text: sub.Text, url: sub.FirstURL, source: 'DuckDuckGo' });
      }
      setWebResults({ query: q, results: results.slice(0, 8), empty: results.length === 0 });
    } catch (err) {
      setWebResults({ query: q, results: [], error: `${err.message} Você ainda pode pedir uma pesquisa à IA pelo chat, mas resultados web exigem uma conexão disponível.` });
    } finally { setBusy(false); }
  }
  function createImage() {
    const prompt = imagePrompt.trim();
    if (!prompt || imageBusy) return;
    setImageBusy(true); setImageUrl('');
    // Public image endpoint; availability, safety policies, and quality depend on the external provider.
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
    setImageUrl(url);
    setImageBusy(false);
  }
  async function extractFile(file) {
    if (!file) return;
    setNotice('');
    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const bytes = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const pages = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages.push(content.items.map(x => x.str).join(' '));
        }
        text = pages.join('\n\n');
      } else if (file.type.startsWith('text/') || /\.(txt|md|csv|json|html|css|js|jsx|ts|tsx|py|xml|log)$/i.test(file.name)) {
        text = await file.text();
      } else if (file.type.startsWith('image/')) {
        setAttachment({ name: file.name, text: '', imageUrl: URL.createObjectURL(file) });
        setNotice('Imagem anexada. Para análise visual, o modelo/API escolhido precisa aceitar imagens; esta versão envia o texto extraído de documentos.');
        return;
      } else {
        throw new Error('Formato ainda não suportado para extração. Use PDF, TXT, MD, CSV, JSON ou arquivos de código.');
      }
      setAttachment({ name: file.name, text: text.slice(0, 20000) });
      setNotice(text.length > 20000 ? 'Arquivo lido; o texto foi limitado a 20.000 caracteres.' : 'Arquivo pronto para análise.');
    } catch (err) { setNotice(err.message || 'Não foi possível ler o arquivo.'); }
  }
  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setNotice('Seu navegador não oferece reconhecimento de voz. Tente Chrome ou Edge atualizado.'); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = e => setInput(Array.from(e.results).map(r => r[0].transcript).join(''));
    rec.onerror = () => { setListening(false); setNotice('Não foi possível reconhecer a voz. Verifique a permissão do microfone.'); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec; rec.start(); setListening(true);
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { setNotice('Seu navegador não oferece leitura em voz alta.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*`_]/g, ''));
    utterance.lang = 'pt-BR'; window.speechSynthesis.speak(utterance);
  }
  async function copyText(msg) {
    await navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 1500);
  }
  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null);
  }

  return <div className="app-shell">
    {sidebarOpen && <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><span>NEX<span className="brand-accent">AI</span></span><button className="icon-btn mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={17}/> Nova conversa <span className="shortcut">⌘ K</span></button>
      <div className="side-search"><Search size={15}/><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar conversas"/></div>
      <div className="side-label">FERRAMENTAS</div>
      <nav className="tool-nav">
        <button className={mode === 'chat' ? 'nav-item active' : 'nav-item'} onClick={() => { setMode('chat'); setWebResults(null); }}><MessageSquare size={17}/> Chat inteligente</button>
        <button className={mode === 'image' ? 'nav-item active' : 'nav-item'} onClick={() => setMode('image')}><ImageIcon size={17}/> Criar imagens <span className="tiny-tag">BETA</span></button>
        <button className={mode === 'web' ? 'nav-item active' : 'nav-item'} onClick={() => setMode('web')}><Globe size={17}/> Pesquisa web</button>
        <button className="nav-item" onClick={() => fileRef.current?.click()}><FileText size={17}/> Analisar arquivo</button>
        <button className="nav-item" onClick={() => { setMode('chat'); setInput('Ajude-me a criar um site profissional. Forneça o código completo e instruções para executar.'); inputRef.current?.focus(); }}><Code2 size={17}/> Criar código ou site</button>
      </nav>
      <div className="side-label history-label">RECENTES <span>{filteredChats.length}</span></div>
      <div className="history-list">
        {filteredChats.map(c => <div key={c.id} className={`history-row ${c.id === activeId ? 'selected' : ''}`}>
          <button onClick={() => { setActiveId(c.id); setMode('chat'); setWebResults(null); setImageUrl(''); setSidebarOpen(false); }}><MessageSquare size={15}/><span>{c.title}</span></button>
          <button className="delete-chat" aria-label="Excluir conversa" onClick={() => deleteChat(c.id)}><Trash2 size={14}/></button>
        </div>)}
        {filteredChats.length === 0 && <div className="empty-history">Suas conversas aparecerão aqui.</div>}
      </div>
      <div className="sidebar-bottom">
        <div className="plan-card"><div className="plan-icon"><Sparkles size={16}/></div><div><strong>NEXAI pessoal</strong><span>Configure sua IA</span></div><button onClick={() => setSettingsOpen(true)} aria-label="Configurações"><Settings size={16}/></button></div>
        <button className="profile-row" onClick={() => setSettingsOpen(true)}><div className="avatar">N</div><div className="profile-copy"><strong>Meu espaço</strong><span>Configurações e API</span></div><ChevronDown size={16}/></button>
      </div>
    </aside>}
    <main className="main-panel">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Alternar menu">{sidebarOpen ? <PanelLeftClose size={19}/> : <Menu size={19}/>}</button><span className="topbar-title">{mode === 'image' ? 'Criar imagens' : mode === 'web' ? 'Pesquisa na web' : 'Assistente IA'}</span><span className="model-pill"><span className="status-dot"></span>{model === DEFAULT_MODEL ? 'Modelo gratuito*' : model.split('/').pop()}</span></div>
        <div className="topbar-actions"><button className="icon-btn" title="Alternar tema" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="settings-btn" onClick={() => setSettingsOpen(true)}><Settings size={16}/><span>Configurações</span></button></div>
      </header>

      <div className="content-area">
        {mode === 'image' ? <section className="image-workspace">
          <div className="workspace-eyebrow"><WandSparkles size={15}/> ESTÚDIO CRIATIVO</div>
          <h1>Imagine. <span>Crie.</span></h1><p className="workspace-subtitle">Transforme suas ideias em imagens com inteligência artificial.</p>
          <div className="image-prompt-card"><label>Descreva a imagem que você quer criar</label><textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Ex.: um tênis futurista flutuando em um estúdio escuro, iluminação azul cinematográfica..." rows={4}/><div className="prompt-footer"><span><Sparkles size={14}/> Seja específico para melhores resultados</span><button className="primary-btn" onClick={createImage} disabled={!imagePrompt.trim() || imageBusy}>{imageBusy ? <LoaderCircle className="spin" size={16}/> : <WandSparkles size={16}/>} Gerar imagem</button></div></div>
          {imageUrl && <div className="generated-image-card"><div className="generated-image-head"><span><Sparkles size={16}/> Sua criação</span><a href={imageUrl} download="nexai-imagem.png" target="_blank" rel="noreferrer"><Download size={15}/> Abrir / baixar</a></div><img src={imageUrl} alt={imagePrompt} onError={() => setNotice('O serviço de imagens pode estar indisponível. Tente novamente mais tarde.')}/><p>{imagePrompt}</p></div>}
          <div className="image-notice"><ShieldCheck size={17}/><span>Geração via serviço externo gratuito sujeito a limites, disponibilidade e políticas do provedor.</span></div>
        </section> : mode === 'web' ? <section className="web-workspace">
          <div className="workspace-eyebrow"><Globe size={15}/> BUSCA E DESCOBERTA</div><h1>Explore a <span>internet.</span></h1><p className="workspace-subtitle">Encontre respostas e links úteis na web.</p>
          <form className="web-search-form" onSubmit={e => { e.preventDefault(); doWebSearch(); }}><Search size={20}/><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="O que você quer pesquisar?"/><button className="primary-btn" disabled={!searchQuery.trim() || busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>} Pesquisar</button></form>
          <p className="web-disclaimer">A busca instantânea gratuita pode não retornar todos os resultados da web.</p>
          {webResults && <div className="web-results"><h2>Resultados para “{webResults.query}”</h2>{webResults.error ? <div className="inline-error">{webResults.error}</div> : webResults.empty ? <div className="empty-results">Nenhum resultado instantâneo encontrado. Tente uma consulta mais específica ou outro mecanismo de busca.</div> : webResults.results.map((r, i) => <article className="web-result" key={i}><div className="result-source"><Globe size={13}/>{r.source}</div><a href={r.url} target="_blank" rel="noreferrer">{r.title} <ExternalLink size={13}/></a><p>{r.text}</p><small>{r.url}</small></article>)}</div>}
        </section> : messages.length === 0 ? <section className="welcome">
          <div className="welcome-orb"><div className="orb-core"><Sparkles size={28}/></div><div className="orb-ring ring-one"></div><div className="orb-ring ring-two"></div></div>
          <div className="welcome-kicker"><span className="status-dot"></span> SUA INTELIGÊNCIA ARTIFICIAL PESSOAL</div>
          <h1>Olá! Sou a <span>NEXAI.</span></h1><p className="welcome-subtitle">O que vamos criar hoje?</p>
          <div className="starter-grid">{starterPrompts.map(({icon: Icon, title, text}) => <button key={title} className="starter-card" onClick={() => { if (title === 'Crie uma imagem') { setImagePrompt(text.replace('Crie uma imagem ', '')); setMode('image'); } else if (title === 'Pesquise na web') { setSearchQuery('inteligência artificial'); setMode('web'); } else { setInput(text); inputRef.current?.focus(); } }}><span className="starter-icon"><Icon size={18}/></span><strong>{title}</strong><span>{text}</span><span className="card-arrow">↗</span></button>)}</div>
          {!apiKey && <button className="setup-hint" onClick={() => setSettingsOpen(true)}><KeyRound size={16}/> Configure uma chave de IA para ativar o chat inteligente <span>Configurar →</span></button>}
        </section> : <section className="conversation">
          <div className="message-list">{messages.map(msg => <div className={`message-row ${msg.role}`} key={msg.id}><div className={`message-avatar ${msg.role}`}>{msg.role === 'assistant' ? <Sparkles size={16}/> : <User size={16}/>}</div><div className="message-body"><div className="message-author">{msg.role === 'assistant' ? 'NEXAI' : 'Você'}</div>{msg.attachment && <div className="attachment-chip"><FileText size={14}/>{msg.attachment.name}</div>}<div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }}/>{msg.role === 'assistant' && <div className="message-tools"><button onClick={() => copyText(msg)}>{copiedId === msg.id ? <Check size={14}/> : <Copy size={14}/>} {copiedId === msg.id ? 'Copiado' : 'Copiar'}</button><button onClick={() => speak(msg.content)}><Volume2 size={14}/> Ouvir</button></div>}</div></div>)}{busy && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={16}/></div><div className="message-body"><div className="message-author">NEXAI</div><div className="thinking"><span></span><span></span><span></span> Pensando...</div></div></div>}<div ref={bottomRef}/></div>
        </section>}
      </div>

      {mode !== 'image' && mode !== 'web' && <div className={`composer-wrap ${messages.length === 0 ? 'composer-home' : ''}`}>
        {attachment && <div className="attachment-preview"><FileText size={15}/><span>{attachment.name}</span><button onClick={() => setAttachment(null)}><X size={14}/></button></div>}
        {notice && <div className="notice-line">{notice}<button onClick={() => setNotice('')}><X size={13}/></button></div>}
        <div className="composer"><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Pergunte qualquer coisa à NEXAI..." rows={1}/><div className="composer-actions"><div className="composer-left"><button className="composer-icon" onClick={() => fileRef.current?.click()} title="Anexar arquivo"><Paperclip size={18}/></button><button className={`composer-icon ${listening ? 'recording' : ''}`} onClick={startVoice} title="Falar com a NEXAI"><Mic size={18}/></button><button className="mode-chip" onClick={() => setMode('web')}><Globe size={14}/> Pesquisar</button></div><button className="send-btn" disabled={busy || (!input.trim() && !attachment)} onClick={() => sendMessage()} aria-label="Enviar mensagem">{busy ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}</button></div></div>
        <div className="composer-footnote">A NEXAI pode cometer erros. Confira informações importantes. <span>Enter para enviar · Shift + Enter para nova linha</span></div>
      </div>}
      {mode === 'image' && <div className="bottom-small"><span><Sparkles size={13}/> NEXAI Studio</span><button onClick={() => setMode('chat')}>Voltar ao chat <span>→</span></button></div>}
      {mode === 'web' && <div className="bottom-small"><span><Globe size={13}/> Pesquisa instantânea</span><button onClick={() => setMode('chat')}>Voltar ao chat <span>→</span></button></div>}
    </main>
    <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md,.csv,.json,.html,.css,.js,.jsx,.ts,.tsx,.py,.xml,.log,image/*" onChange={e => { extractFile(e.target.files?.[0]); e.target.value = ''; }}/>
    {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}><section className="settings-modal"><div className="modal-head"><div><span className="workspace-eyebrow"><Settings size={14}/> PERSONALIZAÇÃO</span><h2>Configurações</h2><p>Configure os serviços para ativar os recursos da NEXAI.</p></div><button className="icon-btn" onClick={() => setSettingsOpen(false)}><X size={19}/></button></div>
      <div className="settings-section"><label className="settings-label"><KeyRound size={16}/> Chave de API do OpenRouter</label><input className="settings-input" type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem(STORAGE.key, e.target.value); }} placeholder="sk-or-v1-..."/><p>Obtenha uma chave em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys <ExternalLink size={12}/></a>. Escolha um modelo gratuito disponível na sua conta. A chave é guardada no armazenamento local deste navegador e usada diretamente nas chamadas de API.</p></div>
      <div className="settings-section"><label className="settings-label"><Bot size={16}/> Modelo de linguagem</label><input className="settings-input" value={model} onChange={e => { setModel(e.target.value); localStorage.setItem(STORAGE.model, e.target.value); }} placeholder="openrouter/free"/><p>O seletor openrouter/free encaminha para um modelo gratuito disponível, se houver. Modelos, limites e disponibilidade mudam. Você pode informar um ID de modelo suportado pelo OpenRouter.</p></div>
      <div className="settings-section privacy-note"><ShieldCheck size={18}/><div><strong>Privacidade e custos</strong><p>Não coloque segredos de outras pessoas aqui. A chave permanece neste navegador, mas pode ser acessada por quem usa este perfil do navegador. O provedor de IA recebe suas mensagens. Serviços externos gratuitos podem ter limites, mudar ou ficar indisponíveis.</p></div></div>
      {installPrompt && <button className="primary-btn install-btn" onClick={installApp}>Instalar NEXAI no dispositivo</button>}
      <div className="modal-actions"><button className="secondary-btn" onClick={() => { localStorage.removeItem(STORAGE.key); setApiKey(''); }}>Remover chave</button><button className="primary-btn" onClick={() => { setSettingsOpen(false); setNotice('Configurações salvas neste navegador.'); }}>Salvar e fechar</button></div>
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);