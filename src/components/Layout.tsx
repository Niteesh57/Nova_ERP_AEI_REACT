import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
            <Sidebar />
            <main style={{
                marginLeft: '220px',
                flex: 1,
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {children}
            </main>
        </div>
    );
}
