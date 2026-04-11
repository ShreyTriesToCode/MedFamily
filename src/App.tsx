import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AccessControl from '@/pages/AccessControl';
import AppointmentsPage from '@/pages/Appointments';
import Dashboard from '@/pages/Dashboard';
import EmergencyPage from '@/pages/Emergency';
import HealthPage from '@/pages/Health';
import Login from '@/pages/Login';
import MedicineReminders from '@/pages/MedicineReminders';
import NotFound from '@/pages/NotFound';
import NotificationsPage from '@/pages/Notifications';
import Orders from '@/pages/Orders';
import PatientRecords from '@/pages/PatientRecords';
import PrescriptionUpload from '@/pages/PrescriptionUpload';
import { ROUTES } from '@/lib/constants';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path={ROUTES.LOGIN} element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                <Route
                  element={<ProtectedRoute allowedRoles={['patient_admin', 'doctor', 'hospital', 'caretaker']} />}
                >
                  <Route path={ROUTES.RECORDS} element={<PatientRecords />} />
                  <Route path={ROUTES.PRESCRIPTIONS} element={<PrescriptionUpload />} />
                  <Route path={ROUTES.REMINDERS} element={<MedicineReminders />} />
                  <Route path={ROUTES.APPOINTMENTS} element={<AppointmentsPage />} />
                  <Route path={ROUTES.HEALTH} element={<HealthPage />} />
                  <Route path={ROUTES.EMERGENCY} element={<EmergencyPage />} />
                </Route>

                <Route
                  element={<ProtectedRoute allowedRoles={['patient_admin', 'doctor', 'hospital', 'caretaker', 'chemist']} />}
                >
                  <Route path={ROUTES.ACCESS_CONTROL} element={<AccessControl />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['patient_admin', 'caretaker', 'chemist']} />}>
                  <Route path={ROUTES.ORDERS} element={<Orders />} />
                </Route>

                <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
              </Route>

              <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>

            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3200,
                style: {
                  borderRadius: '18px',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid color-mix(in srgb, var(--color-border) 92%, transparent)',
                  boxShadow: '0 16px 36px rgba(16, 63, 95, 0.12)',
                  backdropFilter: 'blur(16px)',
                },
              }}
            />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
