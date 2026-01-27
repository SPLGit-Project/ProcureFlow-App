
import React from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';

const Login = () => {
  const { login, bypassAuth, isAuthenticated, branding, isLoadingAuth } = useApp();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center p-4">
       
       <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 w-full max-w-md animate-slide-up">
           <div className="flex flex-col items-center mb-8">
               {branding.logoUrl ? (
                   <img src={branding.logoUrl} alt="Logo" className="h-12 object-contain mb-4"/>
               ) : (
                   <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-brand)] to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg">
                       {branding.appName.charAt(0)}
                   </div>
               )}
               <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branding.appName}</h1>
               <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">Sign in to access your dashboard</p>
           </div>

           <div className="space-y-4">
               <button 
                onClick={login}
                disabled={isLoadingAuth}
                className="w-full flex items-center justify-center gap-3 bg-[#2f2f2f] hover:bg-[#1f1f1f] text-white p-3 rounded-none border border-transparent transition-all shadow-md group relative overflow-hidden"
               >
                   {/* Microsoft Logo SVG */}
                   <svg className="w-5 h-5" viewBox="0 0 21 21">
                       <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                       <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                       <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                       <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                   </svg>
                   <span className="font-semibold text-sm sm:text-base">Sign in with Microsoft</span>
                   {isLoadingAuth && (
                       <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       </div>
                   )}
               </button>

               <div className="flex items-center gap-2 justify-center mt-6 text-xs text-gray-400">
                   <Shield size={12}/>
                   <span>Secure Azure AD Authentication</span>
               </div>
           </div>

           <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
               <p className="text-xs text-gray-400 mb-4">
                   Restricted to authorized personnel only. 
               </p>
           </div>
       </div>
    </div>
  );
};

export default Login;
