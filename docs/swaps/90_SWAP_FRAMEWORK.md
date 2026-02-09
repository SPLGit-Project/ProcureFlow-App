# SWAP FRAMEWORK

> **Purpose**: Define the process and contracts for swapping modules without modifying CORE documentation.

---

## 1. Module Interface Contracts

Every module MUST implement a standard interface contract. This section defines the contract schema.

### 1.1 Contract Schema

```yaml
module:
  name: <MODULE_NAME>
  type: <auth|deploy|cicd|pwa>
  provider: <PROVIDER_NAME>
  status: <current|template|deprecated>

inputs:
  operator_provided:
    - name: <INPUT_NAME>
      source: <WHERE_TO_GET>
      required: <true|false>
      format: <EXPECTED_FORMAT>

outputs:
  artifacts:
    - name: <OUTPUT_NAME>
      location: <WHERE_PRODUCED>
      format: <OUTPUT_FORMAT>

dependencies:
  modules:
    - name: <MODULE_NAME>
      requirement: <WHAT_IS_NEEDED>

environment:
  variables:
    - name: <VAR_NAME>
      required: <true|false>
      purpose: <DESCRIPTION>

ports:
  - port: <NUMBER>
    purpose: <DESCRIPTION>

build_artifacts:
  - path: <PATH>
    content: <DESCRIPTION>

invariants:
  - id: <NUMBER>
    statement: <WHAT_MUST_BE_TRUE>
    verification: <HOW_TO_CHECK>

failure_modes:
  - error: <ERROR_NAME>
    symptom: <WHAT_USER_SEES>
    fix: <HOW_TO_RESOLVE>

verification:
  - id: <NUMBER>
    check: <WHAT_TO_VERIFY>
    method: <HOW_TO_VERIFY>
    expected: <EXPECTED_RESULT>
```

---

## 2. Module Type Specifications

### 2.1 AUTH Module Interface

**Required Inputs:**
- OAuth provider credentials
- Redirect URLs

**Required Outputs:**
- Session token in localStorage
- User record in `users` table
- Auth state in AppContext

**Required Environment Variables:**
- Database connection credentials

**Invariants:**
- Session persists across page reload
- Domain restriction enforced
- User status flow (pending → approved)

### 2.2 DEPLOY Module Interface

**Required Inputs:**
- Deployment credentials/profile
- Startup command configuration

**Required Outputs:**
- Running application at HTTPS URL
- version.json accessible

**Required Ports:**
- Application port (default: 8080)

**Required Build Artifact Shape:**
- `dist/` directory with index.html
- `dist/version.json`
- `package.json` with start script

**Invariants:**
- SPA routing works (deep links resolve)
- HTTPS enforced
- Static files served correctly

### 2.3 CICD Module Interface

**Required Inputs:**
- Source repository access
- Environment secrets
- Deployment credentials

**Required Outputs:**
- Build artifact
- Triggered deployment

**Required Environment Variables:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Invariants:**
- Build uses Node 20.x
- Environment variables baked at build time
- Artifact includes dist/

### 2.4 PWA Module Interface

**Required Inputs:**
- App icons (multiple sizes)
- Theme colors

**Required Outputs:**
- Service worker at /sw.js
- Manifest at /manifest.json
- version.json in build

**Invariants:**
- SW registers on page load
- Cache versioned with build
- Offline fallback available

---

## 3. Swap Procedure

### Phase 1: Pre-Swap Audit

**Duration**: 15-30 minutes

| Step | Action | Deliverable |
|------|--------|-------------|
| 1.1 | Read CORE docs | Understand invariants |
| 1.2 | Read current module | Document current state |
| 1.3 | Read target module template | Identify gaps |
| 1.4 | Map dependencies | Dependency diagram |
| 1.5 | List affected URLs/configs | Change manifest |

**Checklist:**
- [ ] I understand all CORE invariants
- [ ] I have documented current module configuration
- [ ] I have identified all provider-specific settings
- [ ] I know which other modules depend on this one
- [ ] I have a rollback plan

### Phase 2: Install New Module

**Duration**: 30-60 minutes

| Step | Action | Deliverable |
|------|--------|-------------|
| 2.1 | Copy module template | New module file |
| 2.2 | Fill operator inputs | Configured module |
| 2.3 | Update environment variables | New secrets |
| 2.4 | Configure provider | Provider dashboard settings |
| 2.5 | Update code if needed | Code changes |

**Checklist:**
- [ ] Module file created from template
- [ ] All [REQUIRES-OPERATOR] items resolved
- [ ] Environment variables configured
- [ ] Provider-side configuration complete
- [ ] Code changes committed (if any)

### Phase 3: Integrate

**Duration**: 10-15 minutes

| Step | Action | Deliverable |
|------|--------|-------------|
| 3.1 | Update 00_INDEX.md | New module referenced |
| 3.2 | Update cross-links | Other modules link correctly |
| 3.3 | Archive old module | Rename with _DEPRECATED suffix |

**Checklist:**
- [ ] Index updated
- [ ] All internal links work
- [ ] Old module archived (not deleted)

### Phase 4: Module Verification Gates

**Duration**: 15-30 minutes

| Step | Action | Deliverable |
|------|--------|-------------|
| 4.1 | Run module verification checklist | All checks pass |
| 4.2 | Test module-specific features | Features work |
| 4.3 | Document any deviations | Updated docs |

**Checklist:**
- [ ] All module verification items pass
- [ ] Module-specific features tested
- [ ] Any exceptions documented

