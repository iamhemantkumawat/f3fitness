import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';

// Landing Page
import LandingPage from './pages/LandingPage';

// Auth Pages
import { Login, Signup, ForgotPassword } from './pages/Auth';

// Admin Pages
import { AdminDashboard } from './pages/Admin/Dashboard';
import { MembersList, TrainersList, CreateMember } from './pages/Admin/Members';
import { AssignPlan } from './pages/Admin/AssignPlan';
import { PaymentsList, AddPayment, PaymentReports, PendingPayments } from './pages/Admin/Payments';
import { MarkAttendance, TodayAttendance, AttendanceHistory } from './pages/Admin/Attendance';
import { PlansSettings, AnnouncementsSettings, HolidaysSettings, SMTPSettings, WhatsAppSettings } from './pages/Admin/Settings';
import { AdminProfile, MemberProfile, TrainerProfile } from './pages/Admin/Profile';

// Member Pages
import { MemberDashboard, MemberPlans } from './pages/Member/Dashboard';
import { HealthTracking } from './pages/Member/HealthTracking';

// Trainer Pages
import { TrainerDashboard, TrainerClients } from './pages/Trainer/Dashboard';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, token } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    switch (user.role) {
      case 'admin':
        return <Navigate to="/dashboard/admin" replace />;
      case 'trainer':
        return <Navigate to="/dashboard/trainer" replace />;
      default:
        return <Navigate to="/dashboard/member" replace />;
    }
  }

  return children;
};

// Public Route Component (redirects to dashboard if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading, token } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (token && user) {
    switch (user.role) {
      case 'admin':
        return <Navigate to="/dashboard/admin" replace />;
      case 'trainer':
        return <Navigate to="/dashboard/trainer" replace />;
      default:
        return <Navigate to="/dashboard/member" replace />;
    }
  }

  return children;
};

// Dashboard redirect based on role
const DashboardRedirect = () => {
  const { user, loading, token } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (user) {
    switch (user.role) {
      case 'admin':
        return <Navigate to="/dashboard/admin" replace />;
      case 'trainer':
        return <Navigate to="/dashboard/trainer" replace />;
      default:
        return <Navigate to="/dashboard/member" replace />;
    }
  }

  return <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth Routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Dashboard Redirect */}
      <Route path="/dashboard" element={<DashboardRedirect />} />

      {/* Admin Routes - under /dashboard/admin */}
      <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/admin/members" element={<ProtectedRoute allowedRoles={['admin']}><MembersList /></ProtectedRoute>} />
      <Route path="/dashboard/admin/trainers" element={<ProtectedRoute allowedRoles={['admin']}><TrainersList /></ProtectedRoute>} />
      <Route path="/dashboard/admin/members/new" element={<ProtectedRoute allowedRoles={['admin']}><CreateMember /></ProtectedRoute>} />
      <Route path="/dashboard/admin/members/:userId/assign-plan" element={<ProtectedRoute allowedRoles={['admin']}><AssignPlan /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payments" element={<ProtectedRoute allowedRoles={['admin']}><PaymentsList /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payments/new" element={<ProtectedRoute allowedRoles={['admin']}><AddPayment /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payments/reports" element={<ProtectedRoute allowedRoles={['admin']}><PaymentReports /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payments/pending" element={<ProtectedRoute allowedRoles={['admin']}><PendingPayments /></ProtectedRoute>} />
      <Route path="/dashboard/admin/attendance" element={<ProtectedRoute allowedRoles={['admin']}><MarkAttendance /></ProtectedRoute>} />
      <Route path="/dashboard/admin/attendance/today" element={<ProtectedRoute allowedRoles={['admin']}><TodayAttendance /></ProtectedRoute>} />
      <Route path="/dashboard/admin/attendance/history" element={<ProtectedRoute allowedRoles={['admin']}><AttendanceHistory /></ProtectedRoute>} />
      <Route path="/dashboard/admin/settings/plans" element={<ProtectedRoute allowedRoles={['admin']}><PlansSettings /></ProtectedRoute>} />
      <Route path="/dashboard/admin/settings/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AnnouncementsSettings /></ProtectedRoute>} />
      <Route path="/dashboard/admin/settings/holidays" element={<ProtectedRoute allowedRoles={['admin']}><HolidaysSettings /></ProtectedRoute>} />
      <Route path="/dashboard/admin/settings/smtp" element={<ProtectedRoute allowedRoles={['admin']}><SMTPSettings /></ProtectedRoute>} />
      <Route path="/dashboard/admin/settings/whatsapp" element={<ProtectedRoute allowedRoles={['admin']}><WhatsAppSettings /></ProtectedRoute>} />
      <Route path="/dashboard/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><AdminProfile /></ProtectedRoute>} />

      {/* Member Routes - under /dashboard/member */}
      <Route path="/dashboard/member" element={<ProtectedRoute allowedRoles={['member']}><MemberDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/member/plans" element={<ProtectedRoute allowedRoles={['member']}><MemberPlans /></ProtectedRoute>} />
      <Route path="/dashboard/member/profile" element={<ProtectedRoute allowedRoles={['member']}><MemberProfile /></ProtectedRoute>} />

      {/* Trainer Routes - under /dashboard/trainer */}
      <Route path="/dashboard/trainer" element={<ProtectedRoute allowedRoles={['trainer']}><TrainerDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/trainer/clients" element={<ProtectedRoute allowedRoles={['trainer']}><TrainerClients /></ProtectedRoute>} />
      <Route path="/dashboard/trainer/profile" element={<ProtectedRoute allowedRoles={['trainer']}><TrainerProfile /></ProtectedRoute>} />

      {/* Legacy routes redirect to new structure */}
      <Route path="/admin/*" element={<Navigate to="/dashboard/admin" replace />} />
      <Route path="/member/*" element={<Navigate to="/dashboard/member" replace />} />
      <Route path="/trainer/*" element={<Navigate to="/dashboard/trainer" replace />} />

      {/* Catch all - redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
