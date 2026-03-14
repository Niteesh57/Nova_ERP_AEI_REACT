import { useEffect, useRef, useState } from 'react';
import { Activity, Camera, Square as StopCircle, Plus, Trash2, X, History, Users, Upload, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import '../index.css';

// Types matched to the backend endpoints
interface EventItem {
    name: string;
    description: string;
    authorized_employees?: string[] | null;
}

interface IdentifiedPerson {
    id?: number;
    name: string;
    email: string | null;
}

interface LogEntry {
    timestamp: string;
    summary: string;
    results: Record<string, number | boolean>;
    s3_uri?: string;
    identified_persons?: IdentifiedPerson[] | null;
    alerts?: string[] | null;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws`;

export default function Console() {
    // Core state
    const [status, setStatus] = useState<'Stopped' | 'Ready' | 'Running'>('Stopped');
    const [events, setEvents] = useState<EventItem[]>([]);
    
    // UI Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // Data state
    const [employees, setEmployees] = useState<IdentifiedPerson[]>([]);
    const [history, setHistory] = useState<LogEntry[]>([]);
    const [isFullView, setIsFullView] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [manualResult, setManualResult] = useState<LogEntry | null>(null);

    // New event form state
    const [newEventName, setNewEventName] = useState('');
    const [newEventDesc, setNewEventDesc] = useState('');
    const [newEventAuthEmps, setNewEventAuthEmps] = useState<string[]>([]); // Array of names
    const [employeeSearch, setEmployeeSearch] = useState('');

    // Refs for media and polling
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const isRecordingRef = useRef(false);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    const CHUNK_MS = 30000; // 30 seconds

    // Initialize
    useEffect(() => {
        loadEvents();
        checkStatus();
        loadEmployees(); 

        return () => {
            if (wsRef.current) wsRef.current.close();
            stopSurveillance(true);
        };
    }, []);

    // ── WebSocket ──────────────────────────────────────────────────────────
    const connectWS = () => {
        if (!isRecordingRef.current) return;
        if (wsRef.current) wsRef.current.close();
        
        wsRef.current = new WebSocket(WS_URL);
        wsRef.current.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.error) {
                    console.error("Server Error:", data.error);
                }
            } catch (err) {
                console.error("WS Parse error", err);
            }
        };

        wsRef.current.onclose = () => {
            if (isRecordingRef.current) {
                setTimeout(connectWS, 3000); 
            }
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
            if (!res.ok) { setEvents([]); return; }
            const data = await res.json();
            setEvents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load events", err);
            setEvents([]);
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

    const loadEmployees = async () => {
        try {
            const res = await fetch(`${API_BASE}/employees/`);
            const data = await res.json();
            setEmployees(data || []);
        } catch (err) {
            console.error("Failed to load employees", err);
        }
    };



    const addEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventName || !newEventDesc) return;
        
        const emps = newEventAuthEmps;

        try {
            const res = await fetch(`${API_BASE}/events/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newEventName, 
                    description: newEventDesc,
                    authorized_employees: emps.length > 0 ? emps : null
                })
            });
            if (res.ok) {
                setNewEventName('');
                setNewEventDesc('');
                setNewEventAuthEmps([]);
                setEmployeeSearch('');
                loadEvents();
                setShowAddModal(false);
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
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                recordedChunksRef.current = []; 
                if (isRecordingRef.current) {
                    recorder.start();
                    setTimeout(() => {
                        if (isRecordingRef.current && recorder.state === 'recording') recorder.stop();
                    }, CHUNK_MS);
                }
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
                method: 'POST', body: formData
            });
        } catch (err) { console.error("Upload failed", err); }
    };

    const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setManualResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/surveillance/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setManualResult(data);
                loadHistory(); // Refresh history to show the new analysis
            } else {
                alert(data.detail || 'Upload failed');
            }
        } catch (err) {
            console.error("Manual upload failed", err);
            alert('Failed to upload video');
        } finally {
            setIsUploading(false);
            if (uploadInputRef.current) uploadInputRef.current.value = '';
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
            connectWS();

            const rec = mediaRecorderRef.current;
            if (rec) {
                rec.start();
                setTimeout(() => {
                    if (isRecordingRef.current && rec.state === 'recording') rec.stop();
                }, CHUNK_MS);
            }
        } catch (err) {
            console.error(err);
            alert("Could not tell backend to start. Is it running?");
        }
    };

    const stopSurveillance = async (isUnmounting = false) => {
        isRecordingRef.current = false;
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== 'inactive') rec.stop();

        if (!isUnmounting && videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }

        if (!isUnmounting) {
            try {
                await fetch(`${API_BASE}/surveillance/stop`, { method: 'POST' });
                setStatus('Stopped');
            } catch { /* Ignore */ }
        }
    };

    // --- Helpers for Styling ---
    // Azure CLI / Microsoft style: clean, plain, mostly white backgrounds, black text, sparse thin borders, #f97316 (orange) for accents
    const azureModalStyle: React.CSSProperties = {
        position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'
    };
    
    const azureModalContentStyle: React.CSSProperties = {
        background: '#ffffff',
        border: '1px solid #d1d5db',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
        borderRadius: '0px', 
        display: 'flex', flexDirection: 'column'
    };

    const orangeBtn = {
        backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0.6rem 1.2rem',
        fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
    };

    const darkBtn = {
        backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '0.6rem 1.2rem',
        fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
    };

    const outlineBtn = {
        backgroundColor: 'transparent', color: '#111827', border: '1px solid #d1d5db', padding: '0.6rem 1.2rem',
        fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
    };

    return (
        <Layout>
            {/* FULL SCREEN SURVEILLANCE LAYER */}
            <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)', background: '#ffffff', overflow: 'hidden' }}>
                
                {/* Navbar within the frame */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, borderBottom: '1px solid #e5e7eb', background: 'rgba(255,255,255,0.95)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Activity color="#f97316" size={24} />
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>Live Surveillance Console</h1>
                        <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', border: `1px solid ${status === 'Running' ? '#f97316' : '#d1d5db'}`, color: status === 'Running' ? '#f97316' : '#6b7280' }}>
                            {status === 'Running' ? '● RECORDING' : 'STOPPED'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <input 
                            type="file" 
                            ref={uploadInputRef} 
                            onChange={handleManualUpload} 
                            accept="video/*" 
                            style={{ display: 'none' }} 
                        />
                        <button 
                            onClick={() => uploadInputRef.current?.click()} 
                            style={outlineBtn} 
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <> <Loader2 size={16} className="spin" /> Processing... </>
                            ) : (
                                <> <Upload size={16} /> Upload Video </>
                            )}
                        </button>
                        <button onClick={() => setShowAddModal(true)} style={orangeBtn}>
                            <Plus size={16} /> Add Event
                        </button>
                        <button onClick={() => { setShowHistoryModal(true); loadHistory(); }} style={outlineBtn}>
                            <History size={16} color="#6b7280" /> View History
                        </button>
                        <button onClick={() => setIsFullView(!isFullView)} style={outlineBtn}>
                            <Camera size={16} color="#6b7280" /> {isFullView ? 'Exit Full View' : 'Full View'}
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes pulse {
                        0% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.3; transform: scale(0.9); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                `}</style>
                {/* Video Area Full Width */}
                <div style={{ 
                    position: isFullView ? 'fixed' : 'absolute', 
                    top: isFullView ? 0 : '70px', 
                    left: isFullView ? 0 : '2rem', 
                    right: isFullView ? 0 : '2rem', 
                    bottom: isFullView ? 0 : '2rem', 
                    background: '#000', 
                    borderRadius: isFullView ? '0px' : '8px', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    zIndex: isFullView ? 1000 : 1,
                    transition: 'all 0.3s ease'
                }}>
                    {isFullView && (
                        <button 
                            onClick={() => setIsFullView(false)} 
                            style={{ 
                                position: 'absolute', 
                                top: '2rem', 
                                right: '2rem', 
                                zIndex: 1010, 
                                background: 'rgba(0,0,0,0.5)', 
                                border: '1px solid rgba(255,255,255,0.3)', 
                                color: '#fff', 
                                padding: '0.5rem', 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={24} />
                        </button>
                    )}
                    <video
                        ref={videoRef}
                        autoPlay muted playsInline
                        // DSLR style contrast/greyscale hint, fit cover to fill screen
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'Running' ? 'block' : 'none' /*, filter: 'contrast(1.05) brightness(0.95)'*/ }}
                    />
                    
                    {/* DSLR Overlay Wrapper */}
                    {status === 'Running' && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', padding: '2rem', color: '#fff', fontFamily: 'monospace', zIndex: 5 }}>
                            {/* REC & Timer */}
                            <div style={{ position: 'absolute', top: '2rem', left: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                                <span style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '0.1em' }}>REC</span>
                                <span style={{ fontSize: '1.25rem', marginLeft: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                                    {new Date().toISOString().substring(11, 19)}
                                </span>
                            </div>

                            {/* Camera Info Top Right */}
                            <div style={{ position: 'absolute', top: '2rem', right: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '1.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                <span>F2.8</span>
                                <span>1/60</span>
                                <span>ISO 800</span>
                                <div style={{ border: '2px solid #fff', width: '34px', height: '16px', padding: '2px', borderRadius: '2px' }}>
                                    <div style={{ background: '#fff', width: '75%', height: '100%' }} />
                                </div>
                            </div>

                            {/* Center Crosshairs */}
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                                {/* Center Dot */}
                                <div style={{ width: '4px', height: '4px', background: '#fff', borderRadius: '50%' }} />
                                {/* Brackets */}
                                <div style={{ position: 'absolute', width: '400px', height: '250px', border: '2px solid #fff', borderRadius: '12px' }} />
                                {/* Small inner dashes */}
                                <div style={{ position: 'absolute', width: '150px', height: '2px', background: 'rgba(255,255,255,0.4)' }} />
                                <div style={{ position: 'absolute', width: '2px', height: '150px', background: 'rgba(255,255,255,0.4)' }} />
                            </div>


                        </div>
                    )}
                    {status !== 'Running' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9ca3af', gap: '1rem' }}>
                            <Camera size={48} color="#d1d5db" />
                            <p style={{ margin: 0 }}>Video feed inactive. Click "Start Surveillance".</p>
                            <button onClick={startSurveillance} style={darkBtn}>Start Now</button>
                        </div>
                    )}

                    {/* Overlay Camera Controls inside video bounds */}
                    {status === 'Running' && (
                        <div style={{ position: 'absolute', bottom: '2rem', right: '2rem', zIndex: 10 }}>
                            <button onClick={() => stopSurveillance()} style={{ ...darkBtn, backgroundColor: '#ef4444', border: '1px solid #7f1d1d', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                                <StopCircle size={16} fill="#fff" /> Stop Recording
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS */}
            
            {/* Add Event Modal */}
            {showAddModal && (
                <div style={azureModalStyle}>
                    <div style={azureModalContentStyle}>
                        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={20} color="#f97316" /> Configure Event Evaluator
                            </h2>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#6b7280" /></button>
                        </div>
                        
                        <div style={{ display: 'flex', padding: '2rem', justifyContent: 'center' }}>
                            {/* Create New */}
                            <div style={{ flex: 1, maxWidth: '600px' }}>
                                <h3 style={{ fontSize: '1rem', color: '#111827', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Create Custom Event Analyzer</h3>
                                <form onSubmit={addEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.4rem' }}>Event Identifier (snake_case)</label>
                                        <input type="text" value={newEventName} onChange={e => setNewEventName(e.target.value)} required placeholder="e.g. unknown_person_entered" style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.4rem' }}>Condition Description</label>
                                        <input type="text" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} required placeholder="e.g. A person is seen entering the restricted area" style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.4rem' }}>
                                            Authorized Employees (Select allowed persons)
                                        </label>
                                        <input 
                                            type="text" 
                                            placeholder="Search employees..." 
                                            value={employeeSearch}
                                            onChange={e => setEmployeeSearch(e.target.value)}
                                            style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.85rem', marginBottom: '0.5rem' }} 
                                        />
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #d1d5db', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {employees.length === 0 ? <p style={{fontSize: '0.8rem', color: '#9ca3af', margin: 0}}>No employees found.</p> : 
                                             employees.filter(emp => emp.name.toLowerCase().includes(employeeSearch.toLowerCase())).map(emp => (
                                                <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#111827' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={newEventAuthEmps.includes(emp.name)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setNewEventAuthEmps(prev => [...prev, emp.name]);
                                                            else setNewEventAuthEmps(prev => prev.filter(n => n !== emp.name));
                                                        }}
                                                    />
                                                    {emp.name}
                                                </label>
                                            ))}
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.4rem', margin: 0 }}>If set, anyone else performing this action will raise an Intrusion Alert.</p>
                                    </div>
                                    <button type="submit" style={{ ...orangeBtn, alignSelf: 'flex-start', marginTop: '0.5rem' }}>Register Event</button>
                                </form>
                            </div>
                            
                            {/* Existing Events List */}
                            <div style={{ flex: 1, maxWidth: '400px', marginLeft: '2rem', borderLeft: '1px solid #e5e7eb', paddingLeft: '2rem' }}>
                                <h3 style={{ fontSize: '1rem', color: '#111827', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Configured Events</h3>
                                {events.length === 0 ? (
                                    <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>No active triggers.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {events.map(ev => (
                                            <div key={ev.name} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{ev.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                                                        {ev.authorized_employees ? `Auth: ${ev.authorized_employees.length}` : 'No restrictions'}
                                                    </div>
                                                </div>
                                                <button onClick={() => deleteEvent(ev.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} title="Delete Event">
                                                    <Trash2 size={16} color="#ef4444" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View History Modal */}
            {showHistoryModal && (
                <div style={azureModalStyle}>
                    <div style={{ ...azureModalContentStyle, maxWidth: '1200px' }}>
                        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <History size={20} color="#f97316" /> Global Surveillance History
                            </h2>
                            <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#6b7280" /></button>
                        </div>
                        <div style={{ padding: '2rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '0.75rem' }}>Time</th>
                                        <th style={{ padding: '0.75rem' }}>Detected Entities</th>
                                        <th style={{ padding: '0.75rem' }}>Identities</th>
                                        <th style={{ padding: '0.75rem' }}>Context Summary</th>
                                        <th style={{ padding: '0.75rem' }}>Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '1rem', color: '#4b5563', whiteSpace: 'nowrap' }}>{new Date(row.timestamp).toLocaleString()}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                    {Object.entries(row.results || {}).map(([k, v]) => {
                                                        const isDetected = typeof v === 'number' ? v > 0 : !!v;
                                                        if (!isDetected) return null;
                                                        return <span key={k} style={{ padding: '0.1rem 0.5rem', background: '#fff7ed', border: '1px solid #fdba74', color: '#ea580c' }}>{k}</span>;
                                                    })}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', color: '#111827' }}>
                                                {(row.identified_persons || []).map((p, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Users size={12} color="#f97316"/> {p.name}
                                                    </div>
                                                ))}
                                            </td>
                                            <td style={{ padding: '1rem', color: '#6b7280' }}>{row.summary}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {row.s3_uri && <a href={row.s3_uri} target="_blank" style={{ color: '#f97316', textDecoration: 'none' }}>View Media</a>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Analysis Result Modal */}
            {manualResult && (
                <div style={azureModalStyle}>
                    <div style={{ ...azureModalContentStyle, maxWidth: '600px' }}>
                        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Activity size={20} color="#f97316" /> Analysis Result
                            </h2>
                            <button onClick={() => setManualResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#6b7280" /></button>
                        </div>
                        <div style={{ padding: '2rem' }}>
                            <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1.5rem' }}>{manualResult.summary}</p>
                            
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem' }}>Triggered Events:</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {Object.entries(manualResult.results || {}).map(([k, v]) => {
                                        const isDetected = typeof v === 'number' ? v > 0 : !!v;
                                        if (!isDetected) return null;
                                        return (
                                            <span key={k} style={{ padding: '0.2rem 0.6rem', background: '#fff7ed', border: '1px solid #fdba74', color: '#ea580c', fontSize: '0.8rem' }}>
                                                {k} ({typeof v === 'number' ? v : 'Yes'})
                                            </span>
                                        );
                                    })}
                                    {Object.values(manualResult.results || {}).every(v => v === 0 || v === false) && (
                                        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No events triggered.</span>
                                    )}
                                </div>
                            </div>

                            {manualResult.identified_persons && manualResult.identified_persons.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem' }}>Identified Persons:</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {manualResult.identified_persons.map((p, idx) => (
                                            <div key={idx} style={{ fontSize: '0.85rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Users size={14} color="#f97316" /> {p.name} {p.email ? `(${p.email})` : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {manualResult.alerts && manualResult.alerts.length > 0 && (
                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>Alerts:</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {manualResult.alerts.map((alert, idx) => (
                                            <div key={idx} style={{ fontSize: '0.8rem', color: '#b91c1c' }}>• {alert}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button onClick={() => setManualResult(null)} style={{ ...darkBtn, width: '100%', justifyContent: 'center' }}>Close Analysis</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
