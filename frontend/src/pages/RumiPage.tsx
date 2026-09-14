import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, streamApi } from "../lib/api";

type Message = { role: "user" | "assistant"; content: string; created_at?: string };
type Conversation = { id: string; title: string; created_at: string; updated_at: string };

const starters = [
  "Which contractors are not ready right now?",
  "What evidence needs attention?",
  "How do I create a contractor?",
];

const allowedRumiRoutes = new Set(["/dashboard", "/projects", "/contractors", "/requirements", "/evidence", "/readiness", "/remediation", "/rumi", "/insights", "/notifications", "/team", "/settings", "/billing", "/usage", "/audit"]);

function RumiContent({ content }: { content: string }) {
  const navigate = useNavigate();
  const parts = content.split(/(\[[^\]]+\]\([^\s)]+\))/g);
  return <>{parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (!match) return <span key={index}>{part}</span>;
    const [, label, route] = match;
    if (!allowedRumiRoutes.has(route)) return <span key={index}>{part}</span>;
    return <button key={index} type="button" className="rumi-action-link" onClick={() => navigate(route)}>{label}<span>→</span></button>;
  })}</>;
}

function conversationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date);
}

export default function RumiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingPromptRef = useRef<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending && !loadingHistory && !loadingConversation, [input, sending, loadingHistory, loadingConversation]);
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((item) => item.title.toLowerCase().includes(query));
  }, [conversations, search]);

  async function loadConversation(id: string, list = conversations) {
    setLoadingConversation(true);
    setError("");
    try {
      const selected = list.find((item) => item.id === id) ?? await api<Conversation>(`/api/rumi/conversations/${id}`);
      const history = await api<Message[]>(`/api/rumi/conversations/${id}/messages`);
      setConversation(selected);
      setMessages(history.map((item) => ({ role: item.role, content: item.content, created_at: item.created_at })));
      setMenuId(null);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rumi conversation could not be loaded.");
    } finally {
      setLoadingConversation(false);
      setLoadingHistory(false);
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    pendingPromptRef.current = prompt?.trim() || null;
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const list = await api<Conversation[]>("/api/rumi/conversations");
        if (!active) return;
        setConversations(list);
        const current = list[0] ?? await api<Conversation>("/api/rumi/conversations/current");
        const nextList = list.length ? list : [current];
        setConversations(nextList);
        await loadConversation(current.id, nextList);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Rumi history could not be loaded.");
          setLoadingHistory(false);
        }
      }
    }
    void loadHistory();
    return () => { active = false; };
  // loadConversation is intentionally used only for initial hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prompt = pendingPromptRef.current;
    if (!prompt || loadingHistory || loadingConversation || !conversation) return;
    setInput(prompt);
    pendingPromptRef.current = null;
    setSearchParams({}, { replace: true });
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [conversation, loadingHistory, loadingConversation, setSearchParams]);

  async function newChat() {
    if (sending || loadingConversation) return;
    setError("");
    setMenuId(null);
    setEditingId(null);
    try {
      const created = await api<Conversation>("/api/rumi/conversations", { method: "POST", body: JSON.stringify({}) });
      setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setConversation(created);
      setMessages([]);
      setInput("");
      setSearch("");
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A new Rumi conversation could not be created.");
    }
  }

  async function renameConversation(id: string) {
    const title = editingTitle.trim();
    if (!title) return;
    try {
      const updated = await api<Conversation>(`/api/rumi/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setConversations((current) => current.map((item) => item.id === id ? updated : item));
      if (conversation?.id === id) setConversation(updated);
      setEditingId(null);
      setEditingTitle("");
      setMenuId(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The conversation could not be renamed.");
    }
  }

  function cancelRename() {
    setEditingId(null);
    setEditingTitle("");
    setMenuId(null);
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Delete this Rumi conversation? This cannot be undone.")) return;
    try {
      await api<void>(`/api/rumi/conversations/${id}`, { method: "DELETE" });
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      setMenuId(null);
      if (conversation?.id === id) {
        if (remaining[0]) await loadConversation(remaining[0].id, remaining);
        else await newChat();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The conversation could not be deleted.");
    }
  }

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || sending || loadingHistory || loadingConversation) return;
    let activeConversation = conversation;
    if (!activeConversation) {
      activeConversation = await api<Conversation>("/api/rumi/conversations/current");
      setConversation(activeConversation);
      setConversations((current) => current.some((item) => item.id === activeConversation?.id) ? current : [activeConversation as Conversation, ...current]);
    }
    const next: Message[] = [...messages.slice(-19), { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setError("");
    setSending(true);
    try {
      await streamApi("/api/rumi/chat", { conversation_id: activeConversation.id, messages: next.map(({ role, content: value }) => ({ role, content: value })) }, (token) => {
        setMessages((current) => {
          const copy = [...current];
          const last = copy.length - 1;
          copy[last] = { ...copy[last], content: copy[last].content + token };
          return copy;
        });
      });
      const refreshed = await api<Conversation>(`/api/rumi/conversations/${activeConversation.id}`);
      setConversation(refreshed);
      setConversations((current) => [refreshed, ...current.filter((item) => item.id !== refreshed.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rumi could not complete that request.");
      setMessages((current) => current.slice(0, -1));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(); }

  return <>
    <style>{styles}</style>
    <section className="rumi-page">
      <header className="rumi-page-header">
        <div><span className="rumi-eyebrow">INTELLIGENCE · RUMI</span><h1>Rumi</h1><p>Your compliance intelligence assistant. Ask about readiness, evidence, decisions, AGATA workflows, or previous Rumi conversations.</p></div>
        <div className="rumi-header-actions"><button type="button" className="rumi-new-chat" onClick={() => void newChat()} disabled={sending || loadingConversation}>＋ New chat</button><div className="rumi-status"><span/> {loadingHistory || loadingConversation ? "Loading" : "Conversation saved"}</div></div>
      </header>
      <div className="rumi-workspace">
        <aside className="rumi-history">
          <div className="rumi-history-head"><div><span className="rumi-eyebrow">YOUR RUMI</span><h2>Past chats</h2></div><button type="button" aria-label="Start new chat" onClick={() => void newChat()} disabled={sending || loadingConversation}>＋</button></div>
          <label className="rumi-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search Rumi conversations"/></label>
          <div className="rumi-history-list">
            {loadingHistory ? <div className="rumi-history-empty">Loading conversations…</div> : filteredConversations.length === 0 ? <div className="rumi-history-empty">{search ? "No matching conversations." : "No past chats yet."}</div> : filteredConversations.map((item) => <div className={`rumi-history-item ${conversation?.id === item.id ? "active" : ""}`} key={item.id}>
              {editingId === item.id ? <form className="rumi-rename" onSubmit={(event) => { event.preventDefault(); void renameConversation(item.id); }}><input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancelRename(); } }}/><div className="rumi-rename-actions"><button type="submit" className="save" disabled={!editingTitle.trim()}>Save</button><button type="button" className="cancel" onClick={cancelRename}>Cancel</button></div></form> : <button type="button" className="rumi-history-select" onClick={() => void loadConversation(item.id)}><strong>{item.title}</strong><span>{conversationDate(item.updated_at)}</span></button>}
              {editingId !== item.id && <button type="button" className="rumi-more" aria-label={`Actions for ${item.title}`} onClick={() => setMenuId(menuId === item.id ? null : item.id)}>•••</button>}
              {menuId === item.id && editingId !== item.id && <div className="rumi-menu"><button type="button" onClick={() => { setEditingId(item.id); setEditingTitle(item.title); setMenuId(null); }}>Rename</button><button type="button" className="danger" onClick={() => void deleteConversation(item.id)}>Delete</button></div>}
            </div>)}
          </div>
          <div className="rumi-memory-note"><span>↺</span><div><b>Conversation memory</b><p>Rumi can recall your saved conversations when you ask about earlier questions or dates.</p></div></div>
        </aside>

        <main className="rumi-chat-panel">
          <div className="rumi-chat-head"><div className="rumi-avatar">R</div><div><strong>{conversation?.title || "Rumi"}</strong><span>AGATA compliance intelligence</span></div></div>
          <div className="rumi-messages">
            {loadingHistory || loadingConversation ? <div className="rumi-loading">Restoring your Rumi conversation…</div> : messages.length === 0 ? <div className="rumi-welcome"><div className="rumi-welcome-mark">R</div><h2>What do you need to know?</h2><p>Rumi can explain live workspace intelligence, guide you through AGATA, and recall your saved Rumi conversations.</p><div className="rumi-starters">{starters.map((starter) => <button key={starter} type="button" onClick={() => void sendMessage(starter)}>{starter}<span>→</span></button>)}</div></div> : messages.map((message, index) => <div className={`rumi-message ${message.role}`} key={`${index}-${message.role}-${message.created_at ?? "live"}`}><div className="rumi-message-label">{message.role === "user" ? "You" : "Rumi"}</div><div className="rumi-message-body">{message.content ? <RumiContent content={message.content} /> : (sending && index === messages.length - 1 ? "Thinking…" : "")}</div></div>)}
          </div>
          <form className="rumi-composer" onSubmit={submit}><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Ask Rumi about your workspace or previous conversations…" rows={2} disabled={sending || loadingHistory || loadingConversation}/><button type="submit" disabled={!canSend}>{sending ? "Thinking…" : "Ask Rumi"}<span>↗</span></button></form>
          {error && <div className="rumi-error">{error}</div>}
        </main>

        <aside className="rumi-context"><span className="rumi-eyebrow">HOW RUMI WORKS</span><h2>Explain. Guide. Navigate.</h2><p>Rumi combines current AGATA workspace facts with product guidance and your saved conversation history.</p><div className="rumi-context-list"><div><b>Workspace intelligence</b><span>Answer questions using current projects, contractors, requirements, evidence, and readiness.</span></div><div><b>Product guidance</b><span>Learn how to create and manage the things you work with in AGATA.</span></div><div><b>Conversation memory</b><span>Recall earlier Rumi questions and conversations without mixing them into current workspace facts.</span></div><div><b>Navigation actions</b><span>When a relevant workspace exists, Rumi can provide a direct action to open it.</span></div></div></aside>
      </div>
    </section>
  </>;
}

const styles = `
.rumi-page{max-width:1440px;margin:0 auto;padding:34px 28px 50px;color:#e8eef7}.rumi-page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px}.rumi-eyebrow{display:block;color:#7f9bb8;font-size:9px;font-weight:750;letter-spacing:.19em}.rumi-page-header h1{margin:8px 0 7px;font-size:42px;line-height:1;letter-spacing:-.045em}.rumi-page-header p{margin:0;max-width:760px;color:#7890a9;font-size:12px;line-height:1.6}.rumi-header-actions{display:flex;align-items:center;gap:9px}.rumi-new-chat{height:34px;padding:0 12px;border:1px solid #315b7b;border-radius:9px;background:#0c2236;color:#d9e8f4;font-size:10px;font-weight:700;cursor:pointer}.rumi-new-chat:hover:not(:disabled){background:#102d45}.rumi-new-chat:disabled{opacity:.5;cursor:not-allowed}.rumi-status{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #234431;border-radius:999px;background:#091a12;color:#77d4a0;font-size:10px;font-weight:650;white-space:nowrap}.rumi-status span{width:6px;height:6px;border-radius:50%;background:#53d88e;box-shadow:0 0 12px rgba(83,216,142,.55)}.rumi-workspace{display:grid;grid-template-columns:218px minmax(0,1fr) 270px;gap:12px;align-items:stretch}.rumi-history,.rumi-chat-panel,.rumi-context{border:1px solid #1b3044;border-radius:15px;background:#050b13;overflow:hidden}.rumi-history{min-height:650px;display:flex;flex-direction:column}.rumi-history-head{height:66px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 13px;border-bottom:1px solid #172b3c;background:#07111c}.rumi-history-head h2{margin:5px 0 0;color:#dce7f1;font-size:14px;letter-spacing:-.02em}.rumi-history-head>button{width:28px;height:28px;border:1px solid #294a64;border-radius:8px;background:#0b1c2c;color:#9fc2dc;font-size:17px;cursor:pointer}.rumi-history-head>button:hover:not(:disabled){background:#102a40}.rumi-history-head>button:disabled{opacity:.5}.rumi-search{display:flex;align-items:center;gap:7px;margin:11px;padding:0 9px;height:32px;border:1px solid #1b3348;border-radius:8px;background:#07111c;color:#58728a}.rumi-search span{font-size:15px}.rumi-search input{width:100%;border:0;outline:0;background:transparent;color:#cbd8e3;font:500 10px/1 inherit}.rumi-search input::placeholder{color:#4f687f}.rumi-history-list{flex:1;overflow:auto;padding:0 7px 8px}.rumi-history-item{position:relative;display:flex;align-items:center;border:1px solid transparent;border-radius:9px;margin-bottom:3px}.rumi-history-item.active{background:#0a1724;border-color:#1b3449}.rumi-history-select{min-width:0;flex:1;text-align:left;padding:10px 6px 10px 8px;border:0;background:transparent;color:#c9d7e2;cursor:pointer}.rumi-history-select strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:650}.rumi-history-select span{display:block;margin-top:4px;color:#587188;font-size:8px}.rumi-more{width:25px;height:28px;margin-right:3px;border:0;background:transparent;color:#536d84;font-size:10px;cursor:pointer;border-radius:6px}.rumi-more:hover{background:#102236;color:#a6bdcf}.rumi-menu{position:absolute;z-index:5;right:5px;top:35px;min-width:100px;padding:4px;border:1px solid #28465d;border-radius:8px;background:#081420;box-shadow:0 14px 30px rgba(0,0,0,.35)}.rumi-menu button{display:block;width:100%;padding:7px 8px;border:0;border-radius:6px;background:transparent;text-align:left;color:#a9bdcc;font-size:9px;cursor:pointer}.rumi-menu button:hover{background:#102538;color:#dce8f1}.rumi-menu button.danger{color:#d7959e}.rumi-rename{min-width:0;flex:1;padding:7px;display:flex;flex-direction:column;gap:6px}.rumi-rename input{width:100%;box-sizing:border-box;border:1px solid #315b7b;border-radius:6px;outline:0;padding:6px 7px;background:#050d16;color:#dce8f1;font-size:9px}.rumi-rename-actions{display:flex;gap:5px}.rumi-rename-actions button{border:1px solid #294a64;border-radius:6px;padding:5px 8px;font-size:8px;font-weight:700;cursor:pointer}.rumi-rename-actions button.save{background:#0c2236;color:#d9e8f4;border-color:#315b7b}.rumi-rename-actions button.save:hover:not(:disabled){background:#102d45}.rumi-rename-actions button.save:disabled{opacity:.45;cursor:not-allowed}.rumi-rename-actions button.cancel{background:#07111c;color:#7890a9}.rumi-rename-actions button.cancel:hover{background:#0d1d2b;color:#b8cad7}.rumi-history-empty{padding:20px 9px;color:#5e778e;text-align:center;font-size:9px;line-height:1.5}.rumi-memory-note{display:flex;gap:8px;margin:8px;padding:11px;border:1px solid #172d40;border-radius:9px;background:#07111c}.rumi-memory-note>span{color:#7297b2;font-size:13px}.rumi-memory-note b{display:block;color:#b4c6d4;font-size:9px}.rumi-memory-note p{margin:4px 0 0;color:#5c758b;font-size:8px;line-height:1.45}.rumi-chat-panel{min-height:650px;display:flex;flex-direction:column}.rumi-chat-head{height:66px;flex:none;display:flex;align-items:center;gap:11px;padding:0 18px;border-bottom:1px solid #172b3c;background:#07111c}.rumi-avatar,.rumi-welcome-mark{display:grid;place-items:center;border:1px solid #345875;background:#0c2134;color:#a8d2ef;font-weight:800}.rumi-avatar{width:34px;height:34px;border-radius:10px}.rumi-chat-head strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px;color:#dce7f1;font-size:12px}.rumi-chat-head span{display:block;margin-top:3px;color:#5f7891;font-size:9px}.rumi-messages{flex:1;overflow:auto;padding:24px}.rumi-loading{margin:52px auto;text-align:center;color:#718aa1;font-size:11px}.rumi-welcome{max-width:620px;margin:52px auto;text-align:center}.rumi-welcome-mark{width:58px;height:58px;margin:0 auto 17px;border-radius:16px;font-size:20px;box-shadow:0 0 35px rgba(67,142,204,.1)}.rumi-welcome h2{margin:0;color:#e1eaf2;font-size:23px;letter-spacing:-.025em}.rumi-welcome p{max-width:530px;margin:10px auto 22px;color:#6c849b;font-size:11px;line-height:1.6}.rumi-starters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rumi-starters button{min-height:76px;padding:12px;text-align:left;border:1px solid #1d3449;border-radius:10px;background:#07121e;color:#9bb1c4;font-size:10px;cursor:pointer}.rumi-starters button:hover{border-color:#315a78;background:#091827;color:#d5e3ed}.rumi-starters span{display:block;margin-top:10px;color:#4e7797}.rumi-message{max-width:780px;margin-bottom:18px}.rumi-message.user{margin-left:auto}.rumi-message-label{margin-bottom:5px;color:#607a93;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.rumi-message-body{border:1px solid #1b3043;border-radius:11px;padding:13px 15px;background:#091521;color:#c9d6e1;font-size:12px;line-height:1.65;white-space:pre-wrap}.rumi-message.user .rumi-message-body{background:#0d2032;border-color:#294864;color:#dce9f4}.rumi-action-link{display:inline-flex;align-items:center;gap:8px;margin:10px 4px 2px 0;padding:7px 10px;border:1px solid #315b7b;border-radius:8px;background:#0c2236;color:#d9e8f4;font:700 10px/1.2 inherit;cursor:pointer;white-space:nowrap}.rumi-action-link:hover{background:#102d45;border-color:#46789e}.rumi-action-link span{color:#77a9ca}.rumi-composer{display:flex;gap:9px;padding:14px;border-top:1px solid #172b3c;background:#07111c}.rumi-composer textarea{flex:1;resize:none;border:1px solid #20384e;border-radius:10px;background:#050d16;color:#e0eaf3;outline:0;padding:11px 12px;font:500 12px/1.45 inherit}.rumi-composer textarea:focus{border-color:#396486;box-shadow:0 0 0 3px rgba(57,100,134,.1)}.rumi-composer textarea::placeholder{color:#536c83}.rumi-composer button{align-self:stretch;border:1px solid #315b7b;border-radius:10px;background:#0c2236;color:#d9e8f4;padding:0 15px;font-size:10px;font-weight:700;cursor:pointer}.rumi-composer button:hover:not(:disabled){background:#102d45}.rumi-composer button:disabled{opacity:.5;cursor:not-allowed}.rumi-composer button span{margin-left:7px}.rumi-error{padding:9px 14px;border-top:1px solid #5b2d35;background:#24151a;color:#e4aeb6;font-size:10px}.rumi-context{padding:22px}.rumi-context h2{margin:9px 0 8px;color:#dce7f1;font-size:20px;letter-spacing:-.025em}.rumi-context>p{margin:0;color:#6b839a;font-size:11px;line-height:1.65}.rumi-context-list{margin-top:24px;display:grid;gap:8px}.rumi-context-list div{padding:12px;border:1px solid #182e42;border-radius:10px;background:#07111c}.rumi-context-list b{display:block;color:#cbd9e4;font-size:10px}.rumi-context-list span{display:block;margin-top:5px;color:#617b93;font-size:9px;line-height:1.5}@media(max-width:1180px){.rumi-workspace{grid-template-columns:200px minmax(0,1fr)}.rumi-context{display:none}}@media(max-width:780px){.rumi-workspace{grid-template-columns:1fr}.rumi-history{min-height:0;max-height:260px}.rumi-history-list{max-height:125px}.rumi-page{padding:24px 14px 38px}.rumi-page-header{align-items:flex-start;flex-direction:column}.rumi-header-actions{width:100%;justify-content:space-between}.rumi-starters{grid-template-columns:1fr}.rumi-composer{flex-direction:column}.rumi-composer button{min-height:40px}.rumi-messages{padding:18px}.rumi-message{max-width:100%}}
`;