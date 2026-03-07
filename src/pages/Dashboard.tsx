import { useEffect, useState } from 'react';
import {
    Plus, Pencil, Trash2, ChevronDown, ChevronRight,
    BookOpen, Tag, X, Check, Loader2
} from 'lucide-react';
import Layout from '../components/Layout';

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
            background: '#f3f4f6', color: '#374151',
            padding: '0.15rem 0.6rem', borderRadius: '100px',
            fontSize: '0.72rem', fontWeight: 600,
            border: '1px solid #e5e7eb',
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
            <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111', margin: 0 }}>
                            Product Dashboard
                        </h1>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                            Manage product ideas and their user stories
                        </p>
                    </div>
                    <button
                        onClick={openAddProduct}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: '#111', color: '#fff', border: 'none',
                            borderRadius: '8px', padding: '0.625rem 1.125rem',
                            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                        }}
                    >
                        <Plus size={16} /> New Product
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem', flex: 1 }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: '#9ca3af' }}>
                        <Loader2 size={24} className="spin" /> &nbsp;Loading...
                    </div>
                ) : products.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '5rem 2rem',
                        color: '#9ca3af', background: '#fff',
                        borderRadius: '12px', border: '1px dashed #d1d5db',
                    }}>
                        <BookOpen size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                        <p style={{ fontWeight: 500, margin: 0 }}>No products yet.</p>
                        <p style={{ fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Create your first product idea to get started.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            </div>

            {/* Product Modal */}
            {showProductModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
                }}>
                    <div style={{
                        background: '#fff', borderRadius: '16px', padding: '2rem',
                        width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111' }}>
                                {editingProduct ? 'Edit Product' : 'New Product Idea'}
                            </h2>
                            <button onClick={() => setShowProductModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Product Idea Name *</label>
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
                                    placeholder="Describe the product idea..."
                                    rows={3}
                                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button onClick={() => setShowProductModal(false)} style={outlineBtn}>Cancel</button>
                            <button onClick={saveProduct} disabled={productSaving} style={primaryBtn}>
                                {productSaving ? <Loader2 size={14} /> : <Check size={14} />}
                                {editingProduct ? 'Update' : 'Create'}
                            </button>
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
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {/* Product Header */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={onToggle}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', flexShrink: 0 }}
                >
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111', marginBottom: '0.25rem' }}>
                        {product.idea_name}
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {product.description}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={onEdit} style={iconBtn} title="Edit product">
                        <Pencil size={15} />
                    </button>
                    <button onClick={onDelete} style={{ ...iconBtn, color: '#ef4444' }} title="Delete product">
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Expanded: User Stories */}
            {expanded && (
                <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '1rem 1.5rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            User Stories ({stories.length})
                        </span>
                        <button
                            onClick={() => onToggleStoryForm(!showAddStory)}
                            style={{ ...iconBtn, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                        >
                            {showAddStory ? <X size={13} /> : <Plus size={13} />}
                            {showAddStory ? 'Cancel' : 'Add Story'}
                        </button>
                    </div>

                    {/* Add Story Form */}
                    {showAddStory && (
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                <input
                                    value={storyFormData.title}
                                    onChange={e => onStoryFormChange('title', e.target.value)}
                                    placeholder="Story title *"
                                    style={inputStyle}
                                />
                                <textarea
                                    value={storyFormData.description}
                                    onChange={e => onStoryFormChange('description', e.target.value)}
                                    placeholder="Description (optional)..."
                                    rows={2}
                                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
                                        <Tag size={14} color="#9ca3af" />
                                        <input
                                            value={storyFormData.tag}
                                            onChange={e => onStoryFormChange('tag', e.target.value)}
                                            placeholder="Tag (e.g. React, Backend...)"
                                            style={{ ...inputStyle, flex: 1, margin: 0 }}
                                        />
                                    </div>
                                    <button onClick={onSaveStory} disabled={storySaving} style={primaryBtn}>
                                        {storySaving ? <Loader2 size={13} /> : <Check size={13} />} Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stories List */}
                    {stories.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                            No user stories yet. Click "+ Add Story" to get started.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.875rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input
                        value={editingStory.title}
                        onChange={e => onEditChange('title', e.target.value)}
                        placeholder="Story title"
                        style={inputStyle}
                    />
                    <textarea
                        value={editingStory.description || ''}
                        onChange={e => onEditChange('description', e.target.value)}
                        placeholder="Description..."
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
                            <Tag size={14} color="#9ca3af" />
                            <input
                                value={editingStory.tag || ''}
                                onChange={e => onEditChange('tag', e.target.value)}
                                placeholder="Tag..."
                                style={{ ...inputStyle, flex: 1, margin: 0 }}
                            />
                        </div>
                        <button onClick={onSaveEdit} disabled={storySaving} style={primaryBtn}>
                            {storySaving ? <Loader2 size={13} /> : <Check size={13} />} Update
                        </button>
                        <button onClick={onCancelEdit} style={outlineBtn}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
            padding: '0.875rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111', marginBottom: '0.2rem' }}>
                    {story.title}
                </div>
                {story.description && (
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem' }}>
                        {story.description}
                    </div>
                )}
                {story.tag && <TagBadge tag={story.tag} />}
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                <button onClick={onEdit} style={iconBtn} title="Edit story">
                    <Pencil size={14} />
                </button>
                <button onClick={onDelete} style={{ ...iconBtn, color: '#ef4444' }} title="Delete story">
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
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
    background: '#111', color: '#fff', border: 'none',
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
    color: '#6b7280', padding: '0.25rem', borderRadius: '4px',
    display: 'flex', alignItems: 'center',
};