### Phase 5: System Verification Gates

**Duration**: 15-30 minutes

| Step | Action | Deliverable |
|------|--------|-------------|
| 5.1 | Run CORE verification gates | All 10 gates pass |
| 5.2 | Run no-regression checklist | No regressions |
| 5.3 | End-to-end smoke test | Full flow works |

**Checklist:**
- [ ] All 10 CORE gates pass
- [ ] No-regression checklist complete
- [ ] End-to-end flow verified

---

## 4. No-Regression Checklist

After any module swap, verify these CORE invariants still hold:

| # | Invariant | Check Method | Pass |
|---|-----------|--------------|------|
| 1 | Build produces dist/ | `ls dist/` | [ ] |
| 2 | version.json in dist/ | `ls dist/version.json` | [ ] |
| 3 | 16+ tables in database | SQL query | [ ] |
| 4 | RLS enabled on all tables | SQL query | [ ] |
| 5 | users.site_ids exists | SQL query | [ ] |
| 6 | Session in localStorage | Browser check | [ ] |
| 7 | SW registered at /sw.js | DevTools | [ ] |
| 8 | OAuth flow completes | Browser test | [ ] |
| 9 | Site filtering works | Browser test | [ ] |
| 10 | version.json accessible | curl test | [ ] |

---

## 5. Rollback Procedure

If swap fails:

| Step | Action |
|------|--------|
| 1 | Restore previous module file from archive |
| 2 | Revert environment variables |
| 3 | Revert provider configuration |
| 4 | Update 00_INDEX.md back |
| 5 | Run verification gates |
| 6 | Document failure for analysis |

---

## 6. Worked Example: Deployment Swap

### Scenario: Azure App Service → Generic Static Hosting + Node Server

#### Phase 1: Pre-Swap Audit

**Current Configuration:**
- Azure App Service with Node 20
- Startup: `npm start` → `serve -s dist -l 8080`
- Publish profile authentication

**Target Configuration:**
- Any hosting platform supporting Node.js
- Same startup command
- Different authentication method

**Dependencies:**
- CICD module must deploy to new target
- AUTH module redirect URLs must update

#### Phase 2: Create New Module

Create `30_DEPLOY_MODULE_GENERIC_STATIC.md`:

```markdown
# DEPLOY MODULE: Generic Static Hosting

## Provider Configuration

### Startup Command
\`\`\`bash
npm start
# Which runs: serve -s dist -l 8080
\`\`\`

### Required Environment
- Node 20.x runtime
- Port 8080 accessible

### package.json Requirements
Same as Azure module - `serve` in dependencies, `start` script defined.

### Authentication
[REQUIRES-OPERATOR: Configure hosting platform authentication]

### Redirect URLs
[REQUIRES-OPERATOR: Update Supabase Site URL to new domain]
[REQUIRES-OPERATOR: Update Azure Entra redirect URI if needed]
```

#### Phase 3: Update CICD Module

Modify workflow to deploy to new target instead of Azure.

#### Phase 4: Verify

Run module verification, then CORE verification gates.

---

## 7. Worked Example: Auth Swap

### Scenario: Supabase + Entra ID → Generic OAuth Provider

#### Phase 1: Pre-Swap Audit

**Current Configuration:**
- Supabase Auth with Azure OAuth
- Implicit flow
- @splservices.com.au domain restriction

**Target Configuration:**
- [REQUIRES-OPERATOR: Choose OAuth provider]
- Same flow requirements
- [REQUIRES-OPERATOR: Define domain restriction]

**Dependencies:**
- DEPLOY module redirect URLs unchanged (Supabase still in path)
- CICD module environment variables may change

#### Phase 2: Create New Module

Create `20_AUTH_MODULE_GENERIC_OAUTH.md`:

```markdown
# AUTH MODULE: Generic OAuth Provider

## Provider Configuration

### Supabase Client Configuration
Same as current - `flowType: 'implicit'`, etc.

### OAuth Provider
[REQUIRES-OPERATOR: Choose Supabase-supported provider]

Options:
- Google
- GitHub
- Discord
- Apple
- etc.

### Provider Dashboard Configuration
[REQUIRES-OPERATOR: Configure in Supabase Dashboard]

| Field | Value |
|-------|-------|
| Provider | [REQUIRES-OPERATOR] |
| Client ID | [REQUIRES-OPERATOR] |
| Client Secret | [REQUIRES-OPERATOR] |
| Redirect URL | `https://<supabase-ref>.supabase.co/auth/v1/callback` |

### Domain Restriction
[REQUIRES-OPERATOR: Update AppContext.tsx line ~506 with new domain]

### Scopes
[REQUIRES-OPERATOR: Determine required scopes for provider]
```

#### Phase 3: Update Code

```typescript
// AppContext.tsx - Update domain restriction
const DOMAIN_ALLOW = '[REQUIRES-OPERATOR: new-domain.com]';
if (!email?.toLowerCase().endsWith(DOMAIN_ALLOW)) {
  // ... restriction logic
}
```

#### Phase 4: Verify

Run AUTH module verification, then CORE verification gates.

---

## 8. Swap Documentation Requirements

When completing a swap, produce:

1. **New module document** following template
2. **Updated 00_INDEX.md** with new module reference
3. **Archived old module** with _DEPRECATED suffix
4. **Verification report** documenting all gate results
5. **Change log entry** in document metadata

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Purpose | Module swap procedures and contracts |
