
/**
 * Normalizes an item code for consistent matching.
 * Rules:
 * 1. Trim whitespace.
 * 2. Convert to Uppercase.
 * 3. Remove spaces, hyphens, and underscores.
 * 4. Generate alternate form if applicable (starts with 'R' + alphanumeric remainder).
 */
export function normalizeItemCode(input: string): { normalized: string; alternate: string | null } {
    if (!input) return { normalized: '', alternate: null };

    // Base Normalization
    let normalized = input.trim().toUpperCase();
    normalized = normalized.replace(/[\s\-_]/g, '');

    if (!normalized) return { normalized: '', alternate: null };

    // Alternate Generation
    let alternate: string | null = null;

    // 1. Strip Leading 'R' (Existing Logic)
    if (normalized.startsWith('R') && normalized.length > 1) {
        const remainder = normalized.substring(1);
        if (/^[A-Z0-9]+$/.test(remainder)) {
            alternate = remainder;
        }
    }
    
    // 2. Fallback: If normalized differed from input (e.g. stripped chars), ensure it's available as alternate
    // This handles user request: "alt normalized... would also including removing any '-' or spaces"
    if (!alternate && normalized !== input.trim().toUpperCase()) {
         alternate = normalized;
    }

    return { normalized, alternate };
}
