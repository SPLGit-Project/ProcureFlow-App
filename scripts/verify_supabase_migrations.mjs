import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function migrationHash(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

export function verifyMigrationHistory(history, files) {
  if (history.projectRef !== 'yasosgkznoxamysutxfc' || !/^\d{14}$/.test(history.latestVersion)) {
    throw new Error('Invalid production migration baseline');
  }
  const baseline = new Map();
  for (const entry of history.migrations) {
    if (!new RegExp(`^${entry.version}_.+\\.sql$`).test(entry.file) || !/^\d{14}$/.test(entry.version)
      || !/^[a-f0-9]{64}$/.test(entry.sha256) || baseline.has(entry.version) || entry.version > history.latestVersion) {
      throw new Error(`Invalid baseline entry: ${entry.file}`);
    }
    baseline.set(entry.version, entry);
  }
  if (!baseline.has(history.latestVersion)) throw new Error('Baseline cutoff is missing');
  const versions = new Set();
  for (const [file, sql] of files) {
    const match = /^(\d{14})_.+\.sql$/.exec(file);
    if (!match) throw new Error(`Invalid migration filename: ${file}`);
    const version = match[1];
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`);
    versions.add(version);
    const entry = baseline.get(version);
    if (entry && (entry.file !== file || entry.sha256 !== migrationHash(sql))) {
      throw new Error(`Applied migration changed: ${file}. Create a new migration instead.`);
    }
    if (!entry && version <= history.latestVersion) {
      throw new Error(`Unrecorded historical migration: ${file}. Review against production before deploying.`);
    }
  }
  for (const entry of baseline.values()) {
    if (!versions.has(entry.version)) throw new Error(`Recorded production migration missing: ${entry.file}`);
  }
  return { recorded: baseline.size, pending: files.size - baseline.size };
}

export async function verifyRepository(root = new URL('../', import.meta.url)) {
  const directory = new URL('supabase/migrations/', root);
  const history = JSON.parse(await readFile(new URL('supabase/migration-history.json', root), 'utf8'));
  const names = (await readdir(directory)).filter(file => file.endsWith('.sql'));
  const files = new Map(await Promise.all(names.map(async file => [file, await readFile(new URL(file, directory), 'utf8')])));
  return verifyMigrationHistory(history, files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyRepository();
  console.log(`Verified ${result.recorded} recorded production migrations; ${result.pending} new migrations after the baseline.`);
}
