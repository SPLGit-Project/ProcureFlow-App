
/**
 * GraphService handles delegated Microsoft Graph API calls using the provider_token
 * retrieved from the Supabase session.
 */
export class GraphService {
    private token: string;
    private abortController: AbortController | null = null;

    constructor(token: string) {
        this.token = token;
    }

    /**
     * Search the directory for users by name or email.
     * Uses the advanced $search query with ConsistencyLevel: eventual.
     */
    async searchDirectory(query: string, limit: number = 8) {
        // Abort previous search if still pending
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        const escapedQuery = query.replace(/"/g, '\\"');
        // Quoted search expression for robustness
        const searchExpr = `"displayName:${escapedQuery}" OR "mail:${escapedQuery}"`;
        const url = `https://graph.microsoft.com/v1.0/users?$search=${encodeURIComponent(searchExpr)}&$select=id,displayName,mail,jobTitle,department,officeLocation&$top=${limit}`;

        try {
            console.log(`Graph: Searching directory for "${query}" (limit: ${limit})...`);
            const resp = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    ConsistencyLevel: 'eventual'
                },
                signal: this.abortController.signal
            });

            if (resp.ok) {
                const data = await resp.json();
                console.log(`Graph: Search successful, found ${data.value?.length || 0} results.`);
                return data.value.map((u: any) => ({
                    id: u.id,
                    name: u.displayName,
                    email: u.mail,
                    jobTitle: u.jobTitle,
                    department: u.department || u.officeLocation
                }));
            }

            // Handle specific status codes
            const errorBody = await resp.json().catch(() => ({}));
            console.error(`Graph: Search failed [${resp.status}]`, JSON.stringify(errorBody, null, 2));

            if (resp.status === 400) {
                console.warn("Graph: Invalid search syntax or parameters (400).");
            } else if (resp.status === 401) {
                console.warn("Graph: Token expired or unauthorized (401). Triggering logic for re-auth...");
                throw new Error("GRAPH_UNAUTHORIZED");
            }

            return [];
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log("Graph: Search aborted due to new request.");
                return null; // Signals aborted
            }
            console.error("Graph: Directory Search Error", e);
            throw e;
        }
    }

    /**
     * Send an email using the /me/sendMail endpoint.
     */
    async sendMail(params: { to: string; subject: string; html: string }) {
        const url = 'https://graph.microsoft.com/v1.0/me/sendMail';
        const body = {
            message: {
                subject: params.subject,
                body: {
                    contentType: 'HTML',
                    content: params.html
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: params.to
                        }
                    }
                ]
            },
            saveToSentItems: 'true'
        };

        try {
            console.log(`Graph: Sending email to "${params.to}" with subject "${params.subject}"...`);
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (resp.ok) {
                console.log("Graph: Email sent successfully.");
                return true;
            }

            const errorBody = await resp.json().catch(() => ({}));
            console.error(`Graph: SendMail failed [${resp.status}]`, JSON.stringify(errorBody, null, 2));

            if (resp.status === 401) {
                throw new Error("GRAPH_UNAUTHORIZED");
            }

            return false;
        } catch (e) {
            console.error("Graph: Email Send Error", e);
            throw e;
        }
    }
}
