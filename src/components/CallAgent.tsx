import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Bot } from 'lucide-react';

const HTTP_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/agent/ws/stream`;

interface Message { id: number; user_query: string; agent_response: string; created_at: string; }
interface Session { session_id: string; session_name: string | null; created_at: string; }

const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;

const WORKLET_CODE = `
class MicrophoneProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }
    process(inputs) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const channelData = input[0];
            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex++] = channelData[i];
                if (this.bufferIndex >= this.bufferSize) {
                    this.port.postMessage(this.buffer.slice(0));
                    this.bufferIndex = 0;
                }
            }
        }
        return true;
    }
}
registerProcessor('microphone-processor', MicrophoneProcessor);
`;

// ─── PCM helpers ──────────────────────────────────────────────────────────────
function downsampleToInt16(input: Float32Array, fromRate: number, toRate: number): Int16Array {
    if (fromRate === toRate) {
        const out = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
    }
    const ratio = fromRate / toRate;
    const outLen = Math.floor(input.length / ratio);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const pos = i * ratio;
        const lo = Math.floor(pos);
        const frac = pos - lo;
        const a = input[lo] ?? 0;
        const b = input[lo + 1] ?? a;
        const s = Math.max(-1, Math.min(1, a + frac * (b - a)));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CallAgent() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [interimMessage, setInterimMessage] = useState<{ role: string; content: string } | null>(null);

    // All mutable audio/ws state in refs — callbacks never close over stale values
    const wsRef = useRef<WebSocket | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isLiveRef = useRef(false);

    // ─── Audio player (Gold Standard: Sequential While-Loop Queue) ──────────
    const audioQueueRef = useRef<AudioBuffer[]>([]);
    const isProcessingQueueRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    useEffect(() => {
        fetchSessions();
        return () => { stopCall(); };
    }, []);

    // ─── Sessions ─────────────────────────────────────────────────────────────
    const fetchSessions = async () => {
        try {
            const r = await fetch(`${HTTP_BASE}/conversations/`);
            if (r.ok) setSessions(await r.json());
        } catch { }
    };

    const loadSession = async (sid: string) => {
        stopCall();
        setActiveSession(sid);
        try {
            const r = await fetch(`${HTTP_BASE}/conversations/${sid}`);
            if (r.ok) setMessages((await r.json()).messages ?? []);
        } catch { }
    };

    const startNewSession = () => {
        stopCall();
        setActiveSession(crypto.randomUUID());
        setMessages([]);
    };

    // ─── Mic graph (idempotent teardown + rebuild) ────────────────────────────
    const teardownMicGraph = () => {
        try { workletNodeRef.current?.disconnect(); } catch { }
        try { gainRef.current?.disconnect(); } catch { }
        try { sourceRef.current?.disconnect(); } catch { }
        workletNodeRef.current = null;
        gainRef.current = null;
        sourceRef.current = null;
    };

    const buildMicGraph = async (ctx: AudioContext, stream: MediaStream, ws: WebSocket) => {
        // Load the worklet via Blob URL (avoids external file loading issues)
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        try {
            await ctx.audioWorklet.addModule(url);
        } finally {
            URL.revokeObjectURL(url);
        }

        const source = ctx.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(ctx, 'microphone-processor');
        const mute = ctx.createGain();
        mute.gain.value = 0;

        workletNode.port.onmessage = (e) => {
            if (!isLiveRef.current || ws.readyState !== WebSocket.OPEN) return;
            const floatData = e.data as Float32Array;
            const pcm = downsampleToInt16(floatData, ctx.sampleRate, INPUT_SAMPLE_RATE);
            ws.send(pcm.buffer);
        };

        source.connect(workletNode);
        workletNode.connect(mute);
        mute.connect(ctx.destination);

        sourceRef.current = source;
        workletNodeRef.current = workletNode;
        gainRef.current = mute;
    };

    // ─── Playback: Sequential While-Loop (Gapless) ────────────────────────────
    const processQueue = async () => {
        if (isProcessingQueueRef.current) return;
        const ctx = ctxRef.current;
        if (!ctx) return;
        
        if (ctx.state === 'suspended') await ctx.resume();
        
        isProcessingQueueRef.current = true;
        while (audioQueueRef.current.length > 0) {
            const buffer = audioQueueRef.current.shift();
            if (!buffer) continue;

            await new Promise<void>((resolve) => {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                currentSourceRef.current = source;
                source.onended = () => {
                    currentSourceRef.current = null;
                    resolve();
                };
                source.start();
            });
        }
        isProcessingQueueRef.current = false;
    };

    const enqueueAudioChunk = (raw: ArrayBuffer) => {
        const ctx = ctxRef.current;
        if (!ctx) return;

        // Decode raw Int16 PCM → Float32 and create AudioBuffer
        const int16 = new Int16Array(raw);
        const f32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 0x8000;
        const buf = ctx.createBuffer(1, f32.length, OUTPUT_SAMPLE_RATE);
        buf.getChannelData(0).set(f32);

        audioQueueRef.current.push(buf);
        if (!isProcessingQueueRef.current) processQueue();
    };

    const handleInterrupt = useCallback(() => {
        audioQueueRef.current = [];
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch { }
            currentSourceRef.current = null;
        }
        isProcessingQueueRef.current = false;
        setInterimMessage(null);
    }, []);


    // ─── Call lifecycle ───────────────────────────────────────────────────────
    const startCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: { ideal: INPUT_SAMPLE_RATE } as any,
                },
            });
            streamRef.current = stream;

            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            ctxRef.current = ctx;

            const sid = crypto.randomUUID();
            setActiveSession(sid);
            setMessages([]);

            const socket = new WebSocket(`${WS_BASE}?session_id=${sid}`);
            socket.binaryType = 'arraybuffer';
            wsRef.current = socket;

            socket.onopen = async () => {
                await buildMicGraph(ctx, stream, socket);
                isLiveRef.current = true;
                setIsRecording(true);
            };

            socket.onmessage = (evt) => {
                if (evt.data instanceof ArrayBuffer) {
                    enqueueAudioChunk(evt.data);
                } else {
                    try {
                        const msg = JSON.parse(evt.data as string);
                        if (msg.type === 'interrupt') {
                            handleInterrupt();
                            setInterimMessage(null);
                        } else if (msg.type === 'text') {
                            setInterimMessage({ role: msg.role, content: msg.content });
                        }
                    } catch { }
                }
            };

            socket.onclose = () => { stopCall(); fetchSessions(); };
            socket.onerror = () => stopCall();

        } catch (err) {
            console.error('startCall failed:', err);
            stopCall();
        }
    };

    const stopCall = () => {
        isLiveRef.current = false;
        setIsRecording(false);
        // Clear queue and stop current source
        audioQueueRef.current = [];
        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch { }
            currentSourceRef.current = null;
        }
        isProcessingQueueRef.current = false;

        teardownMicGraph();
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close(1000);
            wsRef.current = null;
        }
        ctxRef.current?.close().catch(() => { });
        ctxRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    const toggleCall = () => isLiveRef.current ? stopCall() : startCall();

    // ─── UI ───────────────────────────────────────────────────────────────────
    const inHistory =
        activeSession &&
        sessions.find(s => s.session_id === activeSession) &&
        !isRecording &&
        messages.length > 0;

    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>

            {/* Sidebar */}
            <div style={{ width: '280px', background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a1a2e', fontWeight: 700 }}>History</h3>
                    <button onClick={startNewSession}
                        style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                        + New
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {sessions.length === 0
                        ? <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No past sessions.</p>
                        : <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {sessions.map(s => (
                                <li key={s.session_id}>
                                    <button onClick={() => loadSession(s.session_id)} style={{
                                        width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px',
                                        background: activeSession === s.session_id ? '#f1f5f9' : 'transparent',
                                        border: `1px solid ${activeSession === s.session_id ? '#e2e8f0' : 'transparent'}`,
                                        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem',
                                    }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a2e' }}>
                                            {s.session_name ?? `Session ${s.session_id.substring(0, 6)}`}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {new Date(s.created_at).toLocaleDateString()}{' '}
                                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    }
                </div>
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', position: 'relative' }}>
                {inHistory ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
                        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.5rem', color: '#1a1a2e', margin: 0 }}>
                                    {sessions.find(s => s.session_id === activeSession)?.session_name ?? `Session ${activeSession.substring(0, 8)}…`}
                                </h2>
                                <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>Stored chat transcript.</p>
                            </div>
                            {messages.map((msg, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <div style={{ background: '#1a1a2e', color: '#fff', padding: '1rem', borderRadius: '16px 16px 0 16px', maxWidth: '75%', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            {msg.user_query}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <div style={{ background: '#fff', color: '#1a1a2e', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '16px 16px 16px 0', maxWidth: '75%', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            {msg.agent_response}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '120px', height: '120px', background: '#fff', border: '2px solid #ea580c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4rem', boxShadow: '0 4px 12px rgba(234,88,12,0.15)' }}>
                            <Bot size={50} color="#ea580c" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a2e', marginBottom: '0.5rem' }}>Nova Sonnet Connect</h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '400px', textAlign: 'center', marginBottom: '2rem' }}>
                            {isRecording ? 'Listening… Start speaking naturally.' : 'Press the microphone below to launch a call.'}
                        </p>

                        {/* Real-time Transcript Display */}
                        {interimMessage && (
                            <div style={{
                                maxWidth: '600px',
                                background: '#fff',
                                padding: '1.5rem 2rem',
                                borderRadius: '20px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0',
                                animation: 'fadeIn 0.3s ease',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                    {interimMessage.role === 'ASSISTANT' ? 'AI Assistant' : 'You'}
                                </div>
                                <div style={{ fontSize: '1.1rem', color: '#1a1a2e', lineHeight: 1.6, fontWeight: 500 }}>
                                    {interimMessage.content}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem', display: 'flex', justifyContent: 'center', background: 'linear-gradient(to top, #f8fafc 80%, transparent)' }}>
                    <button onClick={toggleCall} style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: isRecording ? '#ef4444' : '#2563eb',
                        color: '#fff', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                        transition: 'all 0.3s ease',
                    }}>
                        {isRecording ? <Square size={28} fill="#fff" /> : <Mic size={28} color="#fff" />}
                    </button>
                </div>
            </div>
        </div>
    );
}