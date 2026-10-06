// Publish the reviewed release to private Storage. Never print credentials or signed URLs.
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Publishing requires Supabase URL and service-role credentials in the local environment.');
const root = resolve('Resources/feature-updates/2026-10-06');
const manifest = JSON.parse(await readFile(resolve(root, 'media-manifest.json'), 'utf8'));
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = client.storage.from('feature-updates');
for (const asset of manifest.files) {
  const body = await readFile(resolve(root, asset.file));
  if (createHash('sha256').update(body).digest('hex') !== asset.sha256) throw new Error(`Hash mismatch: ${asset.file}`);
  const contentType = asset.file.endsWith('.pdf') ? 'application/pdf' : asset.file.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
  const { error } = await bucket.upload(`2026-10-06/${asset.file}`, body, { contentType, upsert: true, cacheControl: '3600' });
  if (error) throw new Error(`Upload failed: ${asset.file}: ${error.message}`);
  const { data, error: verifyError } = await bucket.download(`2026-10-06/${asset.file}`);
  if (verifyError || createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex') !== asset.sha256) throw new Error(`Remote verification failed: ${asset.file}`);
  console.log(`Verified private media: ${asset.file}`);
}
console.log(`${manifest.files.length} private media objects uploaded and verified.`);
