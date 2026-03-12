import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  MessageSquareWarning,
  Target,
  Cpu,
  ArrowRight,
  Activity,
  ChevronRight,
  Cloud,
  Zap,
  Lock,
  Code2,
  Github,
  X,
} from 'lucide-react';
import '../index.css';

// ── Intersection Observer Hook ──────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible] as const;
}

// ── Animated section wrapper ────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''} ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

// ── Module data ─────────────────────────────────────────────────────────
const modules = [
  {
    icon: <ShieldCheck size={26} />,
    title: 'Autonomous Surveillance',
    desc: 'Live video streams via S3 are continuously analyzed using Nova multimodal reasoning. Bounding boxes track movement, ChromaDB identifies faces, and intrusion alerts auto-trigger when unauthorized personnel are detected.',
    flow: [
      { label: 'Video Chunk → S3 Upload', highlight: false },
      { label: 'Nova Analysis + ChromaDB Match', highlight: true },
      { label: 'Security Alert / Logging', highlight: false },
    ],
  },
  {
    icon: <MessageSquareWarning size={26} />,
    title: 'Voice Call & Ticket Agent',
    desc: 'Real-time Bedrock streaming handles active voice calls. The agent classifies the issue based on historical context, auto-generates support tickets, resolves them or escalates to human agents — all without lifting a finger.',
    flow: [
      { label: 'Incoming Voice Call / Audio Stream', highlight: false },
      { label: 'Bedrock Inference + Classification', highlight: true },
      { label: 'Auto-Resolve / Ticket Generation', highlight: false },
    ],
  },
  {
    icon: <Target size={26} />,
    title: 'Lead & Market Intelligence',
    desc: 'Dynamic web scraping targets competitor info and market signals. The Lead and Market Agents parse the data, score vendor signals, and automatically draft hyper-personalized outreach strategies.',
    tags: ['Web Scraping', 'Competitor Insights', 'Lead Generation', 'Dynamic Outreach'],
  },
  {
    icon: <Cpu size={26} />,
    title: 'Agile Engineering & Code Agent',
    desc: 'The Code Agent autonomously generates structured Agile user stories based on product vision. It continuously analyzes codebases, detects bugs, performs code correction, and deploys optimization strategies.',
    tags: ['User Story Generation', 'Code Correction', 'Optimization', 'Agile Automation'],
  },
];

