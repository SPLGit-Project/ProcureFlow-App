import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.tsx';
import Layout from './components/Layout.tsx';
import Login from './components/Login.tsx';
import PendingApproval from './components/PendingApproval.tsx';

import InviteLanding from './components/InviteLanding.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Register Service Worker
if ('serviceWorker' in navigator) {
  globalThis.addEventListener('load', () => {
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
const Dashboard = lazy(() => import('./components/Dashboard.tsx'));
const POList = lazy(() => import('./components/POList.tsx'));
const POCreate = lazy(() => import('./components/POCreate.tsx'));
const PODetail = lazy(() => import('./components/PODetail.tsx'));
const FinanceView = lazy(() => import('./components/FinanceView.tsx'));
const Settings = lazy(() => import('./components/Settings.tsx'));
const HelpGuide = lazy(() => import('./components/HelpGuide.tsx'));
const ReportingView = lazy(() => import('./components/ReportingView.tsx'));
const HistoryView = lazy(() => import('./components/HistoryView.tsx'));
const ActiveRequestsView = lazy(() => import('./components/ActiveRequestsView.tsx'));
const SmartBuyingDashboard = lazy(() => import('./components/SmartBuyingDashboard.tsx'));
const DataIngestion = lazy(() => import('./components/DataIngestion.tsx'));
const ApprovalQueue       = lazy(() => import('./components/ApprovalQueue.tsx'));
const ItemCatalogue       = lazy(() => import('./components/ItemCatalogue.tsx'));
const ItemRequestWizard   = lazy(() => import('./components/wizards/ItemRequestWizard.tsx'));
const DuplicateCheckWizard = lazy(() => import('./components/wizards/DuplicateCheckWizard.tsx'));
const ItemDefinitionWizard = lazy(() => import('./components/wizards/ItemDefinitionWizard.tsx'));
const PricingSetupWizard = lazy(() => import('./components/wizards/PricingSetupWizard.tsx'));
const ApprovalReviewWizard = lazy(() => import('./components/wizards/ApprovalReviewWizard.tsx'));
const MyItemRequests      = lazy(() => import('./components/MyItemRequests.tsx'));
const MasterDataQueue     = lazy(() => import('./components/MasterDataQueue.tsx'));
const PricingReviewQueue  = lazy(() => import('./components/PricingReviewQueue.tsx'));
const ItemRequestDetail   = lazy(() => import('./components/ItemRequestDetail.tsx')); // Placeholder
const ApprovalRulesConfig = lazy(() => import('./components/ApprovalRulesConfig.tsx'));
const PricingSchedulesList = lazy(() => import('./components/PricingSchedulesList.tsx'));
const PricingScheduleForm = lazy(() => import('./components/PricingScheduleForm.tsx'));
const PriceManagementDashboard = lazy(() => import('./components/PriceManagementDashboard.tsx'));
const AdminTools = lazy(() => import('./components/AdminTools.tsx'));
const CutoverReadinessChecker = lazy(() => import('./components/CutoverReadinessChecker.tsx'));
const ColourPaletteAdmin = lazy(() => import('./components/ColourPaletteAdmin.tsx'));
const ProcurementReviewWizard = lazy(() => import('./components/wizards/ProcurementReviewWizard.tsx'));




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
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invite" element={<InviteLanding />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            
            <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Suspense fallback={<LoadingSpinner />}><Dashboard /></Suspense>} />
              
              <Route path="requests" element={<Suspense fallback={<LoadingSpinner />}><POList filter="ALL" /></Suspense>} />
              <Route path="approvals" element={<Suspense fallback={<LoadingSpinner />}><ApprovalQueue /></Suspense>} />
              <Route path="active-requests" element={<Suspense fallback={<LoadingSpinner />}><ActiveRequestsView /></Suspense>} />
              <Route path="completed" element={<Suspense fallback={<LoadingSpinner />}><POList filter="COMPLETED" /></Suspense>} />
              <Route path="requests/:id" element={<Suspense fallback={<LoadingSpinner />}><PODetail /></Suspense>} />
              <Route path="create" element={<Suspense fallback={<LoadingSpinner />}><POCreate /></Suspense>} />
              <Route path="finance" element={<Suspense fallback={<LoadingSpinner />}><FinanceView /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<LoadingSpinner />}><Settings /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<LoadingSpinner />}><ReportingView /></Suspense>} />
              <Route path="history" element={<Suspense fallback={<LoadingSpinner />}><HistoryView /></Suspense>} />
              <Route path="help" element={<Suspense fallback={<LoadingSpinner />}><HelpGuide /></Suspense>} />
              <Route path="smart-buying" element={<Suspense fallback={<LoadingSpinner />}><SmartBuyingDashboard /></Suspense>} />
              <Route path="data-ingest" element={<Suspense fallback={<LoadingSpinner />}><DataIngestion /></Suspense>} />
              <Route path="item-creation-preview" element={<Navigate to="/items/new-request" replace />} />
              <Route path="item-approval-queue"   element={<Navigate to="/approvals" replace />} />
              <Route path="item-catalogue"        element={<Suspense fallback={<LoadingSpinner />}><ItemCatalogue /></Suspense>} />
              <Route path="items/new-request"     element={<Suspense fallback={<LoadingSpinner />}><ItemRequestWizard /></Suspense>} />
              <Route path="items/my-requests"     element={<Suspense fallback={<LoadingSpinner />}><MyItemRequests /></Suspense>} />
              <Route path="items/master-data-queue" element={<Suspense fallback={<LoadingSpinner />}><MasterDataQueue /></Suspense>} />
              <Route path="items/requests/:id/duplicate-check" element={<Suspense fallback={<LoadingSpinner />}><DuplicateCheckWizard /></Suspense>} />
              <Route path="items/requests/:id/define" element={<Suspense fallback={<LoadingSpinner />}><ItemDefinitionWizard /></Suspense>} />
              <Route path="items/requests/:id/pricing" element={<Suspense fallback={<LoadingSpinner />}><PricingSetupWizard /></Suspense>} />
              <Route path="items/requests/:id/approve" element={<Suspense fallback={<LoadingSpinner />}><ApprovalReviewWizard /></Suspense>} />
              <Route path="items/requests/:id/procurement-review" element={<Suspense fallback={<LoadingSpinner />}><ProcurementReviewWizard /></Suspense>} />
              <Route path="items/requests/:id"    element={<Suspense fallback={<LoadingSpinner />}><ItemRequestDetail /></Suspense>} />
              <Route path="items/pricing-queue"   element={<Suspense fallback={<LoadingSpinner />}><PricingReviewQueue /></Suspense>} />
              <Route path="admin/approval-rules"  element={<Suspense fallback={<LoadingSpinner />}><ApprovalRulesConfig /></Suspense>} />
              <Route path="pricing/schedules"     element={<Suspense fallback={<LoadingSpinner />}><PricingSchedulesList /></Suspense>} />
              <Route path="pricing/schedules/new" element={<Suspense fallback={<LoadingSpinner />}><PricingScheduleForm /></Suspense>} />
              <Route path="pricing/dashboard"     element={<Suspense fallback={<LoadingSpinner />}><PriceManagementDashboard /></Suspense>} />
              <Route path="admin/tools"           element={<Suspense fallback={<LoadingSpinner />}><AdminTools /></Suspense>} />
              <Route path="admin/cutover"         element={<Suspense fallback={<LoadingSpinner />}><CutoverReadinessChecker /></Suspense>} />
              <Route path="admin/colours"         element={<Suspense fallback={<LoadingSpinner />}><ColourPaletteAdmin /></Suspense>} />




              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  );
}

export default App;
