import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import POList from './components/POList';
import POCreate from './components/POCreate';
import PODetail from './components/PODetail';
import FinanceView from './components/FinanceView';
import Settings from './components/Settings';
import HelpGuide from './components/HelpGuide';
import Login from './components/Login';
import ReportingView from './components/ReportingView';
import HistoryView from './components/HistoryView';
import PendingApproval from './components/PendingApproval';

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
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            
            <Route path="requests" element={<POList filter="ALL" />} />
            <Route path="approvals" element={<POList filter="PENDING" />} />
            <Route path="requests/:id" element={<PODetail />} />
            <Route path="create" element={<POCreate />} />
            <Route path="finance" element={<FinanceView />} />
            <Route path="settings" element={<Settings />} />
            <Route path="reports" element={<ReportingView />} />
            <Route path="history" element={<HistoryView />} />
            <Route path="help" element={<HelpGuide />} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;