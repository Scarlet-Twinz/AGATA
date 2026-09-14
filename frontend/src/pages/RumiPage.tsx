import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, streamApi } from "../lib/api";

type Message = { role: "user" | "assistant"; content: string };
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

export default function RumiPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending && !loadingHistory, [input, sending, loadingHistory]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const current = await api<Conversation>("/api/rumi/conversations/current");
        const history = await api<Array<{ role: "user" | "assistant"; content: string }>>(`/api/rumi/conversations/${current.id}/messages`);
        if (!active) return;
        setConversation(current);
        setMessages(history);
        setError("");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Rumi history could not be loaded.");
      } finally {
        if (active) setLoadingHistory(false);
      }
    }
    void loadHistory();
    return () => { active = false; };
  }, []);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || sending || loadingHistory) return;
    let activeConversation = conversation;
    if (!activeConversation) {
      activeConversation = await api<Conversation>("/api/rumi/conversations/current");
      setConversation(activeConversation);
    }
    // The API accepts at most 20 incoming messages. Keep the newest 19
    // existing messages so the new user message always fits the contract.
    const next: Message[] = [...messages.slice(-19), { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setError("");
    setSending(true);
    try {
      await streamApi("/api/rumi/chat", { conversation_id: activeConversation.id, messages: next }, (token) => {
        setMessages((current) => {
          const copy = [...current];
          const last = copy.length - 1;
          copy[last] = { ...copy[last], content: copy[last].content + token };
          return copy;
        });
      });
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
        <div><span className="rumi-eyebrow">INTELLIGENCE · RUMI</span><h1>Rumi</h1><p>Your compliance intelligence assistant. Ask about readiness, evidence, decisions, or how to use AGATA.</p></div>
        <div className="rumi-status"><span/> {loadingHistory ? "Loading conversation" : "Conversation saved"}</div>
      </header>
      <div className="rumi-workspace">
        <main className="rumi-chat-panel">
          <div className="rumi-chat-head"><div className="rumi-avatar">R</div><div><strong>Rumi</strong><span>AGATA compliance intelligence</span></div></div>
          <div className="rumi-messages">
            {loadingHistory ? <div className="rumi-loading">Restoring your Rumi conversation…</div> : messages.length === 0 ? <div className="rumi-welcome"><div className="rumi-welcome-mark">R</div><h2>What do you need to know?</h2><p>Rumi can explain live workspace intelligence and help you find your way around AGATA.</p><div className="rumi-starters">{starters.map((starter) => <button key={starter} type="button" onClick={() => void sendMessage(starter)}>{starter}<span>→</span></button>)}</div></div> : messages.map((message, index) => <div className={`rumi-message ${message.role}`} key={`${index}-${message.role}`}><div className="rumi-message-label">{message.role === "user" ? "You" : "Rumi"}</div><div className="rumi-message-body">{message.content ? <RumiContent content={message.content} /> : (sending && index === messages.length - 1 ? "Thinking…" : "")}</div></div>)}
          </div>
          <form className="rumi-composer" onSubmit={submit}><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} placeholder="Ask Rumi about your workspace or how to use AGATA…" rows={2} disabled={sending || loadingHistory}/><button type="submit" disabled={!canSend}>{sending ? "Thinking…" : "Ask Rumi"}<span>↗</span></button></form>
          {error && <div className="rumi-error">{error}</div>}
        </main>
        <aside className="rumi-context"><span className="rumi-eyebrow">HOW RUMI WORKS</span><h2>Explain. Guide. Navigate.</h2><p>Rumi combines current AGATA workspace facts with product guidance. It explains decisions, helps users understand what to do next, and can open the relevant workspace.</p><div className="rumi-context-list"><div><b>Workspace intelligence</b><span>Answer questions using current projects, contractors, requirements, evidence, and readiness.</span></div><div><b>Product guidance</b><span>Learn how to create and manage the things you work with in AGATA.</span></div><div><b>Navigation actions</b><span>When a relevant workspace exists, Rumi can provide a direct action to open it.</span></div></div></aside>
      </div>
    </section>
  </>;
}

const styles = `
.rumi-page{max-width:1180px;margin:0 auto;padding:38px 30px 56px;color:#e8eef7}.rumi-page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:24px}.rumi-eyebrow{display:block;color:#7f9bb8;font-size:9px;font-weight:750;letter-spacing:.19em}.rumi-page-header h1{margin:8px 0 8px;font-size:44px;line-height:1;letter-spacing:-.045em}.rumi-page-header p{margin:0;max-width:700px;color:#7890a9;font-size:13px;line-height:1.6}.rumi-status{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #234431;border-radius:999px;background:#091a12;color:#77d4a0;font-size:10px;font-weight:650;white-space:nowrap}.rumi-status span{width:6px;height:6px;border-radius:50%;background:#53d88e;box-shadow:0 0 12px rgba(83,216,142,.55)}.rumi-workspace{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:stretch}.rumi-chat-panel,.rumi-context{border:1px solid #1b3044;border-radius:15px;background:#050b13;overflow:hidden}.rumi-chat-panel{min-height:650px;display:flex;flex-direction:column}.rumi-chat-head{height:66px;flex:none;display:flex;align-items:center;gap:11px;padding:0 18px;border-bottom:1px solid #172b3c;background:#07111c}.rumi-avatar,.rumi-welcome-mark{display:grid;place-items:center;border:1px solid #345875;background:#0c2134;color:#a8d2ef;font-weight:800}.rumi-avatar{width:34px;height:34px;border-radius:10px}.rumi-chat-head strong{display:block;color:#dce7f1;font-size:12px}.rumi-chat-head span{display:block;margin-top:3px;color:#5f7891;font-size:9px}.rumi-messages{flex:1;overflow:auto;padding:24px}.rumi-loading{margin:52px auto;text-align:center;color:#718aa1;font-size:11px}.rumi-welcome{max-width:620px;margin:52px auto;text-align:center}.rumi-welcome-mark{width:58px;height:58px;margin:0 auto 17px;border-radius:16px;font-size:20px;box-shadow:0 0 35px rgba(67,142,204,.1)}.rumi-welcome h2{margin:0;color:#e1eaf2;font-size:23px;letter-spacing:-.025em}.rumi-welcome p{max-width:530px;margin:10px auto 22px;color:#6c849b;font-size:11px;line-height:1.6}.rumi-starters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rumi-starters button{min-height:76px;padding:12px;text-align:left;border:1px solid #1d3449;border-radius:10px;background:#07121e;color:#9bb1c4;font-size:10px;cursor:pointer}.rumi-starters button:hover{border-color:#315a78;background:#091827;color:#d5e3ed}.rumi-starters span{display:block;margin-top:10px;color:#4e7797}.rumi-message{max-width:780px;margin-bottom:18px}.rumi-message.user{margin-left:auto}.rumi-message-label{margin-bottom:5px;color:#607a93;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.rumi-message-body{border:1px solid #1b3043;border-radius:11px;padding:13px 15px;background:#091521;color:#c9d6e1;font-size:12px;line-height:1.65;white-space:pre-wrap}.rumi-message.user .rumi-message-body{background:#0d2032;border-color:#294864;color:#dce9f4}.rumi-action-link{display:inline-flex;align-items:center;gap:8px;margin:10px 4px 2px 0;padding:7px 10px;border:1px solid #315b7b;border-radius:8px;background:#0c2236;color:#d9e8f4;font:700 10px/1.2 inherit;cursor:pointer;white-space:nowrap}.rumi-action-link:hover{background:#102d45;border-color:#46789e}.rumi-action-link span{color:#77a9ca}.rumi-composer{display:flex;gap:9px;padding:14px;border-top:1px solid #172b3c;background:#07111c}.rumi-composer textarea{flex:1;resize:none;border:1px solid #20384e;border-radius:10px;background:#050d16;color:#e0eaf3;outline:0;padding:11px 12px;font:500 12px/1.45 inherit}.rumi-composer textarea:focus{border-color:#396486;box-shadow:0 0 0 3px rgba(57,100,134,.1)}.rumi-composer textarea::placeholder{color:#536c83}.rumi-composer button{align-self:stretch;border:1px solid #315b7b;border-radius:10px;background:#0c2236;color:#d9e8f4;padding:0 15px;font-size:10px;font-weight:700;cursor:pointer}.rumi-composer button:hover:not(:disabled){background:#102d45}.rumi-composer button:disabled{opacity:.5;cursor:not-allowed}.rumi-composer button span{margin-left:7px}.rumi-error{padding:9px 14px;border-top:1px solid #5b2d35;background:#24151a;color:#e4aeb6;font-size:10px}.rumi-context{padding:22px}.rumi-context h2{margin:9px 0 8px;color:#dce7f1;font-size:20px;letter-spacing:-.025em}.rumi-context>p{margin:0;color:#6b839a;font-size:11px;line-height:1.65}.rumi-context-list{margin-top:26px;display:grid;gap:9px}.rumi-context-list div{padding:13px;border:1px solid #182e42;border-radius:10px;background:#07111c}.rumi-context-list b{display:block;color:#cbd9e4;font-size:10px}.rumi-context-list span{display:block;margin-top:5px;color:#617b93;font-size:9px;line-height:1.5}@media(max-width:900px){.rumi-workspace{grid-template-columns:1fr}.rumi-context{order:-1}.rumi-page{padding:26px 16px 42px}.rumi-page-header{align-items:flex-start;flex-direction:column}.rumi-starters{grid-template-columns:1fr}.rumi-composer{flex-direction:column}.rumi-composer button{min-height:40px}}
`;
