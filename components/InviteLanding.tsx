import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

const InviteLanding = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    
    const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
    const [message, setMessage] = useState('Verifying your invitation...');
    const [orgName, setOrgName] = useState('ProcureFlow'); // Default, could fetch branding

    useEffect(() => {
        if (!token) {
            setStatus('ERROR');
            setMessage('Invalid invitation link. No token provided.');
            return;
        }

        const acceptInvite = async () => {
            try {
                // 1. Check if user is already logged in?
                // The RPC links the *current* auth user to the invite.
                // So the user MUST be logged in first?
                // OR does the invite link create a session? 
                // Typically invite links in this architecture (Magic Link or OTP) log the user in.
                // BUT my 'accept_invite' RPC uses `auth.uid()`.
                // So the user must be authenticated.
                
                // If not authenticated, we should probably redirect to Login?
                // But Login needs to know it's an invite flow to return here?
                // The current Login flow uses Azure AD.
                
                const { data: { session } } = await supabase.auth.getSession();
                
                if (!session) {
                    // Redirect to login, preserving the invite destination
                    // When they come back, they should hit /invite?token=... again?
                    // Or we can pass it as state.
                    setStatus('ERROR');
                    setMessage('Please sign in to accept this invitation.');
                    // In a real flow, we'd auto-redirect to login with returnTo=/invite?token=...
                    // But simpler to show a button.
                    return;
                }

                const { data, error } = await supabase.rpc('accept_invite', { p_token: token });

                if (error) {
                    throw error;
                }

                if (data && data.success) {
                    setStatus('SUCCESS');
                    setMessage('Invitation accepted successfully! You now have access.');
                    // Fetch branding or context if returned? data might have site info.
                    if (data.site_name) setOrgName(data.site_name);
                    
                    // Auto-redirect after delay
                    setTimeout(() => {
                       window.location.href = '/';
                    }, 2000);
                } else {
                    setStatus('ERROR');
                    setMessage(data?.message || 'Failed to accept invitation.');
                }

            } catch (err: any) {
                console.error("Invite Error:", err);
                setStatus('ERROR');
                setMessage(err.message || 'An unexpected error occurred.');
            }
        };

        acceptInvite();
    }, [token]);

    const handleLoginRedirect = () => {
         // Redirect to login with return URL
         // Note: Our Login component uses MSAL/Supabase generic login.
         // We might need to store the return URL in local storage or use query param?
         // For now, simpler: Just go to login. User has to click link again? 
         // That's bad UX.
         // Standard Pattern: Store 'pending_invite_token' in localStorage before login.
         if (token) {
             localStorage.setItem('pending_invite_token', token);
         }
         navigate('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#15171e] p-4">
            <div className="bg-white dark:bg-[#1e2029] w-full max-w-md p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 text-center animate-fade-in">
                
                <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                        {status === 'LOADING' && <Loader2 className="animate-spin text-[var(--color-brand)]" size={32} />}
                        {status === 'SUCCESS' && <CheckCircle className="text-green-500" size={32} />}
                        {status === 'ERROR' && <XCircle className="text-red-500" size={32} />}
                    </div>
                </div>

                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                    {status === 'LOADING' ? 'Verifying Invite...' : 
                     status === 'SUCCESS' ? 'Welcome Aboard!' : 
                     'Invitation Error'}
                </h1>
                
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                    {message}
                </p>

                {status === 'ERROR' && message.includes('sign in') && (
                    <button 
                        onClick={handleLoginRedirect}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                    >
                        Sign In / Sign Up <ArrowRight size={16} />
                    </button>
                )}

                {status === 'SUCCESS' && (
                    <button 
                        onClick={() => window.location.href = '/'}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700"
                    >
                        Continue to Dashboard
                    </button>
                )}
                
                 {status === 'ERROR' && !message.includes('sign in') && (
                    <button 
                        onClick={() => navigate('/')}
                        className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Return Home
                    </button>
                )}

            </div>
        </div>
    );
};

export default InviteLanding;
