import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Login from './components/Login';
import OnboardingWizard from './components/OnboardingWizard';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW: Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        console.error('SW: Service Worker registration failed:', error);
      });
  });
}

// Lazy Load Heavy Components
const Dashboard = lazy(() => import('./components/Dashboard'));
const POList = lazy(() => import('./components/POList'));
const POCreate = lazy(() => import('./components/POCreate'));
const PODetail = lazy(() => import('./components/PODetail'));
const FinanceView = lazy(() => import('./components/FinanceView'));
const Settings = lazy(() => import('./components/Settings'));
const HelpGuide = lazy(() => import('./components/HelpGuide'));
const ReportingView = lazy(() => import('./components/ReportingView'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const ActiveRequestsView = lazy(() => import('./components/ActiveRequestsView'));

const LoadingSpinner = () => (
    <div className="h-full w-full flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand)]"></div>
    </div>
);

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, isPendingApproval, isLoadingAuth } = useApp();
    
    if (isLoadingAuth) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-50 dark:bg-[#15171e]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (isPendingApproval) {
        return <Navigate to="/pending-approval" replace />;
    }

    return <>{children}</>;
};

function App() {
  return (
    <AppProvider>
      <PWAInstallPrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pending-approval" element={<OnboardingWizard />} />
          
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>} />
            
            <Route path="requests" element={<Suspense fallback={<LoadingSpinner />}><POList filter="ALL" /></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<LoadingSpinner />}><POList filter="PENDING" /></Suspense>} />
            <Route path="active-requests" element={<Suspense fallback={<LoadingSpinner />}><ActiveRequestsView /></Suspense>} />
            <Route path="completed" element={<Suspense fallback={<LoadingSpinner />}><POList filter="COMPLETED" /></Suspense>} />
            <Route path="requests/:id" element={<Suspense fallback={<LoadingSpinner />}><PODetail /></Suspense>} />
            <Route path="create" element={<Suspense fallback={<LoadingSpinner />}><POCreate /></Suspense>} />
            <Route path="finance" element={<Suspense fallback={<LoadingSpinner />}><FinanceView /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<LoadingSpinner />}><Settings /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<LoadingSpinner />}><ReportingView /></Suspense>} />
            <Route path="history" element={<Suspense fallback={<LoadingSpinner />}><HistoryView /></Suspense>} />
            <Route path="help" element={<Suspense fallback={<LoadingSpinner />}><HelpGuide /></Suspense>} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;