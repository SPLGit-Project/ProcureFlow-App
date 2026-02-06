
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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

const Layout = () => {
  const { currentUser, logout, users, switchRole, roles, theme, setTheme, branding, hasPermission, activeSiteIds, setActiveSiteIds, sites, siteName, originalUser, stopImpersonation } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = React.useState(false);
  const navigate = useNavigate();

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
        : `${base} text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white`;
  };

  if (!currentUser) return null;

  return (
    <div className="flex h-screen bg-app text-slate-700 dark:text-slate-300 font-sans selection:bg-[var(--color-brand)] selection:text-white transition-colors duration-200" style={{fontFamily: 'var(--font-family)'}}>
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
        
        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4 scrollbar-hide">
          <p className={`px-4 text-xs font-bold uppercase tracking-wider mb-3 ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/50' : 'text-gray-400'}`}>Menu</p>
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
          
          <div className="mt-8">
             <p className={`px-4 text-xs font-bold uppercase tracking-wider mb-3 ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/50' : 'text-gray-400'}`}>System</p>
             <div 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-gray-100 hover:text-gray-900'}`}
             >
                 {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                 <span className="font-medium text-sm">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                 <div className={`ml-auto w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-[var(--color-brand)]' : 'bg-gray-300'}`}>
                     <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${theme === 'dark' ? 'right-0.5' : 'left-0.5'}`}></div>
                 </div>
             </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="mx-4 mb-4">
          <div 
            onClick={() => setIsProfileExpanded(!isProfileExpanded)}
            className={`p-3 rounded-xl border transition-all cursor-pointer group select-none ${
              ['brand', 'dark'].includes(branding.sidebarTheme || '') 
                ? 'bg-white/10 border-white/10 hover:bg-white/15' 
                : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
            }`}
          >
             <div className="flex items-center gap-3">
                <div className="relative">
                  <img src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`} alt="User" className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white/20 shadow-sm" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1e2029] flex items-center justify-center ${isProfileExpanded ? 'bg-[var(--color-brand)] text-white' : 'bg-gray-200 text-gray-500'}`}>
                     {isProfileExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate transition-colors ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white' : 'text-gray-900'}`}>{currentUser.name}</p>
                    <p className={`text-[10px] uppercase font-bold px-1.5 rounded inline-block shadow-sm mt-0.5 ${
                      ['brand', 'dark'].includes(branding.sidebarTheme || '') 
                        ? 'bg-white/20 text-white border border-white/10' 
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {roles.find(r => r.id === currentUser.role)?.name || currentUser.role}
                    </p>
                </div>
             </div>
          </div>
          
          {/* Collapsible Content */}
          <div className={`space-y-3 overflow-hidden transition-all duration-300 ease-in-out ${isProfileExpanded ? 'max-h-96 opacity-100 mt-3 pl-2' : 'max-h-0 opacity-0 mt-0'}`}>
               {/* Quick Profile Link */}
               <button 
                  onClick={() => navigate('/settings', { state: { activeTab: 'PROFILE' } })}
                  className={`w-full flex items-center gap-3 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
                      ['brand', 'dark'].includes(branding.sidebarTheme || '') 
                      ? 'text-white/70 hover:text-white hover:bg-white/10' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
               >
                   <UserCog size={16} /> Edit Profile
               </button>

               {(currentUser.role === 'ADMIN' || (currentUser.siteIds && currentUser.siteIds.length > 1)) && (
                    <div className="space-y-1">
                        <p className={`text-[9px] uppercase font-bold px-1 flex items-center gap-1 ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/40' : 'text-gray-400'}`}>
                            <MapPin size={10}/> Site Context
                        </p>
                        <MultiSiteSelector 
                            sites={sites}
                            selectedSiteIds={activeSiteIds}
                            onChange={setActiveSiteIds}
                            variant={['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'brand' : 'light'}
                        />
                    </div>
               )}

               {currentUser.realRole === 'ADMIN' && (
                   <div className="space-y-1">
                       <p className={`text-[9px] uppercase font-bold px-1 ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/40' : 'text-gray-400'}`}>Switch View</p>
                       <select 
                          className={`w-full rounded-lg text-xs p-2.5 outline-none appearance-none cursor-pointer font-bold transition-all ${
                              ['brand', 'dark'].includes(branding.sidebarTheme || '') 
                              ? 'bg-black/30 text-white border border-white/10 hover:bg-black/40' 
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-white shadow-sm'
                          }`}
                          value={currentUser.role}
                          onChange={(e) => switchRole(e.target.value as any)}
                       >
                         <option value="ADMIN" className="text-gray-900 bg-white">Administrator View</option>
                         {roles.filter(r => r.id !== 'ADMIN').map(r => (
                             <option key={r.id} value={r.id} className="text-gray-900 bg-white">{r.name} View</option>
                         ))}
                       </select>
                   </div>
               )}
               
               <button 
                  onClick={logout}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg text-xs p-2.5 font-bold transition-all ${
                      ['brand', 'dark'].includes(branding.sidebarTheme || '') 
                      ? 'bg-white/10 text-white hover:bg-white/20 shadow-sm' 
                      : 'bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 shadow-sm'
                  }`}
               >
                   <LogOut size={14} /> Sign Out
               </button>
            </div>
        </div>

        {/* Version Badge */}
        <div className="mx-4 mb-4 mt-2">
            <VersionBadge />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        
        {/* Impersonation Banner */}
        {originalUser && (
             <div className="bg-orange-600 text-white px-4 py-2 text-center text-sm font-bold shadow-md z-50 flex items-center justify-center gap-4 animate-fade-in relative">
                <span className="flex items-center gap-2">
                    <div className="p-1 bg-white/20 rounded-full animate-pulse"><Shield size={14} /></div>
                    Viewing as <span className="underline decoration-white/50 underline-offset-4">{currentUser?.name}</span>
                </span>
                <button 
                    onClick={stopImpersonation}
                    className="bg-white text-orange-600 hover:bg-gray-100 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm flex items-center gap-1"
                >
                    <LogOut size={12}/> Exit View
                </button>
            </div>
        )}
        {/* Mobile Header */}
        <header className="md:hidden bg-white/90 dark:bg-[#15171e]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 h-16 flex items-center justify-between px-4 z-20 shrink-0 sticky top-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">
                    <Menu />
                </button>
                <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">{branding.appName}</span>
            </div>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700">
                <img src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`} alt="User" className="w-full h-full object-cover" />
            </div>
        </header>
        
        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scroll-smooth">
            <Outlet />
        </main>
      </div>
      
      {/* Update Toast Notification */}
      <UpdateToast />
    </div>
  );
};

export default Layout;
