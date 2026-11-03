import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
  return { hash, size: content.length };
}

const files = [
  // Candidate V1
  'candidates/candidate-v1/SiteApprovalWorkflowManager.tsx',
  'candidates/candidate-v1/siteApprovalWorkflowService.ts',
  'candidates/candidate-v1/site-approval-workflows.test.mjs',
  'candidates/candidate-v1/site-approval-workflows.spec.ts',

  // Candidate V2
  'candidates/candidate-v2/SiteApprovalWorkflowManager.tsx',
  'candidates/candidate-v2/siteApprovalWorkflowService.ts',
  'candidates/candidate-v2/siteApprovalIntegrationService.ts',
  'candidates/candidate-v2/20261030000000_site_approval_workflows_v2.sql',
  'candidates/candidate-v2/site-approval-workflows.test.mjs',
  'candidates/candidate-v2/site-approval-integration.test.mjs',
  'candidates/candidate-v2/site-approval-workflows.spec.ts',

  // Patches
  'candidates/patches/concurrent_stock_ingestion_baseline.patch',
  'candidates/patches/site_approval_workflow_additive.patch',
  'candidates/patches/app_context_combined.patch',
  'candidates/patches/all_tracked_modifications.patch',

  // Active modified tracked files
  'App.tsx',
  'components/WorkflowNotificationHub.tsx',
  'context/AppContext.tsx',
  'vite.config.ts',
  'public/version.json',

  // Concurrent baseline dirty files
  'scripts/test_stock_accuracy.mjs',
  'utils/fileParser.ts'
];

console.log('| File Path | Size (Bytes) | SHA256 Pin |');
console.log('| :--- | :--- | :--- |');

for (const relPath of files) {
  const info = getFileHash(relPath);
  if (info) {
    console.log(`| \`${relPath}\` | ${info.size} | \`${info.hash}\` |`);
  } else {
    console.log(`| \`${relPath}\` | MISSING | MISSING |`);
  }
}
