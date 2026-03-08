import Layout from '../components/Layout';
import CallAgent from '../components/CallAgent';

export default function CallAgentPage() {
    return (
        <Layout>
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f6f8' }}>
                <CallAgent />
            </div>
        </Layout>
    );
}
