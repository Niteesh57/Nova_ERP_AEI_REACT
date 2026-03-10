import { useEffect, useState } from 'react';
import {
    Plus, Pencil, Trash2, ChevronDown, ChevronRight,
    BookOpen, Tag, X, Check, Loader2
} from 'lucide-react';
import Layout from '../components/Layout';
import TicketsTab from '../components/Tickets';

const API = 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Product {
    id: number;
    idea_name: string;
    description: string;
}

interface Story {
    id: number;
    product_id: number;
    title: string;
    description: string | null;
    tag: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function TagBadge({ tag }: { tag: string }) {
    return (
        <span style={{
            display: 'inline-block',
            background: '#e6f2ff', color: '#005a9e',
            padding: '2px 6px', borderRadius: '4px',
            fontSize: '12px', fontWeight: 600,
            border: '1px solid #cce3f5',
        }}>
            {tag}
        </span>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [stories, setStories] = useState<Record<number, Story[]>>({});
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'products' | 'tickets'>('products');

    // Modals / forms
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [productForm, setProductForm] = useState({ idea_name: '', description: '' });
    const [productSaving, setProductSaving] = useState(false);

    const [storyForm, setStoryForm] = useState<Record<number, { title: string; description: string; tag: string }>>({});
    const [showStoryForm, setShowStoryForm] = useState<Record<number, boolean>>({});
    const [editingStory, setEditingStory] = useState<Story | null>(null);
    const [storySaving, setStorySaving] = useState(false);

    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const showToast = (msg: string, ok = true) => setToast({ msg, ok });

    // ── Data loading ──────────────────────────────────────────────────────────
    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/products/`);
            const data: Product[] = await res.json();
            setProducts(data);
        } catch { showToast('Failed to load products', false); }
        finally { setLoading(false); }
    };

    const loadStories = async (productId: number) => {
        try {
            const res = await fetch(`${API}/products/${productId}/stories/`);
            const data: Story[] = await res.json();
            setStories(prev => ({ ...prev, [productId]: data }));
        } catch { showToast('Failed to load stories', false); }
    };

    useEffect(() => { loadProducts(); }, []);

    // ── Toggle expand ─────────────────────────────────────────────────────────
    const toggleExpand = (pid: number) => {
        const next = new Set(expandedIds);
        if (next.has(pid)) {
            next.delete(pid);
        } else {
            next.add(pid);
            if (!stories[pid]) loadStories(pid);
        }
        setExpandedIds(next);
    };

    // ── Product CRUD ──────────────────────────────────────────────────────────
    const openAddProduct = () => {
        setEditingProduct(null);
        setProductForm({ idea_name: '', description: '' });
        setShowProductModal(true);
    };

    const openEditProduct = (p: Product) => {
        setEditingProduct(p);
        setProductForm({ idea_name: p.idea_name, description: p.description });
        setShowProductModal(true);
    };

    const saveProduct = async () => {
        if (!productForm.idea_name.trim() || !productForm.description.trim()) return;
        setProductSaving(true);
        try {
            const isEdit = !!editingProduct;
            const res = await fetch(
                isEdit ? `${API}/products/${editingProduct!.id}` : `${API}/products/`,
                {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productForm),
                }
            );
            if (!res.ok) throw new Error('Failed');
            setShowProductModal(false);
            showToast(isEdit ? 'Product updated!' : 'Product created!');
            await loadProducts();
        } catch { showToast('Failed to save product', false); }
        finally { setProductSaving(false); }
    };

    const deleteProduct = async (p: Product) => {
        if (!confirm(`Delete product "${p.idea_name}"? All its user stories will also be deleted.`)) return;
        try {
            await fetch(`${API}/products/${p.id}`, { method: 'DELETE' });
            showToast('Product deleted');
            await loadProducts();
            setExpandedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
            setStories(prev => { const n = { ...prev }; delete n[p.id]; return n; });
        } catch { showToast('Failed to delete product', false); }
    };

    // ── Story CRUD ────────────────────────────────────────────────────────────
    const toggleStoryForm = (pid: number, show: boolean) => {
        setShowStoryForm(prev => ({ ...prev, [pid]: show }));
        if (show && !storyForm[pid]) {
            setStoryForm(prev => ({ ...prev, [pid]: { title: '', description: '', tag: '' } }));
        }
    };

    const saveStory = async (productId: number) => {
        const form = storyForm[productId];
        if (!form?.title.trim()) return;
        setStorySaving(true);
        try {
            const res = await fetch(`${API}/products/${productId}/stories/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title,
                    description: form.description || null,
                    tag: form.tag || null,
                }),
            });
            if (!res.ok) throw new Error('Failed');
            setStoryForm(prev => ({ ...prev, [productId]: { title: '', description: '', tag: '' } }));
            setShowStoryForm(prev => ({ ...prev, [productId]: false }));
            await loadStories(productId);
            showToast('Story added!');
        } catch { showToast('Failed to add story', false); }
        finally { setStorySaving(false); }
    };

    const openEditStory = (story: Story) => {
        setEditingStory({ ...story });
    };

    const saveEditStory = async () => {
        if (!editingStory || !editingStory.title.trim()) return;
        setStorySaving(true);
        try {
            const res = await fetch(`${API}/stories/${editingStory.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editingStory.title,
                    description: editingStory.description || null,
                    tag: editingStory.tag || null,
                }),
            });
            if (!res.ok) throw new Error('Failed');
            setEditingStory(null);
            await loadStories(editingStory.product_id);
            showToast('Story updated!');
        } catch { showToast('Failed to update story', false); }
        finally { setStorySaving(false); }
    };

    const deleteStory = async (story: Story) => {
        if (!confirm(`Delete story "${story.title}"?`)) return;
        try {
            await fetch(`${API}/stories/${story.id}`, { method: 'DELETE' });
            showToast('Story deleted');
            await loadStories(story.product_id);
        } catch { showToast('Failed to delete story', false); }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Layout>
            {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}

            {/* Page Header */}
            <div style={{ background: '#fff', padding: '16px 24px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#323130', margin: 0, fontFamily: 'Segoe UI, sans-serif' }}>
                            Dashboard
                        </h1>
                        <p style={{ color: '#605e5c', fontSize: '13px', margin: '4px 0 0' }}>
                            Manage product features, user stories, and support tickets
                        </p>
                    </div>
                    {activeTab === 'products' && (
                        <button
                            onClick={openAddProduct}
                            style={primaryBtn}
                        >
                            <Plus size={16} /> New Epic
                        </button>
                    )}
                </div>
                
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '24px' }}>
                    <button
                        onClick={() => setActiveTab('products')}
                        style={{
                            background: 'none', border: 'none', padding: '12px 4px', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 600, color: activeTab === 'products' ? '#0078d4' : '#605e5c',
                            borderBottom: activeTab === 'products' ? '2px solid #0078d4' : '2px solid transparent',
                        }}
                    >
                        Product Backlog
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        style={{
                            background: 'none', border: 'none', padding: '12px 4px', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 600, color: activeTab === 'tickets' ? '#0078d4' : '#605e5c',
                            borderBottom: activeTab === 'tickets' ? '2px solid #0078d4' : '2px solid transparent',
                        }}
                    >
                        Tickets
                    </button>
                </div>
            </div>
            <div style={{ borderTop: '1px solid #edebe9' }} />

            {/* Content */}
            <div style={{ padding: '24px', flex: 1, background: '#faf9f8' }}>
                {activeTab === 'products' ? (
                    <>
                        {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px', color: '#a19f9d' }}>
                        <Loader2 size={24} className="spin" /> &nbsp;Loading...
                    </div>
                ) : products.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '80px 32px',
                        color: '#605e5c', background: '#fff',
                        borderRadius: '4px', border: '1px dashed #c8c6c4',
                    }}>
                        <BookOpen size={40} style={{ marginBottom: '16px', opacity: 0.4 }} />
                        <p style={{ fontWeight: 600, margin: 0, fontSize: '16px', color: '#323130' }}>No epics yet.</p>
                        <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Create your first epic to get started.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                expanded={expandedIds.has(product.id)}
                                stories={stories[product.id] || []}
                                showAddStory={showStoryForm[product.id] || false}
                                storyFormData={storyForm[product.id] || { title: '', description: '', tag: '' }}
                                editingStory={editingStory}
                                storySaving={storySaving}
                                onToggle={() => toggleExpand(product.id)}
                                onEdit={() => openEditProduct(product)}
                                onDelete={() => deleteProduct(product)}
                                onToggleStoryForm={(show) => toggleStoryForm(product.id, show)}
                                onStoryFormChange={(field, val) => setStoryForm(prev => ({ ...prev, [product.id]: { ...prev[product.id], [field]: val } }))}
                                onSaveStory={() => saveStory(product.id)}
                                onEditStory={openEditStory}
                                onDeleteStory={deleteStory}
                                onEditStoryChange={(field, val) => setEditingStory(prev => prev ? { ...prev, [field]: val } : prev)}
                                onSaveEditStory={saveEditStory}
                                onCancelEditStory={() => setEditingStory(null)}
                            />
                        ))}
                    </div>
                )}
                    </>
                ) : (
                    <TicketsTab showToast={showToast} products={products} />
                )}
            </div>

            {/* Product Modal */}
            {showProductModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(2px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '4px', padding: '24px',
                        width: '480px', maxWidth: '90vw', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #edebe9'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#323130', fontFamily: 'Segoe UI, sans-serif' }}>
                                {editingProduct ? 'Edit Epic' : 'New Epic'}
                            </h2>
                            <button onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#605e5c' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Epic Title *</label>
                                <input
                                    value={productForm.idea_name}
                                    onChange={e => setProductForm(p => ({ ...p, idea_name: e.target.value }))}
                                    placeholder="e.g. AI-powered Dashboard"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Description *</label>
                                <textarea
                                    value={productForm.description}
                                    onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Describe the epic..."
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end' }}>
                            <button onClick={saveProduct} disabled={productSaving} style={primaryBtn}>
                                {productSaving ? <Loader2 size={14} className="spin" /> : null}
                                {editingProduct ? 'Update' : 'Create'}
                            </button>
                            <button onClick={() => setShowProductModal(false)} style={outlineBtn}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

// ── ProductCard ───────────────────────────────────────────────────────────────
interface ProductCardProps {
    product: Product;
    expanded: boolean;
    stories: Story[];
    showAddStory: boolean;
    storyFormData: { title: string; description: string; tag: string };
    editingStory: Story | null;
    storySaving: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStoryForm: (show: boolean) => void;
    onStoryFormChange: (field: string, val: string) => void;
    onSaveStory: () => void;
    onEditStory: (s: Story) => void;
    onDeleteStory: (s: Story) => void;
    onEditStoryChange: (field: string, val: string) => void;
    onSaveEditStory: () => void;
    onCancelEditStory: () => void;
}

function ProductCard({
    product, expanded, stories, showAddStory, storyFormData, editingStory,
    storySaving, onToggle, onEdit, onDelete, onToggleStoryForm,
    onStoryFormChange, onSaveStory, onEditStory, onDeleteStory,
    onEditStoryChange, onSaveEditStory, onCancelEditStory,
}: ProductCardProps) {
    return (
        <div style={{ background: '#fff', border: '1px solid #edebe9', borderRadius: '4px', marginBottom: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            {/* Product Header */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <button
                    onClick={onToggle}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#605e5c', padding: '2px', flexShrink: 0, marginTop: '2px' }}
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ff7a00', color: '#fff', width: '20px', height: '20px', borderRadius: '2px', flexShrink: 0 }}>
                            <BookOpen size={12} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#323130' }}>
                            {product.idea_name}
                        </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#605e5c', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.description}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button onClick={onEdit} style={iconBtn} title="Edit product">
                        <Pencil size={14} />
                    </button>
                    <button onClick={onDelete} style={{ ...iconBtn, color: '#d13438' }} title="Delete product">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Expanded: User Stories */}
            {expanded && (
                <div style={{ borderTop: '1px solid #edebe9', borderBottom: '1px solid transparent', background: '#faf9f8', padding: '16px 20px 24px 44px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#605e5c', textTransform: 'uppercase' }}>
                            User Stories ({stories.length})
                        </span>
                        <button
                            onClick={() => onToggleStoryForm(!showAddStory)}
                            style={{ ...outlineBtn, padding: '4px 8px', fontSize: '12px', color: '#0078d4', borderColor: '#edebe9', background: '#fff' }}
                        >
                            {showAddStory ? <X size={14} /> : <Plus size={14} />}
                            {showAddStory ? 'Cancel' : 'New Story'}
                        </button>
                    </div>

                    {/* Add Story Form */}
                    {showAddStory && (
                        <div style={{ background: '#fff', border: '1px solid #0078d4', borderRadius: '4px', padding: '16px', marginBottom: '16px', boxShadow: '0 0 4px rgba(0, 120, 212, 0.2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input
                                    value={storyFormData.title}
                                    onChange={e => onStoryFormChange('title', e.target.value)}
                                    placeholder="Enter title"
                                    style={{ ...inputStyle, fontWeight: 600, fontSize: '14px', border: 'none', borderBottom: '1px solid #edebe9', borderRadius: 0, padding: '4px 0' }}
                                />
                                <textarea
                                    value={storyFormData.description}
                                    onChange={e => onStoryFormChange('description', e.target.value)}
                                    placeholder="Add description..."
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'vertical', border: '1px solid #edebe9' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '250px' }}>
                                        <Tag size={14} color="#605e5c" />
                                        <input
                                            value={storyFormData.tag}
                                            onChange={e => onStoryFormChange('tag', e.target.value)}
                                            placeholder="Add tag"
                                            style={{ ...inputStyle, flex: 1, margin: 0, padding: '4px 8px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={onSaveStory} disabled={storySaving} style={primaryBtn}>
                                            {storySaving ? <Loader2 size={14} className="spin" /> : null} Save
                                        </button>
                                        <button onClick={() => onToggleStoryForm(false)} style={outlineBtn}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stories List */}
                    {stories.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#a19f9d', fontSize: '13px', background: '#fff', border: '1px dashed #c8c6c4', borderRadius: '4px' }}>
                            No user stories defined. Create one to start tracking work.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {stories.map(story => (
                                <StoryRow
                                    key={story.id}
                                    story={story}
                                    editing={editingStory?.id === story.id}
                                    editingStory={editingStory}
                                    storySaving={storySaving}
                                    onEdit={() => onEditStory(story)}
                                    onDelete={() => onDeleteStory(story)}
                                    onEditChange={onEditStoryChange}
                                    onSaveEdit={onSaveEditStory}
                                    onCancelEdit={onCancelEditStory}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── StoryRow ──────────────────────────────────────────────────────────────────
interface StoryRowProps {
    story: Story;
    editing: boolean;
    editingStory: Story | null;
    storySaving: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onEditChange: (field: string, val: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
}

function StoryRow({ story, editing, editingStory, storySaving, onEdit, onDelete, onEditChange, onSaveEdit, onCancelEdit }: StoryRowProps) {
    if (editing && editingStory) {
        return (
            <div style={{ background: '#fff', border: '1px solid #0078d4', borderRadius: '4px', padding: '16px', boxShadow: '0 0 4px rgba(0, 120, 212, 0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input
                        value={editingStory.title}
                        onChange={e => onEditChange('title', e.target.value)}
                        placeholder="Enter title"
                        style={{ ...inputStyle, fontWeight: 600, fontSize: '14px', border: 'none', borderBottom: '1px solid #edebe9', borderRadius: 0, padding: '4px 0' }}
                    />
                    <textarea
                        value={editingStory.description || ''}
                        onChange={e => onEditChange('description', e.target.value)}
                        placeholder="Add description..."
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', border: '1px solid #edebe9' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '250px' }}>
                            <Tag size={14} color="#605e5c" />
                            <input
                                value={editingStory.tag || ''}
                                onChange={e => onEditChange('tag', e.target.value)}
                                placeholder="Add tag"
                                style={{ ...inputStyle, flex: 1, margin: 0, padding: '4px 8px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={onSaveEdit} disabled={storySaving} style={primaryBtn}>
                                {storySaving ? <Loader2 size={14} className="spin" /> : null} Update
                            </button>
                            <button onClick={onCancelEdit} style={outlineBtn}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#fff', border: '1px solid #edebe9', borderLeft: '3px solid #0078d4', borderRadius: '4px',
            padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0078d4', color: '#fff', width: '20px', height: '20px', borderRadius: '2px', flexShrink: 0, marginTop: '2px' }}>
                <BookOpen size={12} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#201f1e', marginBottom: '2px' }}>
                    {story.title}
                </div>
                {story.description && (
                    <div style={{ fontSize: '13px', color: '#605e5c', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>
                        {story.description}
                    </div>
                )}
                {story.tag && <TagBadge tag={story.tag} />}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button onClick={onEdit} style={iconBtn} title="Edit User Story">
                    <Pencil size={14} />
                </button>
                <button onClick={onDelete} style={{ ...iconBtn, color: '#d13438' }} title="Delete User Story">
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#323130', marginBottom: '6px', fontFamily: '"Segoe UI", sans-serif'
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px',
    border: '1px solid #8a8886', borderRadius: '2px',
    fontSize: '14px', color: '#323130', background: '#fff',
    outline: 'none', boxSizing: 'border-box', fontFamily: '"Segoe UI", sans-serif',
    transition: 'border-color 0.1s'
};

const primaryBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    background: '#0078d4', color: '#fff', border: '1px solid transparent',
    borderRadius: '2px', padding: '6px 16px',
    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
    whiteSpace: 'nowrap', fontFamily: '"Segoe UI", sans-serif'
};

const outlineBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    background: '#fff', color: '#323130',
    border: '1px solid #8a8886', borderRadius: '2px',
    padding: '6px 16px', fontWeight: 600, fontSize: '14px',
    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: '"Segoe UI", sans-serif'
};

const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#605e5c', padding: '6px', borderRadius: '2px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
};
