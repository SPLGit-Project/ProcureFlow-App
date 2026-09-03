import { supabase } from '../lib/supabaseClient';
import { EnhancedAppNotification } from '../types';

/**
 * Synthesizes a soft, premium notification chime using the Web Audio API.
 * No external mp3/wav files required, zero latency, works offline.
 */
export function playNotificationChime(type: 'subtle' | 'success' | 'alert' = 'subtle') {
    try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        if (type === 'success') {
            // Two-tone rising major third (E5 -> G#5)
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, now); // E5
            osc1.frequency.exponentialRampToValueAtTime(830.61, now + 0.12); // G#5

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1318.5, now); // Harmonic

            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.35);
            osc2.stop(now + 0.35);
        } else if (type === 'alert') {
            // Urgent attention chord
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); // A5
            osc.frequency.setValueAtTime(698.46, now + 0.08); // F5
            osc.frequency.setValueAtTime(880, now + 0.16); // A5

            gainNode.gain.setValueAtTime(0.12, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.4);
        } else {
            // Subtle sleek droplet chime
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.5, now); // C6
            osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.06); // E6

            gainNode.gain.setValueAtTime(0.06, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.28);
        }
    } catch {
        // AudioContext may be restricted by autoplay policy until user gesture
    }
}

export type NotificationChangeCallback = (notification: EnhancedAppNotification) => void;

/**
 * Manages the live Supabase Realtime subscription for incoming notifications.
 */
class RealtimeNotificationManager {
    private channel: ReturnType<typeof supabase.channel> | null = null;
    private callbacks: Set<NotificationChangeCallback> = new Set();
    private activeUserId: string | null = null;

    public subscribe(userId: string, onNewNotification?: NotificationChangeCallback) {
        if (onNewNotification) {
            this.callbacks.add(onNewNotification);
        }

        if (this.channel && this.activeUserId === userId) {
            return;
        }

        this.unsubscribe();
        this.activeUserId = userId;

        this.channel = supabase
            .channel(`user-notifications-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const notif = payload.new as EnhancedAppNotification;
                    // Play sound if not in silent mode
                    const severity = notif.severity;
                    if (severity === 'CRITICAL') {
                        playNotificationChime('alert');
                    } else if (severity === 'SUCCESS') {
                        playNotificationChime('success');
                    } else {
                        playNotificationChime('subtle');
                    }

                    this.callbacks.forEach(cb => cb(notif));
                }
            )
            .subscribe();
    }

    public addListener(callback: NotificationChangeCallback) {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    public emitLocalNotification(notif: EnhancedAppNotification) {
        const severity = notif.severity;
        if (severity === 'CRITICAL') {
            playNotificationChime('alert');
        } else if (severity === 'SUCCESS') {
            playNotificationChime('success');
        } else {
            playNotificationChime('subtle');
        }

        this.callbacks.forEach(cb => cb(notif));
    }

    public unsubscribe() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
            this.activeUserId = null;
        }
    }
}

export const realtimeNotificationService = new RealtimeNotificationManager();
