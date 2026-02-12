
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
            console.log(`[DirectoryService] Sending invite to "${params.to}"...`);
            
            const { data, error } = await this.supabase.functions.invoke('send-invite-email', {
                body: { 
                    email: params.to,
                    site_id: params.siteId,
                    invited_by_name: params.invitedByName
                }
            });

            if (error) {
                console.error("[DirectoryService] Send Email Error:", error);
                throw error;
            }

            console.log("[DirectoryService] Email sent successfully.");
            return true;
        } catch (e) {
            console.error("[DirectoryService] Email Send Exception", e);
            throw e;
        }
    }
}
