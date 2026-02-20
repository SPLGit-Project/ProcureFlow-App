import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList as TaskIcon,
  Clock,
  DollarSign,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MapPin,
  Menu,
  Moon,
  PlusCircle,
  Settings,
  Sun,
  X
} from 'lucide-react';
import { DEFAULT_NAV_ITEMS } from '../constants/navigation';
import PwaInstaller from './PwaInstaller';
import UpdateToast from './UpdateToast';
import VersionBadge from './VersionBadge';
import { MultiSiteSelector } from './MultiSiteSelector';
import TaskDrawer from './TaskDrawer';
import AccountDrawer from './AccountDrawer';

const SIDEBAR_COLLAPSED_KEY = 'pf-sidebar-collapsed';

const toTitleCase = (value: string) =>
  value
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const Layout = () => {
  const {
    currentUser,
    theme,
    setTheme,
    branding,
    hasPermission,
    activeSiteIds,
    setActiveSiteIds,
    userSites
  } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = React.useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const location = useLocation();

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    LayoutDashboard,
    PlusCircle,
    FileText,
    CheckCircle,
    Activity,
    DollarSign,
    BarChart3,
    Clock,
    Settings,
    HelpCircle
  };

  const navItems = React.useMemo(() => {
    const config = branding.menuConfig || [];
    return DEFAULT_NAV_ITEMS.map(item => {
      const conf = config.find(c => c.id === item.id);
      return {
        ...item,
        order: conf ? conf.order : DEFAULT_NAV_ITEMS.indexOf(item),
        isVisible: conf ? conf.isVisible : true,
        label: conf?.customLabel || item.label,
        icon: iconMap[item.iconName] || HelpCircle
      };
    })
      .filter(item => item.isVisible)
      .sort((a, b) => a.order - b.order)
      .filter(item => !item.permission || hasPermission(item.permission));
  }, [branding.menuConfig, hasPermission]);

  const pageTitle = React.useMemo(() => {
    const directMatch = navItems.find(item => item.path === location.pathname);
    if (directMatch) return directMatch.label;
    if (location.pathname.startsWith('/requests/')) return 'Request Details';
    const fallback = location.pathname
      .split('/')
      .filter(Boolean)
      .map(segment => toTitleCase(segment))
      .join(' / ');
    return fallback || 'Dashboard';
  }, [location.pathname, navItems]);

  const isSidebarDark = branding.sidebarTheme === 'brand' || branding.sidebarTheme === 'dark';
  const sidebarWidthClass = isSidebarCollapsed ? 'md:w-20' : 'md:w-72';
  const sidebarBaseClass =
    'fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto flex flex-col border-r border-gray-200 dark:border-gray-800 backdrop-blur-xl';

  let sidebarThemeClass = 'bg-white/95 dark:bg-[#1e2029]/95';
  if (branding.sidebarTheme === 'dark') sidebarThemeClass = 'bg-[#1e2029] text-white border-r-0';
  else if (branding.sidebarTheme === 'light') sidebarThemeClass = 'bg-white text-gray-800';
  else if (branding.sidebarTheme === 'brand') sidebarThemeClass = 'bg-[var(--color-brand)] text-white border-r-0';

  const getNavLinkClass = (isActive: boolean) => {
    const compactClass = isSidebarCollapsed ? 'justify-center px-2 py-3.5' : 'gap-3 px-4 py-3';
    const base = `relative flex items-center rounded-xl transition-all duration-200 font-medium text-sm group ${compactClass}`;
    if (isSidebarDark) {
      return isActive
        ? `${base} bg-white/20 text-white shadow-sm`
        : `${base} text-white/75 hover:bg-white/10 hover:text-white`;
    }
    return isActive
      ? `${base} bg-[rgba(var(--color-brand-rgb),0.1)] text-[var(--color-brand)] shadow-sm`
      : `${base} text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white`;
  };

  if (!currentUser) return null;

  return (
    <div
      className="flex h-[100dvh] bg-app text-secondary dark:text-slate-300 font-sans selection:bg-[var(--color-brand)] selection:text-white transition-colors duration-200"
      style={{ fontFamily: 'var(--font-family)' }}
    >
      <PwaInstaller />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`${sidebarBaseClass} ${sidebarWidthClass} ${sidebarThemeClass} ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
      >
        <div
          className={`p-4 md:py-5 flex items-center gap-3 shrink-0 ${isSidebarCollapsed ? 'md:px-3' : 'md:px-5'}`}
        >
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain shrink-0" />
          ) : (
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-md shrink-0 ${isSidebarDark ? 'bg-white text-[var(--color-brand)]' : 'bg-gradient-to-br from-[var(--color-brand)] to-purple-600 text-white'}`}
            >
              {branding.appName.charAt(0)}
            </div>
          )}

          {!isSidebarCollapsed && (
            <h1 className="text-lg font-bold tracking-tight truncate flex-1" title={branding.appName}>
              {branding.appName}
            </h1>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="hidden md:inline-flex p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            <button
              type="button"
              className="md:hidden p-2 text-current opacity-70 hover:opacity-100 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {userSites.length > 0 && (
          <div className={`shrink-0 pb-4 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
            {isSidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-full h-10 rounded-xl border border-gray-200/70 dark:border-white/15 bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center justify-center relative"
                title={
                  activeSiteIds.length > 0
                    ? `${activeSiteIds.length} site${activeSiteIds.length > 1 ? 's' : ''} selected`
                    : 'No site selected'
                }
              >
                <MapPin size={16} />
                {activeSiteIds.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 text-[10px] font-bold rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center">
                    {activeSiteIds.length}
                  </span>
                )}
              </button>
            ) : (
              <MultiSiteSelector
                sites={userSites}
                selectedSiteIds={activeSiteIds}
                onChange={setActiveSiteIds}
                variant={isSidebarDark ? 'brand' : 'light'}
              />
            )}
          </div>
        )}

        <nav className={`flex-1 space-y-1 overflow-y-auto py-4 scrollbar-hide ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
          {!isSidebarCollapsed && (
            <p className={`px-4 text-xs font-bold uppercase tracking-wider mb-3 ${isSidebarDark ? 'text-white/50' : 'text-tertiary'}`}>
              Menu
            </p>
          )}
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => getNavLinkClass(isActive)}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full transition-opacity ${isActive ? (isSidebarDark ? 'bg-white/85' : 'bg-[var(--color-brand)]') : 'opacity-0'}`}
                    />
                    <Icon size={18} className="shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {!isSidebarCollapsed && (
          <div className="mx-4 mb-4 mt-2">
            <VersionBadge />
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden relative w-full">
        <header className="bg-white/80 dark:bg-[#15171e]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 h-16 flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 z-20 shrink-0 sticky top-0 transition-all">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(open => !open)}
              className="md:hidden p-2 -ml-1 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              aria-label="Toggle mobile menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">Workspace</span>
                <ChevronRight size={12} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{pageTitle}</span>
              </div>
              <span className="md:hidden text-sm font-semibold text-gray-900 dark:text-white truncate">{pageTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <button
              onClick={() => setIsTaskDrawerOpen(true)}
              className="relative p-2.5 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group active:scale-95"
              title="Task Center"
            >
              <TaskIcon size={20} className="group-hover:text-[var(--color-brand)] transition-colors" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#15171e] animate-pulse" />
            </button>

            <button
              className="relative p-2.5 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group active:scale-95"
              title="Notifications"
            >
              <Bell size={20} className="group-hover:text-[var(--color-brand)] transition-colors" />
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all active:scale-95 group"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun size={20} className="group-hover:text-amber-500 transition-colors" />
              ) : (
                <Moon size={20} className="group-hover:text-indigo-500 transition-colors" />
              )}
            </button>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-0.5 hidden sm:block" />

            <div
              onClick={() => setIsAccountDrawerOpen(true)}
              className="flex items-center gap-2 pl-1 pr-1 md:pr-3 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm group-hover:border-[var(--color-brand)] transition-colors">
                <img
                  src={
                    currentUser.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`
                  }
                  alt="User"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="hidden md:block text-xs font-bold text-primary dark:text-white group-hover:text-[var(--color-brand)] transition-colors">
                {currentUser.name.split(' ')[0]}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8 scroll-smooth pb-safe">
          <Outlet />
        </main>
      </div>

      <UpdateToast />

      <TaskDrawer isOpen={isTaskDrawerOpen} onClose={() => setIsTaskDrawerOpen(false)} />

      <AccountDrawer isOpen={isAccountDrawerOpen} onClose={() => setIsAccountDrawerOpen(false)} />
    </div>
  );
};

export default Layout;
