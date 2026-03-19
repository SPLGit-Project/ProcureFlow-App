import { useState, useCallback } from 'react';

/**
 * useSubmitGuard — prevents double-tap/double-click on async form submissions.
 *
 * Fix M4: Touch interfaces can fire two submit events within ~300ms.
 * This hook gates calls to an async function so the second call is dropped
 * if the first is still in flight.
 *
 * Usage:
 *   const { isSubmitting, guardedSubmit } = useSubmitGuard();
 *
 *   <button
 *       onClick={() => guardedSubmit(handleSubmit)}
 *       disabled={isSubmitting}
 *   >
 *       {isSubmitting ? 'Saving...' : 'Submit'}
 *   </button>
 */
export function useSubmitGuard() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const guardedSubmit = useCallback(
        async (fn: () => void | Promise<void>) => {
            if (isSubmitting) return; // Drop concurrent/double-tap calls
            setIsSubmitting(true);
            try {
                await fn();
            } finally {
                setIsSubmitting(false);
            }
        },
        [isSubmitting]
    );

    return { isSubmitting, guardedSubmit };
}
