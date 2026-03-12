import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Bot, AudioLines } from 'lucide-react';

const HTTP_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000/agent/ws/stream';

interface Message {
  id: number;
  user_query: string;
  agent_response: string;
  created_at: string;
}

interface Session {
  session_id: string;
  session_name: string | null;
  created_at: string;
}

export default function CallAgent() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(0);

  // Web Socket and Audio API Refs
  const ws = useRef<WebSocket | null>(null);
  
  const audioContext = useRef<AudioContext | null>(null);
  const audioInput = useRef<MediaStreamAudioSourceNode | null>(null);
  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);
  const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const scheduledTime = useRef<number>(0); // For audio queue playback scheduling

  // Audio Processing Constants
  const INPUT_SAMPLE_RATE = 16000;
  const OUTPUT_SAMPLE_RATE = 16000; // Expected from Bedrock

  useEffect(() => {
    fetchSessions();

    return () => {
      stopStreaming(); // cleanup on unmount
    };
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${HTTP_BASE}/conversations/`);
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  };

  const loadSession = async (sid: string) => {
    stopStreaming();
    setActiveSessionId(sid);
    
    try {
      const res = await fetch(`${HTTP_BASE}/conversations/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load session history:", err);
    }
  };

  const startNewSession = () => {
      stopStreaming();
      const newSession = crypto.randomUUID();
      setActiveSessionId(newSession);
      setMessages([]);
  };

  const toggleStreaming = async () => {
    if (isRecording) {
      stopStreaming();
    } else {
      await startStreaming();
    }
  };

  // ─── Websocket Audio Streaming ─────────────────────────────────────────

  const startStreaming = async () => {
    try {
      // 1. Get Microphone Permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      mediaStream.current = stream;

      // 2. Setup AudioContext
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContext.current = ctx;
      scheduledTime.current = ctx.currentTime;

      // 3. Create a new session_id for this call
      const callSessionId = crypto.randomUUID();
      setActiveSessionId(callSessionId);
      setMessages([]);

      // 4. Connect WebSocket — pass session_id as query param so backend logs to DB
      ws.current = new WebSocket(`${WS_BASE}?session_id=${callSessionId}`);
      ws.current.binaryType = "arraybuffer"; // We want binary data back

      ws.current.onopen = () => {
        console.log("WebSocket connected to Nova Bedrock");
        // Start processing mic data
        processMicrophoneData(stream, ctx);
        setIsRecording(true);
      };

      ws.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
           // We received binary audio from AWS Bedrock (24kHz 16-bit PCM)
           playIncomingAudio(event.data);
        } else {
           // We received control signals (Text, tools, barge-ins)
           try {
              const msg = JSON.parse(event.data);
              if (msg.type === "interrupt") {
                  console.log("Agent interrupted");
                  setIsAgentSpeaking(false);
                  
                  // Stop the currently playing audio buffer immediately
                  if (currentAudioSource.current) {
                      currentAudioSource.current.stop();
                      currentAudioSource.current = null;
                  }
                  
                  // Reset the scheduled time so the next response starts fresh
                  if (audioContext.current) {
                      scheduledTime.current = audioContext.current.currentTime;
                  }
                  
              } else if (msg.type === "text") {
                  console.log("Agent Text:", msg.content);
                  // We simulate history logging here, since DB inserts via HTTP aren't happening simultaneously right now
                  // Normally you'd want the WS backend to insert the text signals into SQLite
              }
           } catch(e) {}
        }
      };

      ws.current.onclose = () => {
         console.log("WebSocket connection closed.");
         stopStreaming();
         // Refresh the session list so the new session appears in the sidebar
         fetchSessions();
      };

      ws.current.onerror = (e) => {
          console.error("WebSocket error:", e);
      };

    } catch (e) {
      console.error("Failed to start streaming:", e);
      stopStreaming();
    }
  };

  const processMicrophoneData = (stream: MediaStream, ctx: AudioContext) => {
    audioInput.current = ctx.createMediaStreamSource(stream);
    
    // Create ScriptProcessor (deprecated but universally supported for WebKit downsampling)
    scriptProcessor.current = ctx.createScriptProcessor(2048, 1, 1);

    scriptProcessor.current.onaudioprocess = (e) => {
       if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

       // Get native Float32 output
       const float32Data = e.inputBuffer.getChannelData(0);
       
       // Measure "volume" to drive visualizer animations
       let sum = 0;
       for (let i = 0; i < float32Data.length; i++) { sum += Math.abs(float32Data[i]); }
       setVoiceVolume((sum / float32Data.length) * 500); // Scale up for visualizer

       // Downsample from browser's native rate to AWS 16000Hz PCM 16-bit
       const targetRate = INPUT_SAMPLE_RATE;
       const sourceRate = ctx.sampleRate;
       const ratio = sourceRate / targetRate;
       
       const newLength = Math.round(float32Data.length / ratio);
       const pcm16Data = new Int16Array(newLength);
       let offsetResult = 0;

       for (let i = 0; i < newLength; i++) {
            const nextOffsetBuffer = Math.round(i * ratio);
            let s = Math.max(-1, Math.min(1, float32Data[nextOffsetBuffer]));
            pcm16Data[offsetResult++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
       }

       // Send binary PCM bytes to backend
       ws.current.send(pcm16Data.buffer);
    };

    audioInput.current.connect(scriptProcessor.current);
    scriptProcessor.current.connect(ctx.destination);
  };

  const playIncomingAudio = (arrayBuffer: ArrayBuffer) => {
       if (!audioContext.current) return;
       setIsAgentSpeaking(true);
       
       // Convert AWS 16-bit PCM (24kHz) back to Float32 for Web Audio playback
       const int16Array = new Int16Array(arrayBuffer);
       const float32Array = new Float32Array(int16Array.length);
       for (let i=0; i<int16Array.length; i++){
          float32Array[i] = int16Array[i] / 0x8000;
       }

       const audioBuffer = audioContext.current.createBuffer(1, float32Array.length, OUTPUT_SAMPLE_RATE);
       audioBuffer.getChannelData(0).set(float32Array);

       const source = audioContext.current.createBufferSource();
       source.buffer = audioBuffer;
       source.connect(audioContext.current.destination);
       
       currentAudioSource.current = source; // store it so it can be interrupted

       // Schedule gapless playback
       if (scheduledTime.current < audioContext.current.currentTime) {
           scheduledTime.current = audioContext.current.currentTime + 0.1; // 100ms jitter buffer
       }
       source.start(scheduledTime.current);
       scheduledTime.current += audioBuffer.duration;

       source.onended = () => {
           // Wait slightly after the last buffer finishes to reset visuals
           if (audioContext.current && audioContext.current.currentTime >= scheduledTime.current) {
               setIsAgentSpeaking(false);
           }
       };
  };

  const stopStreaming = () => {
    setIsRecording(false);
    setIsAgentSpeaking(false);
    setVoiceVolume(0);

    if (ws.current) {
        if (ws.current.readyState === WebSocket.OPEN) ws.current.close();
        ws.current = null;
    }

    if (scriptProcessor.current) {
        scriptProcessor.current.disconnect();
        scriptProcessor.current = null;
    }

    if (audioInput.current) {
        audioInput.current.disconnect();
        audioInput.current = null;
    }

    if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
    }
  };

  // ─── UI Rendering ──────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* ── Left Sidebar: History List ── */}
      <div style={{ width: '280px', background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1a1a2e', fontWeight: 700 }}>History</h3>
            <button 
               onClick={startNewSession}
               style={{ background: '#f1f5f9', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}
            >
                + New
            </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {sessions.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No past sessions.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {sessions.map(s => (
                        <li key={s.session_id}>
                            <button
                                onClick={() => loadSession(s.session_id)}
                                style={{
                                    width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', 
                                    background: activeSessionId === s.session_id ? '#f1f5f9' : 'transparent',
                                    border: `1px solid ${activeSessionId === s.session_id ? '#e2e8f0' : 'transparent'}`,
                                    cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.2rem'
                                }}
                            >
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a2e' }}>
                                    {s.session_name ?? `Session ${s.session_id.substring(0,6)}`}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>


      {/* ── Main Area: Active Session Voice UI or Chat History ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', position: 'relative' }}>
        
        {/* State Toggle: Voice Animation vs History Viewer */}
        {activeSessionId && sessions.find(s => s.session_id === activeSessionId) && !isRecording && !isAgentSpeaking && messages.length > 0 ? (
            
            // ── HISTORY VIEWER MODE ──
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.5rem', color: '#1a1a2e', margin: 0 }}>
                            {sessions.find(s => s.session_id === activeSessionId)?.session_name ?? `Session ${activeSessionId.substring(0,8)}...`}
                        </h2>
                        <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>Stored chat transcript.</p>
                    </div>

                    {messages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* User */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ background: '#1a1a2e', color: '#fff', padding: '1rem', borderRadius: '16px 16px 0 16px', maxWidth: '75%', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                    {msg.user_query}
                                </div>
                            </div>
                            {/* Agent */}
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
            
            // ── ACTIVE VOICE MODE (Native Amazon Nova Bedrock Voice UI) ──
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                
                {/* Agent Visualizer */}
                <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4rem' }}>
                    {/* Ring Animations */}
                    {isAgentSpeaking && (
                        <>
                            <div className="pulse-ring" style={{ animationDelay: '0s' }}></div>
                            <div className="pulse-ring" style={{ animationDelay: '0.5s' }}></div>
                        </>
                    )}
                    {isRecording && !isAgentSpeaking && (
                        <div className="pulse-ring list-ring" style={{ width: `${100 + voiceVolume}%`, height: `${100 + voiceVolume}%`, opacity: 0.2 }}></div>
                    )}
                    
                    <div style={{ width: '120px', height: '120px', background: '#fff', border: '2px solid #ea580c', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 4px 12px rgba(234,88,12,0.15)' }}>
                        {isAgentSpeaking ? <AudioLines size={50} color="#ea580c" /> : <Bot size={50} color="#ea580c" />}
                    </div>
                </div>

                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a2e', marginBottom: '0.5rem' }}>
                    {isAgentSpeaking ? "Nova Sonnet is speaking..." : isRecording ? "AWS Bedrock Listening..." : "Nova Sonnet Connect"}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '400px', textAlign: 'center' }}>
                    {isAgentSpeaking ? "You can interrupt at any time by speaking." : isRecording ? "Start speaking naturally." : "Press the microphone below to launch a bidirectional AWS bedstream call."}
                </p>

            </div>
        )}

        {/* ── Fixed Bottom Bar: Call Control ── */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem', display: 'flex', justifyContent: 'center', background: 'linear-gradient(to top, #f8fafc 80%, transparent)' }}>
            <button
                onClick={toggleStreaming}
                style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: isRecording ? '#ef4444' : '#2563eb',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                    transition: 'all 0.3s ease'
                }}
            >
                {isRecording ? <Square size={28} fill="#fff" /> : <Mic size={28} color="#fff" />}
            </button>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .pulse-ring {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: rgba(59, 130, 246, 0.4);
            animation: pulse-wave 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 1;
        }
        .list-ring {
            background: rgba(26, 26, 46, 0.2);
            animation: none;
            transition: width 0.15s ease, height 0.15s ease;
        }
        @keyframes pulse-wave {
            0% { transform: scale(0.6); opacity: 0.8; }
            100% { transform: scale(1.8); opacity: 0; }
        }
      `}} />
    </div>
  );
}
