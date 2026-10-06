import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, Download, ExternalLink, FileText, Loader2, MapPin, Play, X } from 'lucide-react';
import { FEATURE_UPDATES } from '../constants/featureUpdates';
import { loadFeatureUpdateMedia, type FeatureUpdateMedia } from '../services/featureUpdateMedia';

interface Props {
  onClose: () => void;
  hiddenOnSignIn: boolean;
  onSavePreference: (hidden: boolean) => Promise<boolean>;
}

export default function FeatureUpdatesModal({ onClose, hiddenOnSignIn, onSavePreference }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const [format, setFormat] = useState<'video' | 'pdf'>('video');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [media, setMedia] = useState<FeatureUpdateMedia | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [retry, setRetry] = useState(0);
  const mediaRequests = useRef(new Map<string, Promise<FeatureUpdateMedia>>());
  const feature = FEATURE_UPDATES[selected];

  useEffect(() => {
    let active = true;
    setMedia(null);
    setLoadingError(false);
    let request = mediaRequests.current.get(feature.id);
    if (!request) {
      request = loadFeatureUpdateMedia(feature);
      mediaRequests.current.set(feature.id, request);
    }
    request.then(result => { if (active) setMedia(result); }).catch(() => {
      mediaRequests.current.delete(feature.id);
      if (active) setLoadingError(true);
    });
    return () => { active = false; };
  }, [feature.id, retry]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  async function changePreference() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await onSavePreference(!hiddenOnSignIn);
      if (!saved) throw new Error('Preference not saved');
      if (!hiddenOnSignIn) onClose();
    } catch {
      setError('Your preference could not be saved. Please try again.');
    } finally { setSaving(false); }
  }

  const linkClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600';

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="feature-updates-title" aria-describedby="feature-updates-description"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto w-[calc(100%-1rem)] max-w-6xl max-h-[94dvh] overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm">
      <div className="flex max-h-[94dvh] flex-col">
        <header className="shrink-0 bg-[#102630] px-4 py-5 text-white sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-300"><BookOpen size={16} /> ProcureFlow feature updates</div>
              <h2 id="feature-updates-title" className="text-2xl font-bold sm:text-3xl">What’s new in ProcureFlow</h2>
              <p id="feature-updates-description" className="mt-2 text-sm text-slate-300">Six updates. Clear guides. Short narrated videos. Explore here or download to keep.</p>
            </div>
            <button type="button" autoFocus onClick={onClose} aria-label="Close feature updates" className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><X size={22} /></button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto md:grid md:grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="Feature update guides" className="border-b border-slate-200 bg-slate-50 p-3 md:border-b-0 md:border-r">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Explore the updates</p>
            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
              {FEATURE_UPDATES.map((update, index) => (
                <button type="button" key={update.id} aria-current={selected === index ? 'true' : undefined}
                  onClick={() => { setSelected(index); setMediaError(false); }}
                  className={`flex min-w-[230px] items-start gap-3 rounded-xl p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 md:min-w-0 ${selected === index ? 'bg-[#102630] text-white shadow-md' : 'text-slate-700 hover:bg-slate-200/70'}`}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected === index ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white text-slate-500'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span><span className="block text-sm font-semibold leading-snug">{update.title}</span><span className={`mt-1 block text-xs ${selected === index ? 'text-slate-300' : 'text-slate-500'}`}>PDF guide · {update.duration} video</span></span>
                </button>
              ))}
            </div>
          </nav>

          <section aria-label={feature.title} className="min-w-0 p-4 sm:p-6">
            <h3 className="text-xl font-bold leading-tight">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
            <p className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-500"><MapPin size={14} className="shrink-0" /> Find it in: {feature.location}</p>

            <div className="my-4 flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label="View format" className="inline-flex rounded-xl bg-slate-100 p-1">
                <button type="button" aria-pressed={format === 'video'} onClick={() => { setFormat('video'); setMediaError(false); }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${format === 'video' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600'}`}><Play size={14} /> Watch video</button>
                <button type="button" aria-pressed={format === 'pdf'} onClick={() => setFormat('pdf')} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${format === 'pdf' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600'}`}><FileText size={14} /> Read PDF</button>
              </div>
              {media && <div className="flex flex-wrap gap-2">
                <a href={media.pdfDownload} download className={linkClass}><Download size={15} /> Download PDF</a>
                <a href={media.videoDownload} download className={linkClass}><Download size={15} /> Download video</a>
              </div>}
            </div>

            {!media ? (
              <div role="status" className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 px-4 text-center text-sm text-slate-600">
                {loadingError ? <><p>The guides could not load. Check your connection and try again.</p><button type="button" onClick={() => setRetry(value => value + 1)} className={linkClass}>Try again</button></> : <><Loader2 size={24} className="animate-spin text-cyan-600" /> Loading your guide…</>}
              </div>
            ) : format === 'video' ? (
              <div className="overflow-hidden rounded-xl bg-[#102630]">
                <video key={feature.id} controls playsInline preload="none" poster={media.poster}
                  aria-label={`${feature.title} explainer video`} onError={() => setMediaError(true)} className="aspect-video w-full">
                  <source src={media.video} type="video/mp4" />
                  Your browser cannot play this video. Use Download video below.
                </video>
              </div>
            ) : (
              <iframe key={feature.id} title={`${feature.title} PDF guide`} src={`${media.pdf}#view=FitH`} className="h-[min(48dvh,520px)] min-h-[250px] w-full rounded-xl border border-slate-200" />
            )}
            {mediaError && <p role="alert" className="mt-2 text-sm text-red-700">The video could not load. Try opening it in a new tab or download it below.</p>}
            <p className="mt-2 text-xs text-slate-500">{format === 'video' ? 'Narration and on-screen captions included. Press play when you’re ready.' : 'If the PDF preview is unavailable on your device, open it in a new tab or download the guide.'}</p>
            {media && <a href={format === 'video' ? media.video : media.pdf} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 hover:underline"><ExternalLink size={14} /> Open in new tab</a>}
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-7">
          <div>
            <button type="button" onClick={changePreference} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600">
              {saving ? <Loader2 size={15} className="animate-spin" /> : hiddenOnSignIn ? <Check size={15} /> : <X size={15} />}
              {saving ? 'Saving…' : hiddenOnSignIn ? 'Show this on sign-in again' : 'Don’t show this again'}
            </button>
            {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl bg-[#102630] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600">Close</button>
        </footer>
      </div>
    </dialog>, document.body
  );
}
