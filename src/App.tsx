import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { PrivacyPolicy } from './components/LandingPage/pages/Privacypolicy';
import { TermsOfService } from './components/LandingPage/pages/Termsofservice';
import { Security } from './components/LandingPage/pages/Security';
import { Compliance } from './components/LandingPage/pages/Compliance';
import { Integrations } from './components/LandingPage/pages/Integrations';
import { Careers } from './components/LandingPage/pages/Careers';
import { ApiDocumentation } from './components/LandingPage/pages/Apidocumentation';
import { Sitemap } from './components/LandingPage/pages/Sitemap';
import { CheckoutPage } from './components/CheckoutPage';
import { OnboardingPage } from './components/OnboardingPage';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardPage } from './components/DashboardPage';
import { CustomersPage } from './components/CustomersPage';
import { WalletsPage } from './components/WalletsPage';
import { TransactionsPage } from './components/TransactionsPage';
import { TransfersPage } from './components/TransfersPage';
import { LoansPage } from './components/LoansPage';
import { LoanProductsPage } from './components/LoanProductsPage';
import { LoanApplicationsPage } from './components/LoanApplicationsPage';
import { RepaymentsPage } from './components/RepaymentsPage';
import { SavingsPage } from './components/SavingsPage';
import { SavingsProductsPage } from './components/SavingsProductsPage';
import { ExpensesPage } from './components/ExpensesPage';
import { FloatPage } from './components/FloatPage';
import { DailyOpeningPage } from './components/DailyOpeningPage';
import { DailyClosingPage } from './components/DailyClosingPage';
import { BranchTransfersPage } from './components/BranchTransfersPage';
import { BranchPerformancePage } from './components/BranchPerformancePage';
import { ChartOfAccountsPage } from './components/ChartOfAccountsPage';
import { JournalEntriesPage } from './components/JournalEntriesPage';
import { GeneralLedgerPage } from './components/GeneralLedgerPage';
import { TrialBalancePage } from './components/TrialBalancePage';
import { ReportsPage } from './components/ReportsPage';
import { NotificationsPage } from './components/NotificationsPage';
import { SettingsPage } from './components/SettingsPage';
import { ForexPage } from './components/ForexPage';
import { ApprovalsPage } from './components/ApprovalsPage';
import { UsersRolesPage } from './components/UsersRolesPage';
import LoadingScreen from './components/LoadingScreen';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// ==========================================
// PLATFORM OWNER CONSOLE (Trust Seed staff)
// ==========================================
import { PlatformPortal } from './components/platform/PlatformPortal';

