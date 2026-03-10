import { useState, useRef, useEffect } from 'react';
import { Code, ShieldCheck, DollarSign, Paperclip, Send, X, ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react';

const HTTP_BASE = 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentType = 'code_generation' | 'code_scanner' | 'cost_optimizer';

interface AgentConfig {
  id: AgentType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgLight: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface UserStory {
  id: number;
  product_id: number;
  product_name: string;
  title: string;
  description?: string;
  tag?: string;
}

interface FunctionParam {
  name: string;
  type: string;
  value: string;
}

interface FunctionInfo {
  actionGroup: string;
  function: string;
  parameters: FunctionParam[];
}

interface ConfirmRequest {
  invocation_id: string;
  invocation_inputs: object[];
  functions: FunctionInfo[];
}

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS: AgentConfig[] = [
  {
    id: 'code_generation',
    label: 'Code Generation',
    description: 'Generate production-ready code from user stories and requirements',
    icon: <Code size={20} />,
    color: '#6366f1',
    bgLight: '#eef2ff',
  },
  {
    id: 'code_scanner',
    label: 'Code Scanner',
    description: 'Scan code for vulnerabilities, bugs, and best-practice violations',
    icon: <ShieldCheck size={20} />,
    color: '#10b981',
    bgLight: '#ecfdf5',
  },
  {
    id: 'cost_optimizer',
    label: 'Cost Optimizer',
    description: 'Analyze and optimize AWS and application infrastructure costs',
    icon: <DollarSign size={20} />,
    color: '#f59e0b',
    bgLight: '#fffbeb',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FunctionsAgent() {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('code_generation');
  const [sessionId, setSessionId] = useState<Record<AgentType, string | null>>({
    code_generation: null,
    code_scanner: null,
    cost_optimizer: null,
  });
  const [messages, setMessages] = useState<Record<AgentType, ChatMessage[]>>({
    code_generation: [],
    code_scanner: [],
    cost_optimizer: [],
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // User stories
  const [allStories, setAllStories] = useState<UserStory[]>([]);
  const [attachedStories, setAttachedStories] = useState<UserStory[]>([]);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  // Agent confirmation dialog
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const capturedSessionIdRef = useRef<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgId = useRef(0);

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchStories = async () => {
    try {
      const res = await fetch(`${HTTP_BASE}/functions/user-stories`);
      if (res.ok) setAllStories(await res.json());
    } catch (e) {
      console.error('Failed to load user stories', e);
    }
  };

  const activeAgent = AGENTS.find(a => a.id === selectedAgent)!;
  const currentMessages = messages[selectedAgent];

  const switchAgent = (agentId: AgentType) => {
    setSelectedAgent(agentId);
    setInput('');
  };

  // Group stories by product
  const storiesByProduct = allStories.reduce<Record<string, UserStory[]>>((acc, story) => {
    if (!acc[story.product_name]) acc[story.product_name] = [];
    acc[story.product_name].push(story);
    return acc;
  }, {});

  const toggleAttachStory = (story: UserStory) => {
    setAttachedStories(prev => {
      const exists = prev.find(s => s.id === story.id);
      return exists ? prev.filter(s => s.id !== story.id) : [...prev, story];
    });
  };

  const buildPrompt = (): string => {
    const parts: string[] = [];
    if (attachedStories.length > 0) {
      parts.push('=== ATTACHED USER STORIES ===');
      attachedStories.forEach((s, i) => {
        parts.push(`\n[Story ${i + 1}] ${s.title} (${s.product_name})${s.tag ? ` [${s.tag}]` : ''}`);
        if (s.description) parts.push(s.description);
      });
      parts.push('\n=== USER REQUEST ===');
    }
    parts.push(input.trim());
    return parts.join('\n');
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const prompt = buildPrompt();
    const userMsg: ChatMessage = { id: ++msgId.current, role: 'user', content: input.trim() };
    const assistantMsg: ChatMessage = { id: ++msgId.current, role: 'assistant', content: '', isStreaming: true };

    setMessages(prev => ({
      ...prev,
      [selectedAgent]: [...prev[selectedAgent], userMsg, assistantMsg],
    }));
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${HTTP_BASE}/functions/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: selectedAgent,
          prompt,
          session_id: sessionId[selectedAgent],
        }),
      });

      if (!res.body) throw new Error('No SSE body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'session_id') {
              capturedSessionIdRef.current = parsed.session_id;
              setSessionId(prev => ({ ...prev, [selectedAgent]: parsed.session_id }));
            } else if (parsed.type === 'text') {
              setMessages(prev => {
                const msgs = [...prev[selectedAgent]];
                const last = msgs[msgs.length - 1];
                if (last && last.isStreaming) {
                  msgs[msgs.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return { ...prev, [selectedAgent]: msgs };
              });
            } else if (parsed.type === 'confirm_required') {
              // Pause streaming UI and show the confirm dialog
              setIsLoading(false);
              setMessages(prev => {
                const msgs = [...prev[selectedAgent]];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, isStreaming: false };
                return { ...prev, [selectedAgent]: msgs };
              });
              setConfirmRequest({
                invocation_id: parsed.invocation_id,
                invocation_inputs: parsed.invocation_inputs,
                functions: parsed.functions,
              });
              return; // stop consuming this stream — user must confirm
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error('Invoke failed:', e);
      setMessages(prev => {
        const msgs = [...prev[selectedAgent]];
        const last = msgs[msgs.length - 1];
        if (last?.isStreaming) {
          msgs[msgs.length - 1] = { ...last, content: 'Error: Failed to get response.', isStreaming: false };
        }
        return { ...prev, [selectedAgent]: msgs };
      });
    }

    // Mark streaming done
    setMessages(prev => {
      const msgs = [...prev[selectedAgent]];
      const last = msgs[msgs.length - 1];
      if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, isStreaming: false };
      return { ...prev, [selectedAgent]: msgs };
    });
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Handle Confirm / Deny ──────────────────────────────────────────────────
  const handleConfirm = async (confirmed: boolean) => {
    if (!confirmRequest) return;
    const currentSessionId = capturedSessionIdRef.current || sessionId[selectedAgent];
    if (!currentSessionId) return;

    const assistantMsg: ChatMessage = { id: ++msgId.current, role: 'assistant', content: '', isStreaming: true };
    setMessages(prev => ({ ...prev, [selectedAgent]: [...prev[selectedAgent], assistantMsg] }));
    setConfirmRequest(null);
    setIsLoading(true);

    try {
      const res = await fetch(`${HTTP_BASE}/functions/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: selectedAgent,
          session_id: currentSessionId,
          invocation_id: confirmRequest.invocation_id,
          invocation_inputs: confirmRequest.invocation_inputs,
          confirmed,
        }),
      });

      if (!res.body) throw new Error('No SSE body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'text') {
              setMessages(prev => {
                const msgs = [...prev[selectedAgent]];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, content: last.content + parsed.content };
                return { ...prev, [selectedAgent]: msgs };
              });
            } else if (parsed.type === 'confirm_required') {
              setIsLoading(false);
              setMessages(prev => {
                const msgs = [...prev[selectedAgent]];
                const last = msgs[msgs.length - 1];
                if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, isStreaming: false };
                return { ...prev, [selectedAgent]: msgs };
              });
              setConfirmRequest({
                invocation_id: parsed.invocation_id,
                invocation_inputs: parsed.invocation_inputs,
                functions: parsed.functions,
              });
              return;
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error('Confirm failed:', e);
    }

    setMessages(prev => {
      const msgs = [...prev[selectedAgent]];
      const last = msgs[msgs.length - 1];
      if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, isStreaming: false };
      return { ...prev, [selectedAgent]: msgs };
    });
    setIsLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Left Sidebar: Agent Selector ── */}
      <div style={{ width: '260px', background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111' }}>Functions</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Select an AI agent to execute</p>
        </div>

        <div style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {AGENTS.map(agent => {
            const isActive = selectedAgent === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => switchAgent(agent.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.875rem 1rem',
                  borderRadius: '10px',
                  border: isActive ? `2px solid ${agent.color}` : '2px solid transparent',
                  background: isActive ? agent.bgLight : '#f9fafb',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
                  <span style={{ color: isActive ? agent.color : '#6b7280' }}>{agent.icon}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isActive ? agent.color : '#111' }}>{agent.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.4 }}>{agent.description}</p>
                {messages[agent.id].length > 0 && (
                  <span style={{ display: 'inline-block', marginTop: '0.375rem', fontSize: '0.65rem', background: agent.bgLight, color: agent.color, padding: '2px 8px', borderRadius: '999px', border: `1px solid ${agent.color}22` }}>
                    {messages[agent.id].filter(m => m.role === 'user').length} messages
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Reset session button */}
        {sessionId[selectedAgent] && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb' }}>
            <button
              onClick={() => {
                setSessionId(prev => ({ ...prev, [selectedAgent]: null }));
                setMessages(prev => ({ ...prev, [selectedAgent]: [] }));
              }}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}
            >
              + New Session
            </button>
          </div>
        )}
      </div>

      {/* ── Center: Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: activeAgent.color }}>{activeAgent.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111' }}>{activeAgent.label}</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{sessionId[selectedAgent] ? `Session active` : 'Start a new session'}</p>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {currentMessages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: '4rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{activeAgent.icon}</div>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#6b7280', margin: '0 0 0.375rem' }}>{activeAgent.label} Agent</p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                {attachedStories.length > 0 ? `${attachedStories.length} user stor${attachedStories.length > 1 ? 'ies' : 'y'} attached. Type your request and press Execute.` : 'Type a message, or attach user stories from the panel on the right.'}
              </p>
            </div>
          ) : (
            currentMessages.filter(msg => msg.role === 'user' || msg.content.length > 0).map(msg => (
              <div
                key={msg.id}
                style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '0.875rem 1rem',
                    borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                    background: msg.role === 'user' ? activeAgent.color : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#111',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                  {msg.isStreaming && <span style={{ display: 'inline-block', width: '8px', height: '14px', background: activeAgent.color, marginLeft: '3px', verticalAlign: 'middle', borderRadius: '2px', animation: 'blink 1s infinite' }} />}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '1rem 1.5rem', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          {/* Attached story pills */}
          {attachedStories.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {attachedStories.map(s => (
                <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', color: '#374151' }}>
                  <Paperclip size={11} />
                  {s.title}
                  <button onClick={() => toggleAttachStory(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', lineHeight: 1 }}><X size={12} /></button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <button
              onClick={() => setShowAttachModal(true)}
              title="Attach User Stories"
              style={{ flexShrink: 0, padding: '0.625rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}
            >
              <Paperclip size={15} />
              {attachedStories.length > 0 && <span style={{ background: activeAgent.color, color: '#fff', borderRadius: '9999px', padding: '1px 6px', fontSize: '0.65rem' }}>{attachedStories.length}</span>}
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${activeAgent.label} agent... (Shift+Enter for new line)`}
              rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.75rem 1rem',
                fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: '150px', overflowY: 'auto', background: '#f9fafb',
              }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${t.scrollHeight}px`;
              }}
            />

            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                flexShrink: 0, padding: '0.625rem 1rem', borderRadius: '10px', border: 'none',
                background: !input.trim() || isLoading ? '#e5e7eb' : activeAgent.color,
                color: '#fff', cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: 600,
                transition: 'background 0.15s ease',
              }}
            >
              {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              Execute
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Attached Context ── */}
      <div style={{ width: '280px', background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#111' }}>Attached Context</h4>
          <button
            onClick={() => setShowAttachModal(true)}
            style={{ background: activeAgent.color, color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Plus size={12} /> Attach
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {attachedStories.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '2rem' }}>
              No stories attached yet.<br />Click Attach to add context.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {attachedStories.map(story => (
                <div key={story.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: '#111', lineHeight: 1.3, flex: 1 }}>{story.title}</span>
                    <button onClick={() => toggleAttachStory(story)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '0 0 0 4px', flexShrink: 0 }}><X size={13} /></button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{story.product_name}</span>
                  {story.tag && <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: '#f1f5f9', color: '#374151', padding: '1px 6px', borderRadius: '9999px' }}>{story.tag}</span>}
                  {story.description && <p style={{ margin: '0.375rem 0 0', color: '#6b7280', lineHeight: 1.4, fontSize: '0.75rem' }}>{story.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Agent Confirmation Modal ── */}
      {confirmRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: '1.75rem', fontFamily: 'inherit' }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 500, color: '#111', lineHeight: 1.5 }}>
              Are you sure you want to run this action group function?
            </p>

            {confirmRequest.functions.map((fn, i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#111', fontSize: '0.875rem', wordBreak: 'break-all' }}>
                  {fn.function}({fn.parameters.map(p => `{"${p.name}": "${p.value}"}`).join(', ')})
                </p>
                {fn.parameters.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                    {fn.parameters.map((p, j) => (
                      <div key={j} style={{ fontSize: '0.8rem', color: '#374151' }}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>: <span style={{ wordBreak: 'break-all' }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
                  This function is a part of the action group: <strong>{fn.actionGroup}</strong>
                </p>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                onClick={() => handleConfirm(false)}
                style={{ padding: '0.5rem 1.5rem', borderRadius: '20px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
              >
                Deny
              </button>
              <button
                onClick={() => handleConfirm(true)}
                style={{ padding: '0.5rem 1.5rem', borderRadius: '20px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attach Stories Modal ── */}
      {showAttachModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowAttachModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', width: '520px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111' }}>Attach User Stories</h3>
              <button onClick={() => setShowAttachModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              {Object.keys(storiesByProduct).length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: '2rem' }}>No user stories found. Create some in the Dashboard first.</p>
              ) : (
                Object.entries(storiesByProduct).map(([productName, stories]) => {
                  const productId = stories[0].product_id;
                  const isExpanded = expandedProducts.has(productId);
                  return (
                    <div key={productName} style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedProducts(prev => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(productId) : next.add(productId);
                          return next;
                        })}
                        style={{ width: '100%', padding: '0.75rem 1rem', background: '#f9fafb', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}
                      >
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        {productName}
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: '#e5e7eb', borderRadius: '9999px', padding: '1px 8px' }}>{stories.length}</span>
                      </button>
                      {isExpanded && (
                        <div style={{ padding: '0.5rem' }}>
                          {stories.map(story => {
                            const isAttached = !!attachedStories.find(s => s.id === story.id);
                            return (
                              <div
                                key={story.id}
                                onClick={() => toggleAttachStory(story)}
                                style={{
                                  padding: '0.625rem 0.875rem',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  background: isAttached ? activeAgent.bgLight : 'transparent',
                                  border: isAttached ? `1px solid ${activeAgent.color}44` : '1px solid transparent',
                                  marginBottom: '0.25rem',
                                  transition: 'all 0.1s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                  <div style={{ width: '14px', height: '14px', border: `2px solid ${isAttached ? activeAgent.color : '#d1d5db'}`, borderRadius: '3px', background: isAttached ? activeAgent.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {isAttached && <span style={{ color: '#fff', fontSize: '9px', lineHeight: 1 }}>✓</span>}
                                  </div>
                                  <span style={{ fontSize: '0.825rem', fontWeight: 500, color: '#111' }}>{story.title}</span>
                                  {story.tag && <span style={{ fontSize: '0.65rem', background: '#f1f5f9', color: '#374151', padding: '1px 6px', borderRadius: '9999px' }}>{story.tag}</span>}
                                </div>
                                {story.description && <p style={{ margin: '0 0 0 22px', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>{story.description}</p>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setAttachedStories([])} style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Clear All</button>
              <button
                onClick={() => setShowAttachModal(false)}
                style={{ background: activeAgent.color, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Done ({attachedStories.length} attached)
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
