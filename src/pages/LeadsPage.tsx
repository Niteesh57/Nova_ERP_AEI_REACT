import { useState } from 'react';
import Layout from '../components/Layout';
import LeadAgent from '../components/LeadAgent';
import MarketAgent from '../components/MarketAgent';

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<'vendor' | 'market'>('vendor');

  return (
    <Layout>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        
        {/* Toggle Bar */}
        <div style={{ padding: '0.75rem 1.5rem', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('vendor')}
            style={{ 
              padding: '0.5rem 1rem', 
              background: activeTab === 'vendor' ? '#ea580c' : '#f1f5f9',
              color: activeTab === 'vendor' ? '#fff' : '#64748b',
              border: activeTab === 'vendor' ? '1px solid #c2410c' : '1px solid #e2e8f0',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}>
            Vendor Extraction (Auto-fill)
          </button>
          
          <button 
            onClick={() => setActiveTab('market')}
            style={{ 
              padding: '0.5rem 1rem', 
              background: activeTab === 'market' ? '#ea580c' : '#f1f5f9',
              color: activeTab === 'market' ? '#fff' : '#64748b',
              border: activeTab === 'market' ? '1px solid #c2410c' : '1px solid #e2e8f0',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}>
            Market Intelligence (Competitors)
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: activeTab === 'vendor' ? 'block' : 'none' }}>
            <LeadAgent />
          </div>
          <div style={{ position: 'absolute', inset: 0, display: activeTab === 'market' ? 'block' : 'none' }}>
            <MarketAgent />
          </div>
        </div>

      </div>
    </Layout>
  );
}

