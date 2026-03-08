import Layout from '../components/Layout';
import LeadAgent from '../components/LeadAgent';

export default function LeadsPage() {
  return (
    <Layout>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <LeadAgent />
      </div>
    </Layout>
  );
}