// ── Main Component ──────────────────────────────────────────────────────
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showArchModal, setShowArchModal] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalText, setTerminalText] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ── Loading Screen ────────────────────────────────── */}
      <div className={`loading-screen ${!isLoading ? 'fade-out' : ''}`}>
        <img src="/imgs/loading.png" alt="Loading Autonomous Nova" className="loading-logo" />
      </div>

      {/* ── User Story Modal ────────────────────────────────── */}
      {showStoryModal && (
        <div className="modal-overlay" onClick={() => setShowStoryModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflowY: 'auto' }}>
          <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 850, padding: '3rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setShowStoryModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={28} />
            </button>
            
            <div className="badge" style={{ marginBottom: '1.5rem' }}>Our Evolution</div>
            <h2 style={{ fontSize: '2.4rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>The Nova Story: From Chaos to Autonomy</h2>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '3rem' }}>
              Building a startup ecosystem is inherently chaotic. Founders are constantly switching contexts between monitoring security, answering customer calls, researching competitors, and reviewing code. We built <b>Autonomous Nova</b> because we were tired of being the glue between fragmented dashboards. We needed an intelligence layer that didn't just report data, but <i>acted</i> on it.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              
              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', background: 'rgba(242, 136, 51, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f28833', fontWeight: 'bold', fontSize: '1.2rem', border: '2px solid rgba(242, 136, 51, 0.3)' }}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#fff' }}>Securing the Premise</h3>
                  <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    It started with physical security. Startups operating 24/7 needed reliable monitoring. We integrated Edge Cameras streaming chunks to S3, powered by <b>Nova 2 Lite's</b> vision reasoning to act as a tireless watchman, instantly identifying unauthorized faces via ChromaDB and pushing WebSocket alerts.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', background: 'rgba(242, 136, 51, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f28833', fontWeight: 'bold', fontSize: '1.2rem', border: '2px solid rgba(242, 136, 51, 0.3)' }}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#fff' }}>Handling the Noise</h3>
                  <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    Once secure, the phones started ringing. Customer support was overwhelming the core team. We deployed the <b>Call & Ticket Agent</b> using <b>Nova 2 Sonic</b> for zero-latency conversations. If an issue was complex, it queried our <b>Vector Database</b> driving the Multimodal Knowledge Base, instantly turning chaotic calls into structured SQLite tickets.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', background: 'rgba(242, 136, 51, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f28833', fontWeight: 'bold', fontSize: '1.2rem', border: '2px solid rgba(242, 136, 51, 0.3)' }}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#fff' }}>Scaling the Business</h3>
                  <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    With operations stabilized, we needed growth. Our <b>Market & Vendor Agent</b> was born. Utilizing <b>Nova Act</b>, it autonomously browses the web, researches competitor pricing via Tavily, and actively fills out vendor contact forms, transforming hours of manual research into an automated pipeline.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', background: 'rgba(242, 136, 51, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f28833', fontWeight: 'bold', fontSize: '1.2rem', border: '2px solid rgba(242, 136, 51, 0.3)' }}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: '#fff' }}>Iterating the Code</h3>
                  <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    Finally, we turned the AI back on ourselves. The <b>Agile & DevOps Functions</b> use <b>Nova Pro and Premier</b> models to review our repository URLs, scan for vulnerabilities, and generate code directly via AWS Lambda—ensuring the Nova ecosystem perpetually improves itself.
                  </p>
                </div>
              </div>

            </div>

            <div style={{ marginTop: '3.5rem', padding: '1.5rem', background: 'rgba(242, 136, 51, 0.1)', border: '1px solid rgba(242, 136, 51, 0.3)', borderRadius: 12, textAlign: 'center' }}>
              <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                This isn't just an ERP. It's an Autonomous Enterprise.
              </p>
            </div>
            
          </div>
        </div>
      )}

      {/* ── Terminal Deploy Overlay ───────────────────────────── */}
      {showTerminal && (
        <div className="modal-overlay" onClick={() => setShowTerminal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ width: '100%', maxWidth: 900, background: '#0d1117', borderRadius: 12, border: '1px solid #30363d', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#161b22', padding: '0.75rem 1rem', borderBottom: '1px solid #30363d', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
              <div style={{ color: '#8b949e', fontSize: '0.8rem', marginLeft: '1rem', fontFamily: 'monospace' }}>bash - nova-deploy</div>
              <button onClick={() => setShowTerminal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
              <div style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.95rem', color: '#c9d1d9', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                <span style={{ color: '#58a6ff' }}>nova</span> <span style={{ color: '#7ee787' }}>deploy</span> --production<br />
                {terminalText}
                {terminalText.includes('Done') && <span className="blink">_</span>}
              </div>
              <div>
                <img src="/imgs/web_7.png" alt="Deployment Output" style={{ width: '100%', borderRadius: 8, border: '1px solid #30363d', opacity: terminalText.includes('Done') ? 1 : 0.2, transition: 'opacity 1s ease' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ambient background glows */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="container nav-content">
          <a href="#" className="logo">
            <div className="logo-icon-wrap" style={{ background: 'transparent' }}>
              <img src="/nova.png" alt="Autonomous Nova" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            Autonomous Nova
          </a>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <a
              href="#modules"
              style={{ color: 'var(--text-main)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}
            >
              Modules
            </a>
            <Link to="/console" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', textDecoration: 'none' }}>
              Go to Console
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="hero">
          <div className="container">
            <div className="grid-2" style={{ gap: '4rem' }}>
              {/* Left — Copy */}
              <div>
                <Reveal delay={0.05}>
                  <div className="badge">
                    <Zap size={13} />
                    Powered by Amazon Nova
                  </div>
                </Reveal>

                <Reveal delay={0.15}>
                  <h1 className="hero-title">
                    The ERP that{' '}
                    <span className="text-gradient">Thinks,&nbsp;Monitors,</span>
                    <br />
                    and Acts Autonomously.
                  </h1>
                </Reveal>

                <Reveal delay={0.25}>
                  <p className="hero-subtitle">
                    Modern enterprises use too many disconnected tools. Autonomous Nova unifies security,
                    support, marketing, and cloud ops into a single AI-native platform powered by
                    foundation models.
                  </p>
                </Reveal>

                <Reveal delay={0.35}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <a href="https://github.com/Niteesh57/Nova_ERP_AEI_REACT" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                      <Github size={17} /> Deploy on GitHub
                    </a>
                    <button onClick={() => setShowArchModal(true)} className="btn btn-outline" style={{ textDecoration: 'none' }}>
                      View Full Architecture
                    </button>
                  </div>
                </Reveal>
              </div>

              {/* Right — Hero Image */}
              <Reveal delay={0.2}>
                <div className="hero-image-container">
                  <img src="/img_1.png" alt="Autonomous Enterprise Intelligence — Autonomous Nova" />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── Problem & Solution ───────────────────────────── */}
        <section>
          <div className="container">
            <div className="grid-2">
              <Reveal>
                <div>
                  <div className="badge" style={{ marginBottom: '1.25rem' }}>
                    The Problem
                  </div>
                  <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                    Enterprise <br />
                    <span className="text-gradient">Fragmentation</span>
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem', lineHeight: '1.75' }}>
                    Security monitoring, customer support, marketing, and cloud ops are run in
                    siloed tools. This fragmentation inflates cost, slows incident response, and
                    drains engineering teams.
                  </p>
                  <div style={{ display: 'flex', gap: '3rem' }}>
                    {[
                      { n: '4×', label: 'Operational Cost' },
                      { n: '60%', label: 'Slower Response' },
                    ].map(({ n, label }) => (
                      <div key={n}>
                        <div className="stat-number">{n}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.2}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div className="glass-panel" style={{ padding: '3rem' }}>
                    <h3 style={{ fontSize: '1.6rem', marginBottom: '1.25rem' }}>
                      The Autonomous Nova Answer
                    </h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: '1.7' }}>
                      A unified, AI-native ERP that doesn't just display dashboards — it observes,
                      reasons, and takes action using Amazon Nova foundation models.
                    </p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      {[
                        'Observes environment & data streams in real-time',
                        'Reasons autonomously using multimodal intelligence',
                        'Takes action without human bottlenecks',
                      ].map((t) => (
                        <li key={t} style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-main)' }}>
                          <ChevronRight size={18} style={{ color: 'var(--text-main)', flexShrink: 0, marginTop: 3 }} />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <img src="/imgs/web_4.png" alt="Platform capabilities" style={{ width: '100%', borderRadius: 20, border: '3px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', background: 'var(--bg-card)', padding: '0.4rem' }} />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── Modules ─────────────────────────────────────── */}
        <section id="modules">
          <div className="container">
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                <div className="badge" style={{ marginBottom: '1rem' }}>AI Modules</div>
                <h2 className="section-title">Intelligent Enterprise Agents</h2>
                <p className="section-subtitle" style={{ marginTop: '0.75rem' }}>
                  Four autonomous modules that observe, reason, and act — replacing passive dashboards with intelligent copilots.
                </p>
              </div>
            </Reveal>

            <div className="grid-2-cards">
              {modules.map((mod, i) => (
                <Reveal key={mod.title} delay={0.1 * i}>
                  <div className="feature-card">
                    <div className="feature-icon-wrapper">{mod.icon}</div>
                    <h3 className="feature-title">{mod.title}</h3>
                    <p className="feature-desc">{mod.desc}</p>

                    {mod.flow && (
                      <div className="arch-flow">
                        {mod.flow.map((f) => (
                          <div key={f.label} className={`arch-node ${f.highlight ? 'highlight' : ''}`}>
                            <span>{f.label}</span>
                            {f.highlight && <ChevronRight size={14} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {mod.tags && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.5rem' }}>
                        {mod.tags.map((tag) => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── Platform Preview ────────────────────────────── */}
        <section id="preview">
          <div className="container">
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                <div className="badge" style={{ marginBottom: '1rem' }}>Platform</div>
                <h2 className="section-title">Experience the Power of Nova</h2>
                <p className="section-subtitle" style={{ marginTop: '0.75rem' }}>
                  A unified interface that gives you complete control over your enterprise agents.
                </p>
              </div>
            </Reveal>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <Reveal delay={0.1}>
                <img src="/imgs/full_features.png" alt="Full Features" style={{ width: '100%', borderRadius: 24, border: '4px solid rgba(255,255,255,0.2)', boxShadow: '0 30px 60px rgba(0,0,0,0.4)', background: 'var(--bg-card)', padding: '0.5rem' }} />
              </Reveal>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <Reveal delay={0.2}>
                  <img src="/imgs/web_1.png" alt="Dashboard View" style={{ width: '100%', borderRadius: 20, border: '3px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', background: 'var(--bg-card)', padding: '0.4rem' }} />
                </Reveal>
                <Reveal delay={0.3}>
                  <img src="/imgs/web_2.png" alt="Agent Control Analytics" style={{ width: '100%', borderRadius: 20, border: '3px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', background: 'var(--bg-card)', padding: '0.4rem' }} />
                </Reveal>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
                <Reveal delay={0.4}>
                  <img src="/imgs/web_8.png" alt="Live Incident Resolution" style={{ width: '100%', borderRadius: 16, border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 15px 30px rgba(0,0,0,0.25)', background: 'var(--bg-card)', padding: '0.3rem' }} />
                </Reveal>
                <Reveal delay={0.5}>
                  <img src="/imgs/web_5.png" alt="Lead Generation Agent" style={{ width: '100%', borderRadius: 16, border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 15px 30px rgba(0,0,0,0.25)', background: 'var(--bg-card)', padding: '0.3rem' }} />
                </Reveal>
                <Reveal delay={0.6}>
                  <img src="/imgs/web_6.png" alt="Cloud Ops Automation" style={{ width: '100%', borderRadius: 16, border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 15px 30px rgba(0,0,0,0.25)', background: 'var(--bg-card)', padding: '0.3rem' }} />
                </Reveal>
              </div>
            </div>
          </div>
        </section>

      {/* ── Interactive Architecture Modal ────────────────────────────────── */}
      {showArchModal && (
        <div className="modal-overlay" onClick={() => setShowArchModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--bg-page)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', overflow: 'auto' }}>
          <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1200, height: '90vh', padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => setShowArchModal(false)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', zIndex: 10 }}>
              <X size={28} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '2rem' }}>Autonomous Nova Architecture Flow</h2>
              <p style={{ color: 'var(--text-muted)' }}>Grounded view of the exact backend microservices handling video, voice, and codebase generation.</p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', padding: '0.5rem' }}>
                
                {/* Surveillance Pillar */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.75rem', background: 'rgba(242, 136, 51, 0.15)', color: '#f28833', borderRadius: '12px', display: 'flex' }}>
                        <Lock size={24} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Autonomous Surveillance</h3>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Real-time video chunk analysis and facial identification pipeline.</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Data Flow</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: '#f28833' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Webcam</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>S3</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>Nova 2 Lite</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>OpenCV</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>ChromaDB</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>WebSocket Alert</span>
                    </div>
                  </div>
                </div>

                {/* Call Agent Pillar */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.75rem', background: 'rgba(242, 136, 51, 0.15)', color: '#f28833', borderRadius: '12px', display: 'flex' }}>
                        <Activity size={24} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Voice & Ticket Agent</h3>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Zero-latency conversational engine and context retrieval flow.</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Data Flow</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: '#f28833' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>User Query</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>Nova Embeddings (KB)</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>Nova 2 Sonic</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Voice / SQLite Ticket</span>
                    </div>
                  </div>
                </div>

                {/* Vendor / Market Pillar */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.75rem', background: 'rgba(242, 136, 51, 0.15)', color: '#f28833', borderRadius: '12px', display: 'flex' }}>
                        <Cloud size={24} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Market & Vendor Agent</h3>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Autonomous web scraping, competitor analysis, and outreach automation.</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Data Flow</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: '#f28833' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Product Idea</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>Nova Act (Tavily)</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Scrape Competitors & Fill Forms</span>
                    </div>
                  </div>
                </div>

                {/* DevOps / Functions Pillar */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '0.75rem', background: 'rgba(242, 136, 51, 0.15)', color: '#f28833', borderRadius: '12px', display: 'flex' }}>
                        <Code2 size={24} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Agile & DevOps Functions</h3>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Code generation, review operations, and infrastructure scaling pipelines.</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Data Flow</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: '#f28833' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>Repo URL</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>Nova Pro/Premier</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>AWS Lambda</span>
                      <ArrowRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>SSE Stream (Result)</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

        <div className="section-divider" />

        {/* ── How It Works ────────────────────────────────── */}
        <section id="architecture">
          <div className="container">
            <div className="grid-2" style={{ gap: '4rem' }}>
              <Reveal>
                <div className="glass-panel" style={{ padding: '3rem' }}>
                  <div className="badge" style={{ marginBottom: '1.25rem' }}>Architecture</div>
                  <h3 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>
                    Observe → Reason → Act
                  </h3>
                  {[
                    { icon: <Lock size={16} />, label: 'Data Ingestion', detail: 'S3 Video, Web Scraping, Bedrock Audio Streams' },
                    { icon: <Activity size={16} />, label: 'Nova & Bedrock AI Core', detail: 'Real-time Multimodal Reasoning & Vector Embeddings' },
                    { icon: <Cloud size={16} />, label: 'Autonomous Execution', detail: 'Agile Code Correction, Ticket Gen, Intrusion Alerts' },
                  ].map(({ icon, label, detail }, idx) => (
                    <div key={label} style={{ display: 'flex', gap: '1rem', marginBottom: idx < 2 ? '1.25rem' : 0 }}>
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-main)',
                        }}
                      >
                        {icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{label}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.2}>
                <div>
                  <div className="badge" style={{ marginBottom: '1.25rem' }}>The Inspiration</div>
                  <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
                    What if an ERP could reason & act on its own?
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.75, marginBottom: '2rem' }}>
                    What if an ERP could reason & act on its own? We built Autonomous Nova because operators were forced to manually parse dashboards and connect siloed tools. We replaced placeholders with grounded AI brains — powered by Amazon Nova — that actively monitor inputs across surveillance, voice calls, and codebases to execute actions directly.
                  </p>
                  <img src="/imgs/web_9.png" alt="Architecture Inspiration" style={{ width: '100%', borderRadius: 16, border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 15px 30px rgba(0,0,0,0.25)', background: 'var(--bg-card)', padding: '0.3rem', marginBottom: '2rem' }} />
                  <button className="btn btn-outline" onClick={() => setShowStoryModal(true)}>
                    Read the Full Story <ArrowRight size={16} />
                  </button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── CTA ─────────────────────────────────────────── */}
        <section style={{ paddingBottom: '6rem' }}>
          <div className="container">
            <Reveal>
              <div
                className="glass-panel"
                style={{ padding: '5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
              >
                <div className="badge" style={{ marginBottom: '1.5rem' }}>Get Started</div>
                <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '1.25rem' }}>
                  Ready to unify your enterprise?
                </h2>
                <p
                  style={{
                    color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: 640,
                    margin: '0 auto 2.5rem', lineHeight: 1.7,
                  }}
                >
                  Join forward-thinking enterprises using Autonomous Nova. Ditch the legacy dashboards and implement grounding AI agents for Surveillance, Call Handling, Lead Generation, and Code Operations today.
                </p>
                <img src="/imgs/imag_3.png" alt="Get Started with Nova" style={{ width: '100%', maxWidth: 700, margin: '0 auto 3rem', borderRadius: 20, border: '3px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', background: 'var(--bg-card)', padding: '0.4rem', display: 'block' }} />
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '1rem 2.5rem', fontSize: '1.05rem' }}
                  onClick={() => {
                    setShowTerminal(true);
                    setTerminalText('');
                    const text = '> Authenticating with AWS...\n> Spinning up Bedrock Streaming...\n> Connecting Surveillance to S3...\n> Establishing ChromaDB Vector Store...\n> Deploying Lead Agents...\n> Starting Auto-Codegen Service...\n\n[SUCCESS] Autonomous Nova Deployed. Done in 4.2s.';
                    let i = 0;
                    const interval = setInterval(() => {
                      setTerminalText(text.substring(0, i));
                      i++;
                      if (i > text.length) clearInterval(interval);
                    }, 25);
                  }}
                >
                  Deploy NOVA Today <ArrowRight size={18} />
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer>
        <span>© {new Date().getFullYear()} Autonomous Nova · Powered by Amazon Nova · All rights reserved.</span>
      </footer>
    </>
  );
}
