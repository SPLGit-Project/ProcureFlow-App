# CICD MODULE: Template

> **Module Type**: CI/CD Pipeline
> **Provider**: [REQUIRES-OPERATOR: Choose CI/CD platform]
> **Status**: TEMPLATE

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| VITE_SUPABASE_URL | Supabase Dashboard | YES |
| VITE_SUPABASE_ANON_KEY | Supabase Dashboard | YES |
| Deployment Credentials | [REQUIRES-OPERATOR: Hosting platform] | YES |
| Repository Access | [REQUIRES-OPERATOR: Source control] | YES |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| Build Artifact | [REQUIRES-OPERATOR: CI/CD artifact store] | Directory |
| Deployed Application | [REQUIRES-OPERATOR: Hosting platform] | Running app |

### Dependencies

| Module | Requirement |
|--------|-------------|
| AUTH | Environment variables for Supabase |
| DEPLOY | Deployment credentials configured |

### Required Build Artifact Shape

| Path | Content |
|------|---------|
| `dist/` | Vite production build |
| `dist/index.html` | SPA entry |
| `dist/version.json` | Version metadata |

---

## Provider Options

### Supported CI/CD Platforms

| Platform | Configuration File | Notes |
|----------|-------------------|-------|
| GitHub Actions | `.github/workflows/*.yml` | Current production |
| GitLab CI | `.gitlab-ci.yml` | GitLab-hosted or self-hosted |
| Azure DevOps | `azure-pipelines.yml` | Azure ecosystem |
| CircleCI | `.circleci/config.yml` | Cloud-native CI |
| Jenkins | `Jenkinsfile` | Self-hosted |
| Bitbucket Pipelines | `bitbucket-pipelines.yml` | Atlassian ecosystem |
| AWS CodePipeline | CloudFormation/CDK | AWS ecosystem |
| Google Cloud Build | `cloudbuild.yaml` | GCP ecosystem |

---

## Pipeline Requirements

### Required Steps

Every CI/CD pipeline MUST implement:

| Step | Purpose | Command |
|------|---------|---------|
| Checkout | Get source code | Platform-specific |
| Setup Node | Configure runtime | Node 20.x |
| Install | Install dependencies | `npm install` or `npm ci` |
| Build | Compile application | `npm run build` |
| Upload | Store artifact | Platform-specific |
| Deploy | Push to hosting | Platform-specific |

### Environment Variables

Inject at build time:

```
VITE_SUPABASE_URL=[REQUIRES-OPERATOR]
VITE_SUPABASE_ANON_KEY=[REQUIRES-OPERATOR]
```

**CRITICAL**: Variables are baked into bundle at build time.

---

## Generic Pipeline Template

```yaml
# Pseudo-YAML - adapt to your platform

name: Build and Deploy

trigger:
  - main

jobs:
  build:
    runs-on: [REQUIRES-OPERATOR: runner type]
    steps:
      - checkout: [REQUIRES-OPERATOR: checkout action]
      
      - setup-node:
          version: '20.x'
          cache: 'npm'
      
      - install:
          run: npm install
          # Or: npm ci for deterministic builds
      
      - build:
          run: npm run build
          env:
            VITE_SUPABASE_URL: [REQUIRES-OPERATOR: secret reference]
            VITE_SUPABASE_ANON_KEY: [REQUIRES-OPERATOR: secret reference]
      
      - upload-artifact:
          name: build-output
          path: [REQUIRES-OPERATOR: artifact path]
  
  deploy:
    needs: build
    runs-on: [REQUIRES-OPERATOR: runner type]
    steps:
      - download-artifact:
          name: build-output
      
      - deploy:
          [REQUIRES-OPERATOR: deployment action/script]
```

---

## Platform-Specific Examples

### GitLab CI

```yaml
stages:
  - build
  - deploy

build:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
  only:
    - main

deploy:
  stage: deploy
  dependencies:
    - build
  script:
    - [REQUIRES-OPERATOR: deployment command]
  only:
    - main
```

### Azure DevOps

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  
  - script: npm ci
    displayName: 'Install dependencies'
  
  - script: npm run build
    displayName: 'Build'
    env:
      VITE_SUPABASE_URL: $(VITE_SUPABASE_URL)
      VITE_SUPABASE_ANON_KEY: $(VITE_SUPABASE_ANON_KEY)
  
  - [REQUIRES-OPERATOR: deployment task]
```

---

## Secrets Configuration

### Where to Store

| Platform | Location |
|----------|----------|
| GitHub Actions | Settings → Secrets → Actions |
| GitLab CI | Settings → CI/CD → Variables |
| Azure DevOps | Pipelines → Library → Variable groups |
| CircleCI | Project Settings → Environment Variables |
| Bitbucket | Repository settings → Pipelines → Variables |

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `VITE_SUPABASE_URL` | Database endpoint |
| `VITE_SUPABASE_ANON_KEY` | Database public key |
| [REQUIRES-OPERATOR: Deploy secret] | Hosting authentication |

---

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Node 20.x used | Check pipeline config |
| 2 | Build env vars injected | Check secrets in pipeline |
| 3 | Artifact includes dist/ | Inspect uploaded artifact |
| 4 | Build on main trigger | Push triggers build |
| 5 | Deploy after successful build | Check job dependencies |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| Build fails | Red status | Check build logs |
| Secret not found | Error in logs | Verify secret names |
| Node version wrong | Install errors | Check version config |
| Artifact missing | Deploy fails | Check artifact paths |
| Trigger not working | No pipeline run | Check trigger config |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | Pipeline file exists | View repository | Config file present |
| 2 | Secrets configured | Platform settings | All secrets present |
| 3 | Push triggers build | Push to main | Pipeline runs |
| 4 | Build succeeds | Pipeline UI | Green status |
| 5 | Deploy succeeds | Pipeline UI | Green status |
| 6 | App accessible | Browser | Login page loads |
| 7 | version.json matches | Compare hashes | Build = deployed |

---

## Operator Inputs Summary

| # | Input | Where to Get | Where to Apply |
|---|-------|--------------|----------------|
| 1 | VITE_SUPABASE_URL | Supabase Dashboard | CI/CD secrets |
| 2 | VITE_SUPABASE_ANON_KEY | Supabase Dashboard | CI/CD secrets |
| 3 | Deploy Credentials | Hosting platform | CI/CD secrets |
| 4 | Runner Type | Platform docs | Pipeline config |

---

## Migration from GitHub Actions

If migrating from GitHub Actions:

| GitHub Actions | New Platform |
|----------------|--------------|
| `ubuntu-latest` | [REQUIRES-OPERATOR: Equivalent runner] |
| `actions/checkout@v4` | [REQUIRES-OPERATOR: Checkout method] |
| `actions/setup-node@v4` | [REQUIRES-OPERATOR: Node setup] |
| `actions/upload-artifact@v4` | [REQUIRES-OPERATOR: Artifact upload] |
| `azure/webapps-deploy@v3` | [REQUIRES-OPERATOR: Deploy action] |
| Repository Secrets | [REQUIRES-OPERATOR: Secret storage] |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Status | TEMPLATE |
| Based On | 40_CICD_MODULE_GITHUB_ACTIONS_CURRENT.md |
