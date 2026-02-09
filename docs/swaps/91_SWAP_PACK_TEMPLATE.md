# SWAP PACK TEMPLATE

> **Purpose**: Template for creating new module swap packs. Copy this file and fill in all sections.

---

## Instructions

1. Copy this template to the appropriate module directory
2. Rename with pattern: `XX_<TYPE>_MODULE_<PROVIDER>.md`
3. Fill in ALL sections below
4. Replace all `[FILL]` placeholders
5. Remove all instruction comments
6. Run verification checklist
7. Update 00_INDEX.md

---

# [TYPE] MODULE: [PROVIDER]

> **Module Type**: [auth|deploy|cicd|pwa]
> **Provider**: [PROVIDER_NAME]
> **Status**: [template|current|deprecated]

---

## Module Interface Contract

### Inputs (Operator-Provided)

| Input | Source | Required |
|-------|--------|----------|
| [FILL: Input name] | [FILL: Where to get] | [FILL: YES/NO] |
| [Add more rows as needed] | | |

### Outputs (Artifacts Produced)

| Output | Location | Format |
|--------|----------|--------|
| [FILL: Output name] | [FILL: Where produced] | [FILL: Format] |
| [Add more rows as needed] | | |

### Dependencies

| Module | Requirement |
|--------|-------------|
| [FILL: Module name] | [FILL: What is required] |
| [Add more rows as needed] | |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| [FILL: Variable name] | [FILL: YES/NO] | [FILL: Purpose] |
| [Add more rows as needed] | | |

### Required Ports

| Port | Purpose |
|------|---------|
| [FILL: Port number] | [FILL: Purpose] |

### Required Build Artifact Shape

| Path | Content |
|------|---------|
| [FILL: Path] | [FILL: Description] |
| [Add more rows as needed] | |

---

## Provider Configuration

### 1. [Configuration Area 1]

[FILL: Describe the first configuration step]

[REQUIRES-OPERATOR] [Describe what the operator must do/provide]

### 2. [Configuration Area 2]

[FILL: Describe the second configuration step]

[Add more sections as needed]

---

## [Provider-Specific Flow/Diagram]

```mermaid
sequenceDiagram
    [FILL: Create flow diagram if applicable]
```

OR

```
[FILL: ASCII diagram or description]
```

---

## Invariants

These MUST remain true for this module:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | [FILL: What must be true] | [FILL: How to verify] |
| 2 | [Add more rows] | |
| 3 | | |
| 4 | | |
| 5 | | |

---

## Failure Modes

| Error | Symptom | Fix |
|-------|---------|-----|
| [FILL: Error name] | [FILL: What user sees] | [FILL: How to fix] |
| [Add more rows] | | |

---

## Verification Checklist

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1 | [FILL: What to check] | [FILL: How] | [FILL: Expected result] |
| 2 | [Add more rows] | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |

---

## Operator Inputs Summary

| # | Input | Where to Get | Where to Apply |
|---|-------|--------------|----------------|
| 1 | [FILL: Input] | [FILL: Source] | [FILL: Destination] |
| 2 | [Add more rows] | | |

---

## Migration Notes (from previous module)

If replacing an existing module:

| Previous Setting | New Setting | Migration Steps |
|------------------|-------------|-----------------|
| [FILL: Old] | [FILL: New] | [FILL: Steps] |
| [Add more rows] | | |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | [FILL: Date] |
| Provider | [FILL: Provider name] |
| Replaces | [FILL: Previous module or N/A] |
| Author | [FILL: Author] |

---

## Checklist Before Submission

- [ ] All [FILL] placeholders completed
- [ ] All [REQUIRES-OPERATOR] items clearly documented
- [ ] Verification checklist tested
- [ ] Failure modes documented
- [ ] Dependencies identified
- [ ] 00_INDEX.md updated
- [ ] Previous module archived (if replacing)
