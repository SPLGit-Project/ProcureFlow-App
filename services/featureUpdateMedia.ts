import { supabase } from '../lib/supabaseClient';
import type { FeatureUpdate } from '../constants/featureUpdates';

export interface FeatureUpdateMedia {
  pdf: string;
  video: string;
  poster: string;
  pdfDownload: string;
  videoDownload: string;
}

export async function loadFeatureUpdateMedia(feature: FeatureUpdate): Promise<FeatureUpdateMedia> {
  const paths = [feature.pdf, feature.video, feature.poster].map(path => path.replace(/^\/feature-updates\//, ''));
  const bucket = supabase.storage.from('feature-updates');
  const [view, download] = await Promise.all([
    bucket.createSignedUrls(paths, 3600),
    bucket.createSignedUrls(paths.slice(0, 2), 3600, { download: true }),
  ]);
  if (view.error || download.error || view.data?.some(item => item.error || !item.signedUrl) || download.data?.some(item => item.error || !item.signedUrl) || view.data?.length !== 3 || download.data?.length !== 2) {
    throw new Error('Feature update media is unavailable');
  }
  return { pdf: view.data[0].signedUrl, video: view.data[1].signedUrl, poster: view.data[2].signedUrl, pdfDownload: download.data[0].signedUrl, videoDownload: download.data[1].signedUrl };
}
