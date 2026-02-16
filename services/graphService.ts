
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
    async sendMail(params: { to: string; subject?: string; html?: string; siteId: string, invitedByName: string }) {
        try {
            console.log(`[DirectoryService] Initiating invite to "${params.to}"...`);
            console.log(`[DirectoryService] Context - Site: ${params.siteId}, Invited By: ${params.invitedByName}`);
            
            const start = Date.now();
            const { data, error } = await this.supabase.functions.invoke('send-invite-email', {
                body: { 
                    email: params.to,
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
        } catch (e) {
            console.error("[DirectoryService] Fatal Exception during sendMail:", e);
            throw e;
        }
    }
}
