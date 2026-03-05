import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, Camera, Square as StopCircle, Plus, Trash2 } from 'lucide-react';
import '../index.css';

// Types matched to the backend endpoints
interface EventItem {
    name: string;
    description: string;
}

interface LogEntry {
    timestamp: string;
    summary: string;
    results: Record<string, boolean>;
    s3_uri?: string;
}

// Ensure the frontend aims at the FastAPI backend at port 8000
const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

export default function Console() {
    // Core state
    const [status, setStatus] = useState<'Stopped' | 'Ready' | 'Running'>('Stopped');
    const [events, setEvents] = useState<EventItem[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [latestResults, setLatestResults] = useState<Record<string, boolean>>({});

    // Library & Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [libraryEvents, setLibraryEvents] = useState<EventItem[]>([]);
    const [selectedTriggers, setSelectedTriggers] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
    const [history, setHistory] = useState<LogEntry[]>([]);

    // Refs for media and polling
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const isRecordingRef = useRef(false);

    const CHUNK_MS = 30000; // 30 seconds

    // Initialize
    useEffect(() => {
        connectWS();
        loadEvents();
        checkStatus();
        searchLibrary(''); // Initial load of triggers

        return () => {
            // Cleanup
            if (wsRef.current) wsRef.current.close();
            stopSurveillance(true);
        };
    }, []);

    // ── WebSocket ──────────────────────────────────────────────────────────
    const connectWS = () => {
        if (wsRef.current) wsRef.current.close();
        wsRef.current = new WebSocket(WS_URL);

        wsRef.current.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'event_result') {
                    setLatestResults(data.results || {});
                    setLogs(prev => [data, ...prev].slice(0, 50));
                } else if (data.error) {
                    setLogs(prev => [{ timestamp: new Date().toISOString(), summary: `⚠️ Server Error: ${data.error}`, results: {} }, ...prev].slice(0, 50));
                }
            } catch (err) {
                console.error("WS Parse error", err);
            }
        };

        wsRef.current.onclose = () => {
            setTimeout(connectWS, 3000); // Reconnect loop
        };
    };

    // ── API Calls ──────────────────────────────────────────────────────────
    const checkStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/surveillance/status`);
            const data = await res.json();
            if (data.running) setStatus('Ready');
        } catch {
            console.warn("Could not check status - is backend running?");
        }
    };

    const loadEvents = async () => {
        try {
            const res = await fetch(`${API_BASE}/events/`);
            if (!res.ok) {
                setEvents([]);
                return;
            }
            const data = await res.json();
            setEvents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load events", err);
            setEvents([]);
        }
    };

    const searchLibrary = async (q: string) => {
        try {
            const res = await fetch(`${API_BASE}/events/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setLibraryEvents(data);
        } catch (err) {
            console.error("Search failed", err);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => searchLibrary(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const toggleTriggerSelection = (name: string) => {
        setSelectedTriggers(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const activateSelected = async () => {
        if (selectedTriggers.size === 0) return;
        try {
            const res = await fetch(`${API_BASE}/events/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Array.from(selectedTriggers))
            });
            if (res.ok) {
                setSelectedTriggers(new Set());
                loadEvents();
            }
        } catch (err) {
            console.error("Activation failed", err);
        }
    };

    const loadHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/history/`);
            const data = await res.json();
            setHistory(data.items || []);
        } catch (err) {
            console.error("History load failed", err);
        }
    };

    const addEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventName || !newEventDesc) return;

        try {
            const res = await fetch(`${API_BASE}/events/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newEventName, description: newEventDesc })
            });
            if (res.ok) {
                setNewEventName('');
                setNewEventDesc('');
                loadEvents();
                searchLibrary(''); // Refresh library
            } else {
                const err = await res.json();
                alert(err.detail || 'Error adding event');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to connect to backend.');
        }
    };

    const deleteEvent = async (name: string) => {
        try {
            await fetch(`${API_BASE}/events/${name}`, { method: 'DELETE' });
            loadEvents();
            searchLibrary(''); // Refresh library
        } catch (e) {
            console.error(e);
        }
    };

    // ── Media Capture ──────────────────────────────────────────────────────
    const initCamera = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            let mimeType = 'video/webm; codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                recordedChunksRef.current = []; // Reset

                // If we are still "Running", kick off next chunk immediately
                if (isRecordingRef.current) {
                    recorder.start();
                    setTimeout(() => {
                        if (isRecordingRef.current && recorder.state === 'recording') {
                            recorder.stop();
                        }
                    }, CHUNK_MS);
                }

                // Upload the finished chunk
                uploadChunk(blob);
            };

            return true;
        } catch (err) {
            console.error("Camera access denied or unavailable", err);
            alert("Please allow camera access to start surveillance.");
            return false;
        }
    };

    const uploadChunk = async (blob: Blob) => {
        const formData = new FormData();
        formData.append('file', blob, 'surveillance_chunk.webm');
        try {
            await fetch(`${API_BASE}/surveillance/upload`, {
                method: 'POST',
                body: formData
            });
        } catch (err) {
            console.error("Upload failed", err);
        }
    };

    const startSurveillance = async () => {
        if (status === 'Running') return;

        const camReady = await initCamera();
        if (!camReady) return;

        try {
            await fetch(`${API_BASE}/surveillance/start`, { method: 'POST' });
            setStatus('Running');
            isRecordingRef.current = true;

            const rec = mediaRecorderRef.current;
            if (rec) {
                rec.start();
                setTimeout(() => {
                    if (isRecordingRef.current && rec.state === 'recording') {
                        rec.stop();
                    }
                }, CHUNK_MS);
            }
        } catch (err) {
            console.error(err);
            alert("Could not tell backend to start. Is it running?");
        }
    };

    const stopSurveillance = async (isUnmounting = false) => {
        isRecordingRef.current = false;
        const rec = mediaRecorderRef.current;

        if (rec && rec.state !== 'inactive') {
            rec.stop();
        }

        if (!isUnmounting && videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }

        if (!isUnmounting) {
            try {
                await fetch(`${API_BASE}/surveillance/stop`, { method: 'POST' });
                setStatus('Stopped');
            } catch {
                // Ignore on cleanup
            }
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* Navbar */}
            <nav className="navbar" style={{ position: 'sticky', top: 0, padding: '1rem 0', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', zIndex: 100 }}>
                <div className="container nav-content">
                    <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
                        <div className="logo-icon-wrap">
                            <Activity size={18} strokeWidth={3} />
                        </div>
                        NOVA ERP Console
                    </Link>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div className="badge" style={{ marginBottom: 0, border: `1px solid ${status === 'Running' ? '#22c55e' : 'var(--border)'}`, color: status === 'Running' ? '#ffffff' : 'var(--text-main)', background: status === 'Running' ? '#22c55e' : 'rgba(0,0,0,0.1)' }}>
                            {status === 'Running' ? '● Recording' : status}
                        </div>
                        <Link to="/" className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                            <ArrowLeft size={16} /> Exit
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="container" style={{ padding: '1rem 2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
                    <button
                        onClick={() => setActiveTab('live')}
                        style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: activeTab === 'live' ? 'var(--accent)' : 'var(--muted)', fontWeight: 600, borderBottom: activeTab === 'live' ? '2px solid var(--accent)' : 'none', cursor: 'pointer' }}
                    >
                        📹 Live Surveillance
                    </button>
                    <button
                        onClick={() => { setActiveTab('history'); loadHistory(); }}
                        style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: activeTab === 'history' ? 'var(--accent)' : 'var(--muted)', fontWeight: 600, borderBottom: activeTab === 'history' ? '2px solid var(--accent)' : 'none', cursor: 'pointer' }}
                    >
                        🗂 Detection History
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="container" style={{ padding: '0 2rem 2rem', flex: 1 }}>

                {activeTab === 'live' ? (
                    <div className="grid-2" style={{ gap: '2rem', alignItems: 'start' }}>

                        {/* Left Column: Video & Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Camera size={20} /> Live Client Video
                                    </h3>
                                </div>

                                <div style={{
                                    width: '100%',
                                    aspectRatio: '16/9',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    border: '1px solid var(--border)'
                                }}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'Running' ? 'block' : 'none' }}
                                    />
                                    {status !== 'Running' && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: '1rem' }}>
                                            <Camera size={48} style={{ opacity: 0.5 }} />
                                            <p>Start surveillance to access webcam</p>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                    <button
                                        onClick={startSurveillance}
                                        disabled={status === 'Running'}
                                        className="btn btn-primary"
                                        style={{ flex: 1, opacity: status === 'Running' ? 0.5 : 1 }}
                                    >
                                        ▶ Start
                                    </button>
                                    <button
                                        onClick={() => stopSurveillance()}
                                        disabled={status !== 'Running'}
                                        className="btn btn-outline"
                                        style={{ flex: 1, borderColor: status === 'Running' ? '#ef4444' : 'var(--border)', color: status === 'Running' ? '#ef4444' : 'inherit' }}
                                    >
                                        <StopCircle size={18} /> Stop
                                    </button>
                                </div>
                            </div>

                            {/* Results Log */}
                            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📋 Nova Detection Log</h3>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {logs.length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                                            No results yet. Start surveillance and wait 30 seconds.
                                        </div>
                                    ) : (
                                        logs.map((log, i) => (
                                            <div key={i} style={{ background: 'rgba(0,0,0,0.15)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                                                <div style={{ color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: log.summary ? '0.5rem' : 0 }}>
                                                    {Object.entries(log.results || {}).length > 0 ? (
                                                        Object.entries(log.results).map(([k, v]) => (
                                                            <span key={k} style={{ background: v ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: v ? '#22c55e' : '#ef4444', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                                {k}: {v ? 'TRUE' : 'FALSE'}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>No events evaluated</span>
                                                    )}
                                                </div>
                                                {log.summary && <div style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: '0.85rem' }}>{log.summary}</div>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Events Configuration */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Plus size={20} /> Add Event Trigger
                                </h3>
                                <form onSubmit={addEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'rgba(255,255,255,0.8)' }}>Event Name</label>
                                        <input
                                            type="text"
                                            value={newEventName}
                                            onChange={e => setNewEventName(e.target.value)}
                                            placeholder="e.g. person_opening_door"
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', color: 'white', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: 'rgba(255,255,255,0.8)' }}>Description</label>
                                        <input
                                            type="text"
                                            value={newEventDesc}
                                            onChange={e => setNewEventDesc(e.target.value)}
                                            placeholder="e.g. A person is opening the door"
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', color: 'white', outline: 'none' }}
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-outline" style={{ marginTop: '0.5rem', borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center' }}>
                                        + Add Event
                                    </button>
                                </form>
                            </div>

                            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>⚡ Active Events</h3>
                                {events.length === 0 ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                                        No events configured yet.
                                    </div>
                                ) : (
                                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {events.map(ev => {
                                            const result = latestResults[ev.name];
                                            const isDef = result !== undefined;

                                            return (
                                                <li key={ev.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                    <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{ev.name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.description}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '100px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: isDef ? (result ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)') : 'rgba(255,255,255,0.1)',
                                                            color: isDef ? (result ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.5)'
                                                        }}>
                                                            {isDef ? (result ? 'TRUE' : 'FALSE') : 'PENDING'}
                                                        </span>
                                                        <button onClick={() => deleteEvent(ev.name)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0.25rem' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📚 Triggers Library
                                </h3>
                                <input
                                    type="text"
                                    placeholder="Search library..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', color: 'white', marginBottom: '1rem', fontSize: '0.85rem' }}
                                />
                                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {libraryEvents.length === 0 ? (
                                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>No results</p>
                                    ) : (
                                        libraryEvents.map(ev => {
                                            const isActive = events.some(e => e.name === ev.name);
                                            return (
                                                <div key={ev.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        disabled={isActive}
                                                        checked={selectedTriggers.has(ev.name)}
                                                        onChange={() => toggleTriggerSelection(ev.name)}
                                                    />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ev.name}</div>
                                                        {isActive && <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>Active</span>}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <button
                                    className="btn btn-outline"
                                    style={{ width: '100%', fontSize: '0.85rem' }}
                                    onClick={activateSelected}
                                    disabled={selectedTriggers.size === 0}
                                >
                                    Activate Selected ({selectedTriggers.size})
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>🗂 Full Detection History</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.8rem' }}>
                                        <th style={{ padding: '1rem' }}>Timestamp</th>
                                        <th style={{ padding: '1rem' }}>Event Results</th>
                                        <th style={{ padding: '1rem' }}>Summary</th>
                                        <th style={{ padding: '1rem' }}>S3 Link</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No history found</td></tr>
                                    ) : (
                                        history.map((row, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                                                <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{new Date(row.timestamp).toLocaleString()}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                        {Object.entries(row.results || {}).map(([k, v]) => (
                                                            <span key={k} style={{ padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', background: v ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: v ? '#22c55e' : '#ef4444' }}>
                                                                {k}: {v ? 'YES' : 'NO'}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{row.summary}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    {row.s3_uri && (
                                                        <a href={row.s3_uri} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '0.75rem', textDecoration: 'none' }}>
                                                            {row.s3_uri.split('/').pop()}
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
