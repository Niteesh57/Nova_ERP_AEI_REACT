import { useEffect, useRef, useState } from 'react';
import { UserCircle2, Upload, Mail, User, Pencil, Trash2, Check, X, Loader2, Users } from 'lucide-react';
import Layout from '../components/Layout';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';


// ── Types ─────────────────────────────────────────────────────────────────────
interface Employee {
    id: number;
    name: string;
    email: string;
    photo_url: string | null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
    return (
        <div style={{
            position: 'fixed', top: '1.25rem', right: '1.5rem', zIndex: 999,
            background: ok ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
            color: ok ? '#166534' : '#991b1b',
            borderRadius: '10px', padding: '0.75rem 1.25rem',
            fontWeight: 500, fontSize: '0.875rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
            {ok ? <Check size={16} /> : <X size={16} />} {msg}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Settings() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const showToast = (msg: string, ok = true) => setToast({ msg, ok });

    // New employee form
    const [form, setForm] = useState({ name: '', email: '' });
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Editing
    const [editId, setEditId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: '', email: '' });
    const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
    const editFileRef = useRef<HTMLInputElement>(null);

    // ── Load ──────────────────────────────────────────────────────────────────
    const loadEmployees = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/employees/`);
            const data = await res.json();
            setEmployees(Array.isArray(data) ? data : []);
        } catch { showToast('Failed to load employees', false); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadEmployees(); }, []);

    // ── Photo preview handlers ────────────────────────────────────────────────
    const handlePhotoChange = (file: File | null, setFile: (f: File | null) => void, setPreview: (s: string | null) => void) => {
        setFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onload = e => setPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    // ── Create ────────────────────────────────────────────────────────────────
    const createEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim()) return;
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name.trim());
            fd.append('email', form.email.trim());
            if (photoFile) fd.append('photo', photoFile);

            const res = await fetch(`${API}/employees/`, { method: 'POST', body: fd });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Error');
            }
            setForm({ name: '', email: '' });
            setPhotoFile(null);
            setPhotoPreview(null);
            if (fileRef.current) fileRef.current.value = '';
            showToast('Employee created!');
            await loadEmployees();
        } catch (err: any) { showToast(err.message || 'Failed to create employee', false); }
        finally { setSaving(false); }
    };

    // ── Edit ──────────────────────────────────────────────────────────────────
    const startEdit = (emp: Employee) => {
        setEditId(emp.id);
        setEditForm({ name: emp.name, email: emp.email });
        setEditPhotoFile(null);
        setEditPhotoPreview(emp.photo_url);
    };

    const saveEdit = async () => {
        if (editId === null) return;
        setSaving(true);
        try {
            const fd = new FormData();
            if (editForm.name) fd.append('name', editForm.name);
            if (editForm.email) fd.append('email', editForm.email);
            if (editPhotoFile) fd.append('photo', editPhotoFile);

            const res = await fetch(`${API}/employees/${editId}`, { method: 'PUT', body: fd });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Error');
            }
            setEditId(null);
            setEditPhotoFile(null);
            setEditPhotoPreview(null);
            showToast('Employee updated!');
            await loadEmployees();
        } catch (err: any) { showToast(err.message || 'Failed to update', false); }
        finally { setSaving(false); }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const deleteEmployee = async (emp: Employee) => {
        if (!confirm(`Delete employee "${emp.name}"?`)) return;
        try {
            const res = await fetch(`${API}/employees/${emp.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            showToast('Employee deleted');
            await loadEmployees();
        } catch { showToast('Failed to delete', false); }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Layout>
            {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}

            {/* Page Header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 2rem' }}>
                <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111', margin: 0 }}>Settings</h1>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                    Manage your organization employees
                </p>
            </div>

            <div style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {/* ── Add Employee Form ─── */}
                <div style={sectionStyle}>
                    <div style={sectionHeader}>
                        <div>
                            <h2 style={sectionTitle}>Add Employee</h2>
                            <p style={sectionDesc}>Upload a photo and fill in employee details. Photo will be stored in S3.</p>
                        </div>
                    </div>

                    <form onSubmit={createEmployee}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2rem', alignItems: 'start' }}>
                            {/* Photo Upload */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                <div
                                    onClick={() => fileRef.current?.click()}
                                    style={{
                                        width: '100px', height: '100px', borderRadius: '50%',
                                        border: '2px dashed #d1d5db', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden', background: '#f9fafb',
                                        transition: 'border-color 0.2s',
                                    }}
                                >
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                            <Upload size={20} color="#9ca3af" />
                                            <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Upload</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={e => handlePhotoChange(e.target.files?.[0] || null, setPhotoFile, setPhotoPreview)}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Employee photo</span>
                            </div>

                            {/* Fields */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}><User size={13} style={{ display: 'inline', marginRight: '0.25rem' }} />Full Name *</label>
                                    <input
                                        value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="e.g. John Smith"
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}><Mail size={13} style={{ display: 'inline', marginRight: '0.25rem' }} />Email Address *</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="e.g. john.smith@company.com"
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <button type="submit" disabled={saving} style={{ ...primaryBtn, alignSelf: 'flex-start' }}>
                                    {saving ? <Loader2 size={15} /> : <Check size={15} />}
                                    Add Employee
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* ── Employee List ─── */}
                <div style={sectionStyle}>
                    <div style={sectionHeader}>
                        <div>
                            <h2 style={sectionTitle}><Users size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />Employee Directory</h2>
                            <p style={sectionDesc}>{employees.length} employee{employees.length !== 1 ? 's' : ''} on record</p>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}><Loader2 size={24} /></div>
                    ) : employees.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                            <UserCircle2 size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                            <p style={{ margin: 0, fontWeight: 500 }}>No employees yet</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <th style={thStyle}>Photo</th>
                                    <th style={thStyle}>Name</th>
                                    <th style={thStyle}>Email</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(emp => (
                                    editId === emp.id ? (
                                        /* Inline Edit Row */
                                        <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6', background: '#fffbeb' }}>
                                            <td style={tdStyle}>
                                                <div
                                                    onClick={() => editFileRef.current?.click()}
                                                    style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: '2px dashed #fcd34d' }}
                                                >
                                                    <img
                                                        src={editPhotoPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=f3f4f6&color=374151&size=88`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                    />
                                                </div>
                                                <input ref={editFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                                                    onChange={e => handlePhotoChange(e.target.files?.[0] || null, setEditPhotoFile, setEditPhotoPreview)} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={{ ...inputStyle, padding: '0.4rem 0.625rem' }} />
                                            </td>
                                            <td style={tdStyle}>
                                                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} style={{ ...inputStyle, padding: '0.4rem 0.625rem' }} />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button onClick={saveEdit} disabled={saving} style={primaryBtn}>{saving ? <Loader2 size={13} /> : <Check size={13} />} Save</button>
                                                    <button onClick={() => setEditId(null)} style={outlineBtn}><X size={13} /> Cancel</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        /* Normal Row */
                                        <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={tdStyle}>
                                                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                                                    <img
                                                        src={emp.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=f3f4f6&color=374151&size=88`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt={emp.name}
                                                        onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=f3f4f6&color=374151&size=88`; }}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: '#111' }}>{emp.name}</td>
                                            <td style={{ ...tdStyle, color: '#6b7280' }}>{emp.email}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => startEdit(emp)} style={iconBtn} title="Edit">
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button onClick={() => deleteEmployee(emp)} style={{ ...iconBtn, color: '#ef4444' }} title="Delete">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </Layout>
    );
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const sectionStyle: React.CSSProperties = {
    background: '#fff', borderRadius: '12px',
    border: '1px solid #e5e7eb', padding: '1.5rem',
};

const sectionHeader: React.CSSProperties = {
    marginBottom: '1.5rem',
};

const sectionTitle: React.CSSProperties = {
    fontSize: '1rem', fontWeight: 700, color: '#111', margin: '0 0 0.2rem',
    display: 'flex', alignItems: 'center',
};

const sectionDesc: React.CSSProperties = {
    fontSize: '0.825rem', color: '#6b7280', margin: 0,
};

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600,
    color: '#374151', marginBottom: '0.375rem',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.875rem',
    border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '0.875rem', color: '#111', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '0.55rem 1rem',
    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const outlineBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    background: '#fff', color: '#374151',
    border: '1px solid #d1d5db', borderRadius: '8px',
    padding: '0.55rem 1rem', fontWeight: 600, fontSize: '0.8rem',
    cursor: 'pointer', whiteSpace: 'nowrap',
};

const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#6b7280', padding: '0.3rem', borderRadius: '4px',
    display: 'flex', alignItems: 'center',
};

const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', textAlign: 'left',
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em',
};

const tdStyle: React.CSSProperties = {
    padding: '0.875rem 1rem', fontSize: '0.875rem',
};
