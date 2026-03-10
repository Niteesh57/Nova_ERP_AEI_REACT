import Sidebar from '../components/Sidebar';
import FunctionsAgent from '../components/FunctionsAgent';

export default function FunctionsPage() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', flex: 1, overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <FunctionsAgent />
      </main>
    </div>
  );
}
