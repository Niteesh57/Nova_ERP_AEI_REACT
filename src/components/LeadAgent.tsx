import { useState, useEffect, useRef } from 'react';
import { Target, Play, Loader2, CheckCircle, XCircle, Clock, Globe, Send } from 'lucide-react';

const API = 'http://localhost:8000';

interface Lead {
  id: number;
  url: string | null;
  reasoning: string | null;
  contact_status?: string;
  created_at: string;
}

interface LogEntry {
  step: string;
  message: string;
}

interface LeadSession {
  id: number;
  session_name: string;
  goal: string;
  status: string;
  created_at: string;
  leads: Lead[];
  logs: LogEntry[];
}

const STEP_COLORS: Record<string, string> = {
  planner: '#6366f1',
  executor: '#f59e0b',
  critic: '#10b981',
  system: '#64748b',
};

const STEP_LABELS: Record<string, string> = {
  planner: '🧠 Planner',
  executor: '🌐 Search',
  critic: '⚖️ Critic',
  system: '⚙️ System',
};

export default function LeadAgent() {
  const [sessions, setSessions] = useState<LeadSession[]>([]);
  const [activeSession, setActiveSession] = useState<LeadSession | null>(null);
  const [goal, setGoal] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [liveLeads, setLiveLeads] = useState<Lead[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [contactModalLeadId, setContactModalLeadId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchSessions(); }, []);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [liveLogs]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/leads/`);
      if (res.ok) setSessions(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadSession = async (id: number) => {
    eventSourceRef.current?.close();
    try {
      const res = await fetch(`${API}/leads/${id}`);
      if (res.ok) {
        const data: LeadSession = await res.json();
        setActiveSession(data);
        setLiveLogs(data.logs);
        setLiveLeads(data.leads);
        if (data.status === 'running' || data.status === 'queued') {
          subscribeToStream(id);
        } else {
          setIsStreaming(false);
        }
      }
    } catch (e) { console.error(e); }
  };

  const subscribeToStream = (sessionId: number) => {
    setIsStreaming(true);
    const es = new EventSource(`${API}/leads/${sessionId}/stream`);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try {
        const data: LogEntry = JSON.parse(event.data);
        if (data.step === 'ping') return;
        setLiveLogs(prev => [...prev, data]);
        if (data.message === 'DONE' || data.message?.startsWith('FAILED')) {
          setIsStreaming(false);
          es.close();
          fetchSessions();
          fetch(`${API}/leads/${sessionId}`).then(r => r.json()).then((s: LeadSession) => {
            setLiveLeads(s.leads);
            setActiveSession(s);
          });
        }
      } catch (e) {}
    };
    es.onerror = () => { setIsStreaming(false); es.close(); };
  };

  const startSearch = async () => {
    if (!goal.trim()) return;
    setIsStarting(true);
    setLiveLogs([]);
    setLiveLeads([]);
    setActiveSession(null);
    try {
      const res = await fetch(`${API}/leads/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        fetchSessions();
        subscribeToStream(data.id);
        setActiveSession({ id: data.id, session_name: data.session_name, goal: data.goal, status: 'queued', created_at: new Date().toISOString(), leads: [], logs: [] });
      }
    } catch (e) { console.error(e); }
    setIsStarting(false);
  };

  const submitContact = async () => {
    if (!contactModalLeadId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/leads/${contactModalLeadId}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      if (res.ok) {
        setContactModalLeadId(null);
        setContactForm({ name: '', email: '', description: '' });
        // Refresh the leads to show updated status
        if (activeSession) {
          fetch(`${API}/leads/${activeSession.id}`).then(r => r.json()).then((s: LeadSession) => {
            setLiveLeads(s.leads);
            setActiveSession(s);
          });
        }
      }
    } catch (e) { console.error(e); }
    setIsSubmitting(false);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg: Record<string, { color: string; icon: React.ReactNode }> = {
      running: { color: '#f59e0b', icon: <Loader2 size={12} className="spin" /> },
      queued:  { color: '#6366f1', icon: <Clock size={12} /> },
      done:    { color: '#10b981', icon: <CheckCircle size={12} /> },
      failed:  { color: '#ef4444', icon: <XCircle size={12} /> },
    };
    const c = cfg[status] ?? cfg.queued;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${c.color}15`, color: c.color, padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>
        {c.icon} {status}
      </span>
    );
  };

  const ContactButton = ({ lead }: { lead: Lead }) => {
    const status = lead.contact_status ?? 'uncontacted';
    if (status === 'success') {
      return <span style={{ padding: '4px 10px', background: '#d1fae5', color: '#059669', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}><CheckCircle size={12} /> Sent</span>;
    }
    if (status === 'running') {
      return <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#d97706', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}><Loader2 size={12} className="spin" /> Filling...</span>;
    }
    return (
      <button
        onClick={() => setContactModalLeadId(lead.id)}
        style={{ padding: '5px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        <Send size={12} /> Contact
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', fontFamily: "'Inter', sans-serif", position: 'relative' }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: '280px', background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '6px', display: 'flex' }}>
              <Target size={16} color="#fff" />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1a1a2e' }}>Lead Generation</h3>
          </div>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startSearch(); } }}
            placeholder="e.g. AI healthcare startup founders in US"
            style={{ width: '100%', minHeight: '72px', padding: '0.65rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, color: '#1a1a2e' }}
          />
          <button
            onClick={startSearch}
            disabled={isStarting || !goal.trim()}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem', background: isStarting || !goal.trim() ? '#94a3b8' : '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: isStarting || !goal.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
          >
            {isStarting ? <><Loader2 size={14} /> Starting...</> : <><Play size={14} /> Start Search</>}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 0.25rem', marginBottom: '0.5rem' }}>Past Sessions</div>
          {sessions.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', marginTop: '1.5rem' }}>No searches yet.</p>}
          {sessions.map(s => (
            <button key={s.id} onClick={() => loadSession(s.id)} style={{ width: '100%', textAlign: 'left', padding: '0.75rem', borderRadius: '8px', background: activeSession?.id === s.id ? '#f1f5f9' : 'transparent', border: `1px solid ${activeSession?.id === s.id ? '#e2e8f0' : 'transparent'}`, cursor: 'pointer', marginBottom: '2px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1a2e', marginBottom: '4px' }}>{s.session_name}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.goal}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge status={s.status} />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.leads?.length ?? 0} leads</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
        {!activeSession ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#94a3b8' }}>
            <div style={{ background: '#f1f5f9', borderRadius: '50%', padding: '2rem' }}>
              <Target size={48} strokeWidth={1} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#64748b', fontWeight: 600 }}>Lead Research</h2>
            <p style={{ margin: 0, maxWidth: '360px', textAlign: 'center', fontSize: '0.9rem' }}>Enter a topic in the sidebar. The agent will search the web and find relevant leads for you.</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Live Log Timeline - compact strip */}
            <div style={{ maxHeight: '200px', display: 'flex', flexDirection: 'column', borderBottom: '2px solid #e2e8f0', background: '#fff' }}>
              <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a2e' }}>{activeSession.session_name}</h2>
                  <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: '#64748b' }}>{activeSession.goal}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isStreaming && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>● LIVE</span>}
                  <StatusBadge status={activeSession.status} />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {liveLogs.length === 0 && isStreaming && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.82rem', padding: '0.25rem 0' }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting to agent...
                  </div>
                )}
                {liveLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: STEP_COLORS[log.step] ?? '#64748b', background: `${STEP_COLORS[log.step] ?? '#64748b'}18`, padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {STEP_LABELS[log.step] ?? log.step}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.4 }}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Results Panel - takes remaining height with full width */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1a1a2e' }}>
                  Leads Found <span style={{ marginLeft: '0.5rem', background: '#f1f5f9', color: '#64748b', padding: '1px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>{liveLeads.length}</span>
                </h3>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {liveLeads.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '0.5rem' }}>
                    <Target size={32} strokeWidth={1} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Leads will appear here as they are found</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {liveLeads.map((lead, i) => (
                      <div key={lead.id ?? i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {lead.url && lead.url !== 'Unknown' ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                                <Globe size={15} color="#4f46e5" style={{ flexShrink: 0 }} />
                                <a
                                  href={lead.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={lead.url}
                                  style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4f46e5', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                >
                                  {lead.url}
                                </a>
                              </div>
                              <ContactButton lead={lead} />
                            </div>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
                              {lead.reasoning ?? 'No reasoning provided.'}
                            </p>
                          </>
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>{lead.reasoning}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Contact Modal ── */}
      {contactModalLeadId !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
             onClick={(e) => { if (e.target === e.currentTarget) setContactModalLeadId(null); }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>Auto-Fill Contact Form</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                Nova Act will navigate to the website's Contact page, fill in your details, auto-generate any missing required fields, and submit the form.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Your Name *</label>
                <input
                  placeholder="John Doe"
                  value={contactForm.name}
                  onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Your Email *</label>
                <input
                  placeholder="john@example.com"
                  type="email"
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Message *</label>
                <textarea
                  placeholder="Describe your request or inquiry..."
                  value={contactForm.description}
                  onChange={e => setContactForm({ ...contactForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '90px', resize: 'none', fontSize: '0.875rem', lineHeight: 1.5, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setContactModalLeadId(null)}
                style={{ flex: 1, padding: '0.7rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                disabled={isSubmitting || !contactForm.name.trim() || !contactForm.email.trim() || !contactForm.description.trim()}
                onClick={submitContact}
                style={{ flex: 2, padding: '0.7rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '10px', cursor: (isSubmitting || !contactForm.name.trim() || !contactForm.email.trim() || !contactForm.description.trim()) ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem', opacity: (isSubmitting || !contactForm.name.trim() || !contactForm.email.trim() || !contactForm.description.trim()) ? 0.6 : 1 }}
              >
                {isSubmitting ? <><Loader2 size={15} className="spin" /> Dispatching Agent...</> : <><Send size={15} /> Dispatch Nova Act</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
