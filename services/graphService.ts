
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * DirectoryService handles directory search and email via Supabase Edge Functions.
 * Replaces the legacy GraphService.
 */
export class DirectoryService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Search the directory using the 'directory-suggest' Edge Function.
     */
    async searchDirectory(query: string, siteId: string) {
        if (!query || query.length < 2) return [];

        try {
            console.log(`[DirectoryService] Searching: "${query}" for Site: ${siteId}`);
            
            const { data, error } = await this.supabase.functions.invoke('directory-suggest', {
                body: { query, site_id: siteId }
            });

            if (error) {
                console.error("[DirectoryService] Edge Function Error:", error);
                throw error;
            }

            console.log(`[DirectoryService] Found ${data?.length || 0} results.`);
            return data || [];
        } catch (e) {
            console.error("[DirectoryService] Search failed", e);
            return [];
        }
    }

    /**
     * Send an invite email using the 'send-invite-email' Edge Function.
     */
    async sendMail(params: { to: string; from: string; subject?: string; html?: string; siteId: string, invitedByName: string }) {
        try {
            console.log(`[DirectoryService] Initiating invite to "${params.to}" from "${params.from}"...`);
            console.log(`[DirectoryService] Context - Site: ${params.siteId}, Invited By: ${params.invitedByName}`);
            
            const start = Date.now();
            const { data, error } = await this.supabase.functions.invoke('send-invite-email', {
                body: { 
                    email: params.to,
                    from_email: params.from,
                    site_id: params.siteId,
                    invited_by_name: params.invitedByName,
                    subject: params.subject,
                    html: params.html
                }
            });

            if (error) {
                console.error("[DirectoryService] Edge Function Invocation Failed:", error);
                // Check for 404 (Function missing) or 401 (Unauthorized)
                throw error;
            }

            console.log(`[DirectoryService] Invite API Success in ${Date.now() - start}ms:`, data);
            return true;
        } catch (e: any) {
            console.error("[DirectoryService] Edge function invoke failed:", e);
            
            // FALLBACK: Try direct fetch if library invoke fails (e.g. version mismatch or weird error)
            try {
                console.warn("[DirectoryService] Attempting direct fetch fallback...");
                const sbUrl = (this.supabase as any).supabaseUrl || (this.supabase as any).rest?.url?.replace('/rest/v1', '');
                const sbKey = (this.supabase as any).supabaseKey || (this.supabase as any).headers?.['apikey'];
                
                if (sbUrl && sbKey) {
                    const funcUrl = `${sbUrl}/functions/v1/send-invite-email`;
                    const session = await this.supabase.auth.getSession();
                    const token = session.data.session?.access_token;
                    
                    const resp = await fetch(funcUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token || sbKey}`,
                            'apikey': sbKey
                        },
                        body: JSON.stringify({ 
                            email: params.to,
                            from_email: params.from,
                            site_id: params.siteId,
                            invited_by_name: params.invitedByName,
                            subject: params.subject,
                            html: params.html
                        })
                    });
                    
                    if (!resp.ok) {
                        const txt = await resp.text();
                        throw new Error(`Fallback fetch failed: ${resp.status} ${txt}`);
                    }
                    
                    const data = await resp.json();
                    console.log("[DirectoryService] Fallback success:", data);
                    return true;
                }
            } catch (fallbackError) {
                console.error("[DirectoryService] Fallback also failed:", fallbackError);
            }

            console.error("[DirectoryService] Fatal Exception during sendMail:", e);
            throw e;
        }
    }
}
