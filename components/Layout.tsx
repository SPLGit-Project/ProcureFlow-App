
import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  CheckCircle, 
  DollarSign, 
  Settings,
  Menu,
  X,
  Moon,
  Sun,
  HelpCircle,
  LogOut,
  BarChart3,
  Clock,
  MapPin, 
  Building,
  Shield,
  ChevronDown,
  ChevronUp,
  UserCog,
  Link as LinkIcon,
  Activity
} from 'lucide-react';
import { PermissionId, MenuItemConfig } from '../types';
import { DEFAULT_NAV_ITEMS, NavItemConfig } from '../constants/navigation';
import PwaInstaller from './PwaInstaller';
import UpdateToast from './UpdateToast';
import VersionBadge from './VersionBadge';
import { MultiSiteSelector } from './MultiSiteSelector';
import TaskDrawer from './TaskDrawer';
import AccountDrawer from './AccountDrawer';
import { Bell, ClipboardList as TaskIcon } from 'lucide-react';

const Layout = () => {
  const { currentUser, logout, users, switchRole, roles, theme, setTheme, branding, hasPermission, activeSiteIds, setActiveSiteIds, sites, userSites, siteName } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = React.useState(false);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = React.useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-collapse profile on route change
  React.useEffect(() => {
    setIsProfileExpanded(false);
  }, [location.pathname]);

  // Auto-collapse profile on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isProfileExpanded && profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileExpanded]);

  // Admin Role Switcher (Mock for testing permissions)
  const isActualAdmin = currentUser?.role === 'ADMIN'; // Real check would be against the DB record

  // Icon Mapping
  const iconMap: Record<string, any> = {
      LayoutDashboard, PlusCircle, FileText, CheckCircle, Activity, 
      DollarSign, BarChart3, Clock, Settings, HelpCircle
  };

  const navItems = React.useMemo(() => {
    // 1. Get Config or Default
    const config = branding.menuConfig || [];
    
    // 2. Map items
    return DEFAULT_NAV_ITEMS.map(item => {
        const conf = config.find(c => c.id === item.id);
        return {
            ...item,
            // Use config order if present, else default index (though we generally expect config to be complete if present)
            order: conf ? conf.order : DEFAULT_NAV_ITEMS.indexOf(item),
            isVisible: conf ? conf.isVisible : true,
            label: conf?.customLabel || item.label,
            icon: iconMap[item.iconName] || HelpCircle
        };
    })
    .filter(item => item.isVisible) // 3. Filter Hidden
    .sort((a, b) => a.order - b.order) // 4. Sort
    .filter(item => !item.permission || hasPermission(item.permission)); // 5. Filter Permissions
  }, [branding.menuConfig, hasPermission]);


  const sidebarBaseClass = `fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto flex flex-col border-r border-gray-200 dark:border-gray-800 backdrop-blur-xl`;
  
  // Sidebar Theme Logic
  let sidebarThemeClass = "bg-white/95 dark:bg-[#1e2029]/95";
  if (branding.sidebarTheme === 'dark') sidebarThemeClass = "bg-[#1e2029] text-white border-r-0";
  else if (branding.sidebarTheme === 'light') sidebarThemeClass = "bg-white text-gray-800";
  else if (branding.sidebarTheme === 'brand') sidebarThemeClass = "bg-[var(--color-brand)] text-white border-r-0";

  const getNavLinkClass = (isActive: boolean) => {
      const base = "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm group";
      if (branding.sidebarTheme === 'brand' || branding.sidebarTheme === 'dark') {
          return isActive 
            ? `${base} bg-white/20 text-white shadow-sm` 
            : `${base} text-white/70 hover:bg-white/10 hover:text-white`;
      }
      return isActive 
        ? `${base} bg-[rgba(var(--color-brand-rgb),0.1)] text-[var(--color-brand)]` 
        : `${base} text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white`;
  };

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-app text-secondary dark:text-slate-300 font-sans selection:bg-[var(--color-brand)] selection:text-white transition-colors duration-200" style={{fontFamily: 'var(--font-family)'}}>
      <PwaInstaller />
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`${sidebarBaseClass} ${sidebarThemeClass} ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        
        {/* Logo Area */}
        <div className="p-6 flex items-center gap-3 shrink-0">
          {branding.logoUrl ? (
             <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-md ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'bg-white text-[var(--color-brand)]' : 'bg-gradient-to-br from-[var(--color-brand)] to-purple-600 text-white'}`}>
                {branding.appName.charAt(0)}
            </div>
          )}
          <h1 className="text-lg font-bold tracking-tight truncate flex-1" title={branding.appName}>{branding.appName}</h1>
          <button className="md:hidden text-current opacity-70" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
        </div>

        {/* Site Selector — top of sidebar for clear visibility */}
        {userSites.length > 0 && (
            <div className="px-4 pb-4 shrink-0">
                <MultiSiteSelector 
                    sites={userSites}
                    selectedSiteIds={activeSiteIds}
                    onChange={setActiveSiteIds}
                    variant={['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'brand' : 'light'}
                />
            </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4 scrollbar-hide">
          <p className={`px-4 text-xs font-bold uppercase tracking-wider mb-3 ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/50' : 'text-tertiary'}`}>Menu</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => getNavLinkClass(isActive)}
            >
              <Icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
            );
          })}
          
        </nav>

        {/* Version Badge */}
        <div className="mx-4 mb-4 mt-2">
            <VersionBadge />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        

        {/* Desktop & Mobile Global Header */}
        <header className="bg-white/80 dark:bg-[#15171e]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 h-16 flex items-center justify-between px-4 md:px-8 z-20 shrink-0 sticky top-0 transition-all">
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                  className="md:hidden p-2 -ml-2 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                    <Menu />
                </button>
                <div className="hidden md:flex items-center gap-2">
                    <span className="text-sm font-bold text-tertiary uppercase tracking-widest">{location.pathname.substring(1) || 'Dashboard'}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
                {/* Task Center Trigger */}
                <button 
                    onClick={() => setIsTaskDrawerOpen(true)}
                    className="relative p-2.5 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group active:scale-95"
                    title="Task Center"
                >
                    <TaskIcon size={20} className="group-hover:text-[var(--color-brand)] transition-colors" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#15171e] animate-pulse"></span>
                </button>

                <button className="relative p-2.5 text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all group active:scale-95" title="Notifications">
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

                <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block"></div>

                <div 
                   onClick={() => setIsAccountDrawerOpen(true)}
                   className="flex items-center gap-3 pl-1 pr-1 md:pr-3 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer group"
                >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm group-hover:border-[var(--color-brand)] transition-colors">
                        <img src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`} alt="User" className="w-full h-full object-cover" />
                    </div>
                    <span className="hidden md:block text-xs font-bold text-primary dark:text-white group-hover:text-[var(--color-brand)] transition-colors">{currentUser.name.split(' ')[0]}</span>
                </div>
            </div>
        </header>
        
        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth">
            <Outlet />
        </main>
      </div>
      
      {/* Update Toast Notification */}
      <UpdateToast />

      {/* Task Center Drawer */}
      <TaskDrawer 
        isOpen={isTaskDrawerOpen} 
        onClose={() => setIsTaskDrawerOpen(false)} 
      />

      {/* Account Drawer */}
      <AccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
      />
    </div>
  );
};

export default Layout;
