import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import VideoUpload from './pages/VideoUpload';
import Analysis from './pages/Analysis';
import RiskReport from './pages/RiskReport';
import Progress from './pages/Progress';
import Reports from './pages/Reports';
import CoachDashboard from './pages/CoachDashboard';
import CoachAthleteDetail from './pages/CoachAthleteDetail';
import PhysioDashboard from './pages/PhysioDashboard';
import ScientistDashboard from './pages/ScientistDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { decodeToken } from './utils/auth';
import { getRoleConfig } from './utils/roleConfig';

// Applies the data-role attribute to <html> so global.css's role accent
// colors kick in — re-checked on every navigation (covers login/logout).
function RoleThemeSync() {
  const location = useLocation();
  useEffect(() => {
    const token = localStorage.getItem('token');
    const decoded = token ? decodeToken(token) : null;
    if (decoded?.role) {
      document.documentElement.setAttribute('data-role', decoded.role);
    } else {
      document.documentElement.removeAttribute('data-role');
    }
  }, [location.pathname]);
  return null;
}

// Guards a route to only the roles listed in `allow`. Wrong role gets
// redirected to their own home page instead of the athlete's.
function RoleRoute({ allow, children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;

  const decoded = decodeToken(token);
  const role = decoded?.role || 'athlete';

  if (!allow.includes(role)) {
    return <Navigate to={getRoleConfig(role).homePath} />;
  }
  return children;
}

// Shared across every role — no restriction beyond being logged in.
function AnyLoggedInRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="page-transition" key={location.pathname}>
      <RoleThemeSync />
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Athlete-only */}
        <Route path="/dashboard" element={<RoleRoute allow={['athlete']}><Dashboard /></RoleRoute>} />
        <Route path="/videos" element={<RoleRoute allow={['athlete']}><VideoUpload /></RoleRoute>} />
        <Route path="/progress" element={<RoleRoute allow={['athlete']}><Progress /></RoleRoute>} />
        <Route path="/profile" element={<RoleRoute allow={['athlete']}><Profile /></RoleRoute>} />
        <Route path="/analysis" element={<RoleRoute allow={['athlete']}><Analysis /></RoleRoute>} />
        <Route path="/risk" element={<RoleRoute allow={['athlete']}><RiskReport /></RoleRoute>} />
        <Route path="/reports" element={<RoleRoute allow={['athlete']}><Reports /></RoleRoute>} />

        {/* Coach-only */}
        <Route path="/coach-dashboard" element={<RoleRoute allow={['coach']}><CoachDashboard /></RoleRoute>} />
        <Route path="/coach-dashboard/athlete/:athleteId" element={<RoleRoute allow={['coach']}><CoachAthleteDetail /></RoleRoute>} />

        {/* Physiotherapist-only */}
        <Route path="/physio-dashboard" element={<RoleRoute allow={['physiotherapist']}><PhysioDashboard /></RoleRoute>} />


        {/* Sports Scientist-only */}
        <Route path="/scientist-dashboard" element={<RoleRoute allow={['sports_scientist']}><ScientistDashboard /></RoleRoute>} />

        {/* Admin-only */}
        <Route path="/admin-dashboard" element={<RoleRoute allow={['admin']}><AdminDashboard /></RoleRoute>} />

        {/* Shared by every role */}
        <Route path="/settings" element={<AnyLoggedInRoute><Settings /></AnyLoggedInRoute>} />
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