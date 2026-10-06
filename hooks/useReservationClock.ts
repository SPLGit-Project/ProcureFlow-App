import { useEffect, useState } from 'react';

/** Advance countdowns and expire derived holds even when the user leaves a page idle. */
export function useReservationClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  return now;
}