function AppContent() {
  const { user, tenant, loading, error, needsPayment, isPlatformAdmin, signOut } = useAuth();
  const [currentPage, setCurrentPage] = React.useState('dashboard');
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    const handleNavigation = (e: CustomEvent) => {
      setCurrentPage(e.detail);
    };
    window.addEventListener('navigate', handleNavigation as EventListener);
    return () => window.removeEventListener('navigate', handleNavigation as EventListener);
  }, []);

  const handleBackToHome = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out from error screen:', err);
    } finally {
      window.location.href = '/';
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading Trust Seed Platform…" />;
  }

  if (error) {
    const isUnconfirmedEmail = /email not confirmed/i.test(error);
    const title = isUnconfirmedEmail ? 'Confirm your email' : 'Something went wrong';
    const description = isUnconfirmedEmail
      ? 'Your email address hasn\u2019t been confirmed yet. Check your inbox for a confirmation link, then try signing in again.'
      : error;

    return (
      <div className="min-h-screen bg-[#dae1e1] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dae1e1] overflow-hidden">
            <div className="bg-[#641f60] h-2" />
            <div className="p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <img src="/logo.png" alt="Trust Seed" className="w-10 h-10 rounded-lg object-contain" />
                <span className="text-lg font-bold text-[#641f60]">Trust Seed</span>
              </div>
              <div className="w-16 h-16 rounded-full bg-[#ee7b22]/15 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-8 h-8 text-[#ee7b22]" />
              </div>
              <h2 className="text-xl font-bold text-[#641f60] mb-2">{title}</h2>
              <p className="text-slate-600 mb-6 leading-relaxed">{description}</p>
              <button
                onClick={() => window.location.reload()}
                disabled={signingOut}
                className="w-full px-6 py-3 bg-[#ee7b22] text-white font-medium rounded-lg shadow-lg transition-all hover:bg-[#c46040] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              {isUnconfirmedEmail ? (
                <button
                  onClick={() => {
                    window.location.href = '/auth';
                  }}
                  disabled={signingOut}
                  className="w-full mt-3 px-6 py-3 border-2 border-[#641f60] text-[#641f60] font-medium rounded-lg transition-all hover:bg-[#641f60]/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back to Sign In
                </button>
              ) : (
                <button
                  onClick={handleBackToHome}
                  disabled={signingOut}
                  className="w-full mt-3 px-6 py-3 border-2 border-[#641f60] text-[#641f60] font-medium rounded-lg transition-all hover:bg-[#641f60]/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {signingOut ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Signing out...
                    </>
                  ) : (
                    <>
                      <Home className="w-4 h-4" />
                      Back to Home
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/security" element={<Security />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/api-documentation" element={<ApiDocumentation />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ==========================================
  // PLATFORM OWNER CONSOLE
  // ==========================================
  // isPlatformAdmin comes from an active platform_admins row, verified
  // server-side. It is NOT derived from user_metadata or an email domain,
  // both of which a client can set for itself. The console's cross-tenant
  // data access is enforced by the is_platform_admin() RLS policies, so
  // even a tampered client gets nothing back.
  //
  // Checked before every tenant gate below, since platform staff have no
  // tenant, no subscription, and no onboarding state.
  if (isPlatformAdmin) {
    return <PlatformPortal />;
  }

  // Signed up but hasn't completed payment yet - no tenant exists for them
  // until provisioning runs, so this must come before any tenant-dependent
  // rendering (including DashboardLayout).
  if (needsPayment) {
    return <CheckoutPage />;
  }

  if (tenant && !tenant.onboarding_completed) {
    return <OnboardingPage />;
  }

  // ==========================================
  // TENANT SUBSCRIBER OPERATIONS
  // ==========================================
  const renderTenantPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'customers':
        return <CustomersPage />;
      case 'wallets':
        return <WalletsPage />;
      case 'transactions':
        return <TransactionsPage />;
      case 'transfers':
        return <TransfersPage />;
      case 'forex':
        return <ForexPage />;
      case 'approvals':
        return <ApprovalsPage />;
      case 'loan-products':
        return <LoanProductsPage />;
      case 'loan-applications':
        return <LoanApplicationsPage />;
      case 'loans':
        return <LoansPage tab="active" />;
      case 'repayments':
        return <RepaymentsPage />;
      case 'savings-products':
        return <SavingsProductsPage />;
      case 'savings-accounts':
        return <SavingsPage tab="accounts" />;
      case 'expenses':
        return <ExpensesPage />;
      case 'float':
        return <FloatPage />;
      case 'daily-opening':
        return <DailyOpeningPage />;
      case 'daily-closing':
        return <DailyClosingPage />;
      case 'branch-transfers':
        return <BranchTransfersPage />;
      case 'branch-performance':
        return <BranchPerformancePage />;
      case 'chart-of-accounts':
        return <ChartOfAccountsPage />;
      case 'journals':
        return <JournalEntriesPage />;
      case 'ledger':
        return <GeneralLedgerPage />;
      case 'trial-balance':
        return <TrialBalancePage />;
      case 'reports':
        return <ReportsPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'users-roles':
        return <UsersRolesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <DashboardLayout>{renderTenantPage()}</DashboardLayout>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;