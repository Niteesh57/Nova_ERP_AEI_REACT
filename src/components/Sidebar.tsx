import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, Settings, Activity, Target } from 'lucide-react';

const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/console', icon: <Video size={18} />, label: 'Surveillance' },
    { to: '/agent', icon: <Activity size={18} />, label: 'Call Agent' },
    { to: '/leads', icon: <Target size={18} />, label: 'Leads' },
    { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
];

export default function Sidebar() {
    return (
        <aside style={{
            width: '220px',
            minHeight: '100vh',
            background: '#fff',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 200,
        }}>
            {/* Brand */}
            <div style={{
                padding: '1.5rem 1.25rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
            }}>
                <div style={{
                    background: '#111',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Activity size={16} color="#fff" strokeWidth={2.5} />
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111', lineHeight: 1.2 }}>NOVA ERP</div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', letterSpacing: '0.05em' }}>Intelligence Suite</div>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', padding: '0.25rem 0.5rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                    Main Menu
                </div>
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            padding: '0.625rem 0.75rem',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontWeight: isActive ? 600 : 500,
                            fontSize: '0.875rem',
                            color: isActive ? '#111' : '#6b7280',
                            background: isActive ? '#f3f4f6' : 'transparent',
                            transition: 'all 0.15s ease',
                        })}
                    >
                        {item.icon}
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#9ca3af' }}>
                © 2026 Nova AEI
            </div>
        </aside>
    );
}
