import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import VideoUpload from './pages/VideoUpload';
import Analysis from './pages/Analysis';
import RiskReport from './pages/RiskReport';
import CoachDashboard from './pages/CoachDashboard';
import PhysioDashboard from './pages/PhysioDashboard';
import ScientistDashboard from './pages/ScientistDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Reports from './pages/Reports';
import ProtectedRoute from './components/ProtectedRoute';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="page-transition" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/videos" element={<ProtectedRoute><VideoUpload /></ProtectedRoute>} />
        <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
        <Route path="/risk" element={<ProtectedRoute><RiskReport /></ProtectedRoute>} />
        <Route path="/coach-dashboard" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />
        <Route path="/physio-dashboard" element={<ProtectedRoute><PhysioDashboard /></ProtectedRoute>} />
        <Route path="/scientist-dashboard" element={<ProtectedRoute><ScientistDashboard /></ProtectedRoute>} />
        <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}