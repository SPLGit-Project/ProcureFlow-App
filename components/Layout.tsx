
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
  Building
} from 'lucide-react';
import { PermissionId } from '../types';

const Layout = () => {
  const { currentUser, logout, users, switchRole, roles, theme, setTheme, branding, hasPermission, activeSiteId, setActiveSiteId, sites, siteName } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  // Admin Role Switcher (Mock for testing permissions)
  const isActualAdmin = currentUser?.role === 'ADMIN'; // Real check would be against the DB record

  const navItems: { to: string; label: string; icon: any; permission?: PermissionId }[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
    { to: '/create', label: 'Create Request', icon: PlusCircle, permission: 'create_request' },
    { to: '/requests', label: 'Log Requests', icon: FileText, permission: 'view_dashboard' }, // Basic access
    { to: '/approvals', label: 'Approvals', icon: CheckCircle, permission: 'approve_requests' },
    { to: '/finance', label: 'Finance Review', icon: DollarSign, permission: 'view_finance' },
    { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'view_finance' },
    { to: '/history', label: 'History', icon: Clock, permission: 'view_finance' },
    { to: '/settings', label: 'Admin Panel', icon: Settings, permission: 'manage_settings' },
    { to: '/help', label: 'Help & Support', icon: HelpCircle },
  ];

  const filteredNav = navItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

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
    <div className="flex h-screen bg-gray-50 dark:bg-[#15171e] text-slate-700 dark:text-slate-300 font-sans selection:bg-[var(--color-brand)] selection:text-white transition-colors duration-200" style={{fontFamily: 'var(--font-family)'}}>
      
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
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => getNavLinkClass(isActive)}
            >
              <item.icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          
          <div className="mt-8">
             <p className={`px-4 text-xs font-bold uppercase tracking-wider mb-3 ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/50' : 'text-gray-400'}`}>System</p>
             <div 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}
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
        <div 
          onClick={() => navigate('/settings', { state: { activeTab: 'PROFILE' } })}
          className="p-4 m-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-md cursor-pointer hover:bg-white/15 transition-all group"
        >
           <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <img src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random&color=fff`} alt="User" className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white/20 shadow-sm transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <Settings size={12} className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate transition-colors group-hover:text-white">{currentUser.name}</p>
                  <p className={`text-[10px] uppercase font-bold px-1.5 rounded inline-block shadow-sm ${
                    ['brand', 'dark'].includes(branding.sidebarTheme || '') 
                      ? 'bg-white/20 text-white border border-white/10' 
                      : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] dark:bg-[rgba(var(--color-brand-rgb),0.2)] dark:text-blue-400 border border-[var(--color-brand)]/20'
                  }`}>
                    {roles.find(r => r.id === currentUser.role)?.name || currentUser.role}
                  </p>
              </div>
           </div>
           
           <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
             {/* Site Switcher */}
             {(currentUser.role === 'ADMIN' || (currentUser.siteIds && currentUser.siteIds.length > 1)) && (
                  <div className="space-y-1">
                      <p className="text-[9px] uppercase font-bold text-white/40 px-1 flex items-center gap-1"><MapPin size={10}/> Site Context</p>
                      <select 
                        className={`w-full rounded-lg text-xs p-2.5 outline-none appearance-none cursor-pointer font-bold shadow-sm transition-all ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'bg-black/30 text-white border-white/10 hover:bg-black/40' : 'bg-white dark:bg-[#15171e] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-[var(--color-brand)]'}`}
                        value={activeSiteId || ''}
                        onChange={(e) => setActiveSiteId(e.target.value === '' ? null : e.target.value)}
                     >
                       <option value="" className="text-gray-900 bg-white">All Sites (Global)</option>
                       {sites.map(s => (
                           <option key={s.id} value={s.id} className="text-gray-900 bg-white">{s.name}</option>
                       ))}
                     </select>
                  </div>
             )}

             {currentUser.realRole === 'ADMIN' && (
                 <div className="space-y-1">
                     <p className="text-[9px] uppercase font-bold text-white/40 px-1">Switch View</p>
                     <select 
                        className={`w-full rounded-lg text-xs p-2.5 outline-none appearance-none cursor-pointer font-bold shadow-sm transition-all ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'bg-black/30 text-white border-white/10 hover:bg-black/40' : 'bg-white dark:bg-[#15171e] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-[var(--color-brand)]'}`}
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
                className={`w-full flex items-center justify-center gap-2 rounded-lg text-xs p-2.5 font-bold transition-all shadow-sm ${['brand', 'dark'].includes(branding.sidebarTheme || '') ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white dark:bg-white/5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent dark:border-red-500/20'}`}
             >
                 <LogOut size={14} /> Sign Out
             </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
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
    </div>
  );
};

export default Layout;
