import { useState, useEffect, useRef } from 'react';
import { Target, Play, Loader2, CheckCircle, XCircle, Clock, Globe, Search, ListChecks, DollarSign, BrainCircuit, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';

const API = 'http://localhost:8000';

interface MarketResult {
  id: number;
  url: string | null;
  data: Record<string, any> | null;
  created_at: string;
}

interface MarketLog {
  step: string;
  message: string;
}

interface MarketSession {
  id: number;
  session_name: string;
  goal: string;
  status: string;
  created_at: string;
  results: MarketResult[];
  logs: MarketLog[];
}

const STEP_COLORS: Record<string, string> = {
  planner: '#2563eb', executor: '#ea580c', critic: '#16a34a', system: '#475569',
};
const STEP_LABELS: Record<string, string> = {
  planner: 'Strategy', executor: 'Discovery', critic: 'Analysis', system: 'System',
};

const STATUS_CFG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  running: { color: '#d97706', bg: '#fef3c7', icon: <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> },
  queued:  { color: '#6366f1', bg: '#ede9fe', icon: <Clock size={11} /> },
  done:    { color: '#059669', bg: '#d1fae5', icon: <CheckCircle size={11} /> },
  failed:  { color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={11} /> },
};

export default function MarketAgent() {
  const [sessions, setSessions] = useState<MarketSession[]>([]);
  const [activeSession, setActiveSession] = useState<MarketSession | null>(null);
  const [goal, setGoal] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [liveLogs, setLiveLogs] = useState<MarketLog[]>([]);
  const [liveResults, setLiveResults] = useState<MarketResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchSessions(); }, []);
  useEffect(() => {
    if (logsExpanded) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs, logsExpanded]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/market/`);
      if (res.ok) setSessions(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadSession = async (id: number) => {
    eventSourceRef.current?.close();
    try {
      const res = await fetch(`${API}/market/${id}`);
      if (res.ok) {
        const data: MarketSession = await res.json();
        setActiveSession(data);
        setLiveLogs(data.logs);
        setLiveResults(data.results);
        setLogsExpanded(false);
        if (data.status === 'running' || data.status === 'queued') {
          subscribeToStream(id);
          setLogsExpanded(true);
        } else {
          setIsStreaming(false);
        }
      }
    } catch (e) { console.error(e); }
  };

  const subscribeToStream = (sessionId: number) => {
    setIsStreaming(true);
    const es = new EventSource(`${API}/market/${sessionId}/stream`);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try {
        const data: MarketLog = JSON.parse(event.data);
        if (data.step === 'ping') return;
        setLiveLogs(prev => [...prev, data]);
        if (data.message === 'DONE' || data.message?.startsWith('FAILED')) {
          setIsStreaming(false);
          es.close();
          fetchSessions();
          fetch(`${API}/market/${sessionId}`).then(r => r.json()).then((s: MarketSession) => {
            setLiveResults(s.results);
            setActiveSession(s);
            setLogsExpanded(false);
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
    setLiveResults([]);
    setActiveSession(null);
    setLogsExpanded(true);
    try {
      const res = await fetch(`${API}/market/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        fetchSessions();
        subscribeToStream(data.id);
        setActiveSession({ id: data.id, session_name: data.session_name, goal: data.goal, status: 'queued', created_at: new Date().toISOString(), results: [], logs: [] });
      }
    } catch (e) { console.error(e); }
    setIsStarting(false);
  };

  const filteredSessions = sessions.filter(s =>
    s.goal.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.session_name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const c = STATUS_CFG[status] ?? STATUS_CFG.queued;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: c.bg, color: c.color, padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'capitalize' }}>
        {c.icon} {status}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', fontFamily: "'Inter', sans-serif", background: '#f1f5f9' }}>
      
      {/* ── Collapsible Sidebar ── */}
      <div style={{ width: sidebarOpen ? '300px' : '56px', background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.25s ease', overflow: 'hidden' }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '60px' }}>
          <div style={{ padding: '7px', display: 'flex', flexShrink: 0 }}>
            <BrainCircuit size={18} color="#ea580c" />
          </div>
          {sidebarOpen && <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#000', whiteSpace: 'nowrap' }}>Market Research</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ marginLeft: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {sidebarOpen ? <ChevronLeft size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* Search Input */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  placeholder="Filter sessions..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', color: '#1a1a2e', background: '#f8fafc' }}
                />
              </div>
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startSearch(); } }}
                placeholder="Pitch your product idea..."
                style={{ width: '100%', minHeight: '64px', padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5, color: '#1a1a2e', fontFamily: 'inherit' }}
              />
              <button onClick={startSearch} disabled={isStarting || !goal.trim()}
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.6rem', background: '#fff', color: '#000', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600, cursor: isStarting || !goal.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {isStarting ? <><Loader2 size={13} color="#ea580c" style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : <><Play size={13} color="#ea580c" /> Start Analysis</>}
              </button>
            </div>

            {/* Session List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.25rem 0.25rem 0.5rem', marginBottom: '2px' }}>
                Sessions ({filteredSessions.length})
              </div>
              {filteredSessions.length === 0 && (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '1rem' }}>
                  {sessions.length === 0 ? 'No research yet.' : 'No matching sessions.'}
                </p>
              )}
              {filteredSessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '0.65rem 0.75rem', borderRadius: '8px', background: activeSession?.id === s.id ? '#ede9fe' : 'transparent', border: `1px solid ${activeSession?.id === s.id ? '#c4b5fd' : 'transparent'}`, cursor: 'pointer', marginBottom: '2px', transition: 'background 0.15s' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: activeSession?.id === s.id ? '#4f46e5' : '#1a1a2e', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.session_name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.goal}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusBadge status={s.status} />
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{s.results?.length ?? 0} comps</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {!sidebarOpen && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.5rem', gap: '8px' }}>
            {sessions.slice(0, 8).map(s => {
              const c = STATUS_CFG[s.status] ?? STATUS_CFG.queued;
              return (
                <button key={s.id} onClick={() => { setSidebarOpen(true); loadSession(s.id); }} title={s.session_name}
                  style={{ width: '36px', height: '36px', borderRadius: '8px', background: activeSession?.id === s.id ? '#ede9fe' : '#f8fafc', border: `1px solid ${activeSession?.id === s.id ? '#c4b5fd' : '#e2e8f0'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color }}>
                  {c.icon}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Empty State */}
        {!activeSession && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', color: '#000', padding: '2rem' }}>
            <div style={{ borderRadius: '50%', padding: '2rem' }}>
              <BrainCircuit size={48} color="#ea580c" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.5rem', color: '#000', fontWeight: 600 }}>Market Research Agent</h2>
              <p style={{ margin: 0, maxWidth: '400px', textAlign: 'center', fontSize: '0.9rem', lineHeight: 1.6, color: '#4b5563' }}>
                Pitch an idea and let Nova Act scour the web to find direct competitors, extract their pricing models, list core features, and assess market overlap.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {['Find Competitors', 'Scrape Websites', 'Distill Matrix'].map((step, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.75rem 1rem', textAlign: 'center', minWidth: '120px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'center' }}>
                    {[<Target size={20} color="#ea580c" />, <Globe size={20} color="#ea580c" />, <ListChecks size={20} color="#ea580c" />][i]}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#000' }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSession && (
          <>
            {/* Session Header */}
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#000' }}>{activeSession.session_name}</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Idea: {activeSession.goal}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                {isStreaming && <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ animation: 'pulse 1s infinite', display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: '50%' }} />LIVE</span>}
                <StatusBadge status={activeSession.status} />
                <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: '4px', fontWeight: 600 }}>{liveResults.length} competitors</span>
                {/* Toggle Logs Button */}
                <button onClick={() => setLogsExpanded(!logsExpanded)}
                  style={{ padding: '4px 10px', background: logsExpanded ? '#e2e8f0' : '#f1f5f9', color: '#000', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {logsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  Activity Log ({liveLogs.length})
                </button>
              </div>
            </div>

            {/* Collapsible Activity Log */}
            {logsExpanded && (
              <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0.75rem 1.5rem', background: '#0f172a', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '2px solid #334155' }}>
                {liveLogs.length === 0 && isStreaming && (
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Processing request...
                  </div>
                )}
                {liveLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: STEP_COLORS[log.step] ?? '#94a3b8', background: `${STEP_COLORS[log.step] ?? '#94a3b8'}25`, padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginTop: '1px' }}>
                      {STEP_LABELS[log.step] ?? log.step}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* Results Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
              {liveResults.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '1rem' }}>
                  {isStreaming ? (
                    <>
                      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>Agent is visiting websites... intel will appear here</p>
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={40} color="#ea580c" strokeWidth={1} />
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#4b5563' }}>No market intelligence gathered yet</p>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))' }}>
                  {liveResults.map((result, i) => (
                    <div key={result.id ?? i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
                      
                      {/* Card Header */}
                      <div style={{ background: '#334155', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Globe size={18} color="#f8fafc" />
                        <a href={result.url ?? '#'} target="_blank" rel="noopener noreferrer" title={result.url ?? ''}
                          style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {result.url?.replace(/^https?:\/\//, '') ?? 'Unknown URL'}
                        </a>
                      </div>

                      {/* Dynamic Card Body */}
                      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        
                        {result.data && Object.keys(result.data).map((key, j) => {
                           const value = result.data![key];
                           if (typeof value !== 'string') return null;
                           
                           // Determine icon based on key heuristic
                           const lowerKey = key.toLowerCase();
                           let Icon = Target;
                           if (lowerKey.includes('price') || lowerKey.includes('cost')) Icon = DollarSign;
                           if (lowerKey.includes('feature') || lowerKey.includes('capability')) Icon = ListChecks;

                           const isList = value.includes('\\n') || value.includes('- ');
                           
                           return (
                             <div key={j}>
                               <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <Icon size={13} /> {key}
                               </h4>
                               <div style={{ fontSize: '0.85rem', color: '#0f172a', lineHeight: 1.6, background: lowerKey.includes('price') ? '#f8fafc' : 'transparent', padding: lowerKey.includes('price') ? '0.75rem' : 0, borderRadius: '6px', border: lowerKey.includes('price') ? '1px solid #e2e8f0' : 'none', borderLeft: lowerKey.includes('releva') ? '3px solid #ea580c' : 'none', paddingLeft: lowerKey.includes('releva') ? '0.75rem' : (lowerKey.includes('price') ? '0.75rem' : 0) }}>
                                 {isList ? (
                                   <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                                     {value.split('\\n').filter(f => f.trim()).map((f, i) => (
                                       <li key={i} style={{ marginBottom: '4px' }}>{f.replace(/^[-*]\\s*/, '')}</li>
                                     ))}
                                   </ul>
                                 ) : (
                                   <span>{value}</span>
                                 )}
                               </div>
                             </div>
                           );
                        })}

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
