
import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { consumeSessionLogoutNotice } from '../utils/sessionState.ts';
import mercerFlowLogo from '../docs/Logo Branding/APP-LOGOS/MercerFlow-Logo.png';

const Login = () => {
  const { login, isAuthenticated, branding, isLoadingAuth } = useApp();
  const navigate = useNavigate();
  const [logoutNotice] = React.useState(() => consumeSessionLogoutNotice());

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center p-4">
       
       <div className="bg-white dark:bg-[#171315] rounded-2xl shadow-xl border border-gray-200 dark:border-[#171315] p-8 w-full max-w-md animate-slide-up">
           <div className="flex flex-col items-center mb-8">
               <div className="mb-5 flex w-full justify-center">
                   <img
                       src={mercerFlowLogo}
                       alt="MercerFlow logo"
                       className="w-full max-w-[260px] rounded-xl border border-white/5 object-contain shadow-[0_18px_50px_rgba(0,0,0,0.22)] dark:border-transparent dark:shadow-none sm:max-w-[300px]"
                   />
               </div>
               <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">Sign in to access your dashboard</p>
           </div>

           {logoutNotice?.reason === 'idle' && (
               <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                   Your session was signed out after 30 minutes of inactivity. Eligible drafts are still available after you sign back in.
               </div>
           )}

           <div className="space-y-4">
               <button 
                type="button"
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
