import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import ItemDetail from './pages/ItemDetail';
import CheckInOut from './pages/CheckInOut';
import Maintenance from './pages/Maintenance';
import Retirements from './pages/Retirements';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import Backup from './pages/Backup';
import Settings from './pages/Settings';
import AssetHistory from './pages/AssetHistory';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/items" element={<ProtectedRoute><Items /></ProtectedRoute>} />
      <Route path="/items/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
      <Route path="/checkouts" element={<ProtectedRoute><CheckInOut /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
      <Route path="/retirements" element={<ProtectedRoute><Retirements /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AssetHistory /></ProtectedRoute>} />
      {/* Admin-only routes */}
      <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
      <Route path="/audit" element={<AdminRoute><AuditLog /></AdminRoute>} />
      <Route path="/backup" element={<AdminRoute><Backup /></AdminRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
