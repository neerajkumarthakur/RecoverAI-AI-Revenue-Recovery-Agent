import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Cases } from '../pages/Cases';
import { CaseDetail } from '../pages/CaseDetail';
import { Analytics } from '../pages/Analytics';
import { AIActivity } from '../pages/AIActivity';
import { Settings } from '../pages/Settings';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const apiKey = localStorage.getItem('recoverai_api_key');
  if (!apiKey) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'cases', element: <Cases /> },
      { path: 'cases/:id', element: <CaseDetail /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'ai-activity', element: <AIActivity /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
