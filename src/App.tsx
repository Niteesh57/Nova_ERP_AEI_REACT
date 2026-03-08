import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Console from './pages/Console';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import CallAgentPage from './pages/CallAgentPage';
import LeadsPage from './pages/LeadsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/console" element={<Console />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/agent" element={<CallAgentPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        {/* Redirect unknown paths to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
