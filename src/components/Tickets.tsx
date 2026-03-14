import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';


interface Ticket {
    id: number;
    product_name: string;
    user_facing_issue: string;
    is_resolved: boolean;
    is_vectorized: boolean;
    resolution: string | null;
    username: string | null;
}

interface Product {
    id: number;
    idea_name: string;
}

interface TicketsTabProps {
    showToast: (msg: string, ok?: boolean) => void;
    products: Product[];
}

export default function TicketsTab({ showToast, products }: TicketsTabProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [showResolutionModal, setShowResolutionModal] = useState<Ticket | null>(null);
    const [resolutionText, setResolutionText] = useState('');
    const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        product_name: '',
        user_facing_issue: '',
        username: ''
    });

    const loadTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/tickets/`);
            const data = await res.json();
            setTickets(data);
        } catch {
            showToast('Failed to load tickets', false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, []);

    const openAdd = () => {
        setEditingTicket(null);
        setForm({ product_name: products.length > 0 ? products[0].idea_name : '', user_facing_issue: '', username: '' });
        setShowModal(true);
    };

    const openEdit = (t: Ticket) => {
        setEditingTicket(t);
        setForm({
            product_name: t.product_name,
            user_facing_issue: t.user_facing_issue,
            username: t.username || ''
        });
        setShowModal(true);
    };

    const saveTicket = async () => {
        if (!form.product_name.trim() || !form.user_facing_issue.trim()) return;
        setSaving(true);
        try {
            const isEdit = !!editingTicket;
            const payload = {
                product_name: form.product_name,
                user_facing_issue: form.user_facing_issue,
                username: form.username || null,
                ...(isEdit && { is_resolved: editingTicket!.is_resolved }) // Keep resolved status during basic edit
            };
            
            const res = await fetch(
                isEdit ? `${API}/tickets/${editingTicket!.id}` : `${API}/tickets/`,
                {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );
            
            if (!res.ok) throw new Error('Failed');
            setShowModal(false);
            showToast(isEdit ? 'Ticket updated!' : 'Ticket created!');
            await loadTickets();
        } catch {
            showToast('Failed to save ticket', false);
        } finally {
            setSaving(false);
        }
    };

    const deleteTicket = async (t: Ticket) => {
        if (!confirm(`Delete ticket for "${t.product_name}"?`)) return;
        try {
            await fetch(`${API}/tickets/${t.id}`, { method: 'DELETE' });
            showToast('Ticket deleted');
            await loadTickets();
        } catch {
            showToast('Failed to delete ticket', false);
        }
    };

    const toggleResolved = async (t: Ticket, resolutionMsg?: string) => {
        // If we are currently open, and attempting to resolve, demand a resolution msg
        if (!t.is_resolved && !resolutionMsg) {
            setResolutionText(t.resolution || '');
            setShowResolutionModal(t);
            return;
        }

        try {
            const res = await fetch(`${API}/tickets/${t.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    is_resolved: !t.is_resolved,
                    ...(resolutionMsg ? { resolution: resolutionMsg } : {})
                 }),
            });
            if (!res.ok) throw new Error('Failed');
            showToast(`Ticket marked as ${!t.is_resolved ? 'resolved' : 'open'}`);
            setShowResolutionModal(null);
            await loadTickets();
        } catch {
            showToast('Failed to update status', false);
        }
    };

    const vectorizeTicket = async (t: Ticket) => {
        try {
            const res = await fetch(`${API}/tickets/${t.id}/vectorize`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed');
            showToast('Ticket vectorized and sent to AWS Knowledge Base!');
            await loadTickets();
        } catch {
            showToast('Failed to vectorize ticket', false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#323130', margin: 0 }}>Active Tickets</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={loadTickets} style={iconBtn} title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={openAdd} style={primaryBtn}>
                        <Plus size={16} /> Raise Ticket
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '64px', color: '#a19f9d' }}>
                    <Loader2 size={24} className="spin" /> &nbsp;Loading tickets...
                </div>
            ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', background: '#fff', borderRadius: '4px', border: '1px dashed #c8c6c4' }}>
                    <AlertCircle size={40} style={{ marginBottom: '16px', opacity: 0.4 }} />
                    <p style={{ fontWeight: 600, margin: 0, fontSize: '16px', color: '#323130' }}>No tickets found</p>
                    <p style={{ fontSize: '13px', margin: '4px 0 0', color: '#605e5c' }}>Raise a new ticket to track bugs or issues.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tickets.map(t => (
                        <div key={t.id} style={{
                            background: '#fff', border: '1px solid #edebe9', borderLeft: `4px solid ${t.is_resolved ? '#107c10' : '#d13438'}`,
                            borderRadius: '4px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#323130' }}>
                                        {t.product_name}
                                    </span>
                                    {t.is_resolved ? (
                                        <span style={{ background: '#dff6dd', color: '#107c10', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Resolved</span>
                                    ) : (
                                        <span style={{ background: '#fde7e9', color: '#d13438', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>Open</span>
                                    )}
                                    {t.username && (
                                        <span style={{ fontSize: '12px', color: '#605e5c', borderLeft: '1px solid #edebe9', paddingLeft: '8px' }}>
                                            Reported by: {t.username}
                                        </span>
                                    )}
                                    {t.is_vectorized && (
                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#005a9e', background: '#e5f3ff', padding: '2px 8px', borderRadius: '12px', borderLeft: '1px solid #edebe9', marginLeft: '8px' }}>
                                            ✓ Vectorized (S3)
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '13px', color: '#605e5c', whiteSpace: 'pre-wrap' }}>
                                    {t.user_facing_issue}
                                </div>
                                {t.is_resolved && t.resolution && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: '#f8f8f8', borderRadius: '4px', borderLeft: '3px solid #107c10' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#323130', marginBottom: '4px', textTransform: 'uppercase' }}>Resolution</div>
                                        <div style={{ fontSize: '13px', color: '#323130', whiteSpace: 'pre-wrap' }}>{t.resolution}</div>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {t.is_resolved && !t.is_vectorized && (
                                    <button
                                        onClick={() => vectorizeTicket(t)}
                                        style={{ ...outlineBtn, padding: '4px 8px', fontSize: '12px', color: '#005a9e', borderColor: '#005a9e', background: '#e5f3ff' }}
                                        title="Send to Knowledge Base"
                                    >
                                        Vectorize (S3)
                                    </button>
                                )}
                                <button
                                    onClick={() => toggleResolved(t)}
                                    style={{ ...outlineBtn, padding: '4px 8px', fontSize: '12px', color: t.is_resolved ? '#107c10' : '#d13438', borderColor: '#edebe9' }}
                                >
                                    {t.is_resolved ? <X size={14} /> : <Check size={14} />}
                                    {t.is_resolved ? 'Reopen' : 'Resolve'}
                                </button>
                                <button onClick={() => openEdit(t)} style={iconBtn} title="Edit Ticket"><Pencil size={16} /></button>
                                <button onClick={() => deleteTicket(t)} style={{ ...iconBtn, color: '#d13438' }} title="Delete Ticket"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
                    <div style={{ background: '#fff', borderRadius: '4px', padding: '24px', width: '480px', maxWidth: '90vw', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #edebe9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#323130' }}>
                                {editingTicket ? 'Edit Ticket' : 'Raise Ticket'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#605e5c' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Product Name *</label>
                                {products.length > 0 ? (
                                    <select
                                        value={form.product_name}
                                        onChange={e => setForm({ ...form, product_name: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="">Select a product...</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.idea_name}>{p.idea_name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        value={form.product_name}
                                        onChange={e => setForm({ ...form, product_name: e.target.value })}
                                        placeholder="Enter product name..."
                                        style={inputStyle}
                                    />
                                )}
                            </div>
                            <div>
                                <label style={labelStyle}>User Facing Issue *</label>
                                <textarea
                                    value={form.user_facing_issue}
                                    onChange={e => setForm({ ...form, user_facing_issue: e.target.value })}
                                    placeholder="Describe the bug or issue experienced by the user..."
                                    rows={4}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Username (Optional)</label>
                                <input
                                    value={form.username}
                                    onChange={e => setForm({ ...form, username: e.target.value })}
                                    placeholder="Who reported this issue?"
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end' }}>
                            <button onClick={saveTicket} disabled={saving} style={primaryBtn}>
                                {saving ? <Loader2 size={14} className="spin" /> : null} {editingTicket ? 'Update' : 'Raise Ticket'}
                            </button>
                            <button onClick={() => setShowModal(false)} style={outlineBtn}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolution Modal */}
            {showResolutionModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
                    <div style={{ background: '#fff', borderRadius: '4px', padding: '24px', width: '400px', maxWidth: '90vw', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #edebe9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#323130' }}>Resolve Ticket</h2>
                            <button onClick={() => setShowResolutionModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#605e5c' }}><X size={20} /></button>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>How was this resolved? *</label>
                            <textarea
                                value={resolutionText}
                                onChange={e => setResolutionText(e.target.value)}
                                placeholder="Describe the solution or action taken..."
                                rows={4}
                                style={{ ...inputStyle, resize: 'vertical' }}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => toggleResolved(showResolutionModal, resolutionText)} 
                                disabled={!resolutionText.trim() || saving} 
                                style={{ ...primaryBtn, background: '#107c10' }}
                            >
                                Mark as Resolved
                            </button>
                            <button onClick={() => setShowResolutionModal(null)} style={outlineBtn}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600, color: '#323130', marginBottom: '6px', fontFamily: '"Segoe UI", sans-serif'
};
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', border: '1px solid #8a8886', borderRadius: '2px', fontSize: '14px', color: '#323130', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: '"Segoe UI", sans-serif'
};
const primaryBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#0078d4', color: '#fff', border: '1px solid transparent', borderRadius: '2px', padding: '6px 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
};
const outlineBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#fff', color: '#323130', border: '1px solid #8a8886', borderRadius: '2px', padding: '4px 12px', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
};
const iconBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #edebe9', cursor: 'pointer', color: '#605e5c', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'
};
