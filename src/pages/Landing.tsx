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
    title: 'Security Event Intelligence',
    desc: 'Live video streams in Amazon S3 analyzed using Nova multimodal reasoning. User-defined events like "someone enters this door" trigger instant alerts, calls, and incident logs.',
    flow: [
      { label: 'Live Camera Frame → S3', highlight: false },
      { label: 'Nova Multimodal Confidence > 80%', highlight: true },
      { label: 'Auto-Call + Alert + Log', highlight: false },
    ],
  },
  {
    icon: <MessageSquareWarning size={26} />,
    title: 'Intelligent Complaint Resolution',
    desc: 'Email or call triggers Nova to classify the issue, run vector search on historical tickets, generate a resolution — and either auto-respond or escalate to human.',
    flow: [
      { label: 'Incoming Ticket (Email / Call)', highlight: false },
      { label: 'Vector Search + Nova GenAI', highlight: true },
      { label: 'Auto-Resolve  |  Escalate', highlight: false },
    ],
  },
  {
    icon: <Target size={26} />,
    title: 'Vendor Search Automation',
    desc: 'Targeted outbound intelligence. Nova identifies audience signals by role, industry, and tech stack, scores vendors, and drafts hyper-personalized outreach — no spam.',
    tags: ['Vendor Match', 'Tech Stack Match', 'Vendor Scoring', 'Automated Outreach'],
  },
  {
    icon: <Cpu size={26} />,
    title: 'DevOps & AWS Optimization',
    desc: 'Connect your AWS account securely. The Nova agent continuously monitors EC2, RDS, Lambda, and costs — detecting over-provisioning, idle resources, and predicting spikes.',
    tags: ['EC2 Utilization', 'RDS Health', 'Lambda Errors', 'Cost Anomalies', 'Deploy Logs'],
  },
];

// ── Main Component ──────────────────────────────────────────────────────
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Ambient background glows */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="container nav-content">
          <a href="#" className="logo">
            <div className="logo-icon-wrap">
              <Activity size={18} strokeWidth={3} />
            </div>
            NOVA ERP
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
                    Modern enterprises use too many disconnected tools. NOVA ERP unifies security,
                    support, marketing, and cloud ops into a single AI-native platform powered by
                    foundation models.
                  </p>
                </Reveal>

                <Reveal delay={0.35}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary">
                      Start Free Trial <ArrowRight size={17} />
                    </button>
                    <button className="btn btn-outline">
                      View Architecture
                    </button>
                  </div>
                </Reveal>
              </div>

              {/* Right — Hero Image */}
              <Reveal delay={0.2}>
                <div className="hero-image-container">
                  <img src="/img_1.png" alt="Autonomous Enterprise Intelligence — NOVA ERP" />
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
                <div className="glass-panel" style={{ padding: '3rem' }}>
                  <h3 style={{ fontSize: '1.6rem', marginBottom: '1.25rem' }}>
                    The NOVA ERP Answer
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

        {/* ── How It Works ────────────────────────────────── */}
        <section>
          <div className="container">
            <div className="grid-2" style={{ gap: '4rem' }}>
              <Reveal>
                <div className="glass-panel" style={{ padding: '3rem' }}>
                  <div className="badge" style={{ marginBottom: '1.25rem' }}>Architecture</div>
                  <h3 style={{ fontSize: '1.6rem', marginBottom: '1.5rem' }}>
                    Observe → Reason → Act
                  </h3>
                  {[
                    { icon: <Lock size={16} />, label: 'Data Ingestion', detail: 'S3, Email, AWS APIs, Camera Feeds' },
                    { icon: <Activity size={16} />, label: 'Nova Foundation Model', detail: 'Multimodal reasoning & classification' },
                    { icon: <Cloud size={16} />, label: 'Autonomous Action', detail: 'Alerts, resolutions, outreach, optimizations' },
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
                  <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.75, marginBottom: '1.5rem' }}>
                    That question sparked NOVA ERP. Instead of forcing operators to switch between
                    tools and manually parse dashboards, we gave each module an AI brain — powered
                    by Amazon Nova — that actively monitors inputs and takes the next appropriate
                    action.
                  </p>
                  <button className="btn btn-outline">
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
                    color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: 560,
                    margin: '0 auto 2.5rem', lineHeight: 1.7,
                  }}
                >
                  Join forward-thinking enterprises using NOVA ERP to autonomously secure
                  facilities, resolve tickets, capture vendors, and optimize cloud operations.
                </p>
                <button className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.05rem' }}>
                  Deploy NOVA Today <ArrowRight size={18} />
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer>
        <span>© {new Date().getFullYear()} NOVA ERP · Powered by Amazon Nova · All rights reserved.</span>
      </footer>
    </>
  );
}
