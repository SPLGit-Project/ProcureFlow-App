---
name: procureflow-feature-update
description: Create or refresh ProcureFlow feature update PDFs, editable Word guides, narrated videos, captions and popup media packages in the established six-release style. Use when preparing user training, launch materials or consistent feature update documents and videos for ProcureFlow.
---

# Procureflow-feature update

Produce a complete, checked release package. Match the October 2026 six-update series and update 07; reuse the template and approved synthetic presenter bundled here. Do not silently activate a held feature.

## Establish the feature and release state

1. Read repository AGENTS.md, Git status, current branch and relevant PR. Preserve unrelated work. Confirm the requested feature against implementation and tests, including saved data, supplier configuration, downstream screens, finance/exports, exceptions and legacy records.
2. Record source commit, feature identifier, audience, release number and HELD or RELEASED state. Inspect `constants/featureUpdates.ts`, `services/featureUpdateMedia.ts`, `Resources/feature-updates/` and the existing release publisher before choosing filenames or popup metadata.
3. Treat “same as the previous updates” as a concrete style request. Read [style-reference.md](references/style-reference.md). Use the bundled `assets/guide-template.docx`; retain its page furniture, styles, badges, bookmarks and fields. Adapt the topic, not the evidence.
4. Keep future-date or held releases on their feature branch. Creating assets does not authorise merging, deployment, production uploads or notifying users.

## Capture evidence and write the story

- Use actual app components through the available browser controls. Prefer a local branch fixture with illustrative data for an unreleased feature. Never draw an imitation app screenshot or change pixels to imply a behaviour.
- Capture the starting point, successful action, changed result, blocking case, saved details and downstream workflow. Do not write live records solely for a screenshot.
- Observe the settled visual state after each action. Keep controls, quantities, messages and totals visible. Browser clip coordinates may be document-relative: use DOM bounds plus scroll offset. If a clipped capture alters animation or layout, capture the stable viewport and crop its margins without changing content. Retain original captures and crop provenance.
- Explain what changed, where users find it and how to use it, using the app's real labels. Separate requested quantities, pack counts, prices and actual receipts. Illustrative examples must match the screens and arithmetic.
- Prepare a storyboard of approximately eight scenes, one action per scene, with `title`, `note`, `image` and `narration`. Usually aim for 90–120 seconds. Verify facts before generating speech.

## Build and verify the guide

Use the documents and PDF skills for production and visual inspection. See [media-pipeline.md](references/media-pipeline.md).

- Copy the template; never overwrite the reference. Map text slots by expected source text and paragraph index. Inventory drawing slots by ancestor paragraph, surrounding text and size: most drawings are numbered badges, not screenshots.
- The seven-page template's screenshot drawing indices are **3, 4, 10, 11 and 16**, zero-based. Preserve badge slots including 22. Replace images with separate relationship IDs so reused source media is not overwritten.
- Use `scripts/build_guide.py --root PACKAGE --contract CONTRACT --output-name NAME.docx`. The contract specifies the template, SHA-256, title, expected/replacement text slots and screenshot bounds. A worked contract is in the repository at `docs/feature-updates/supplier-pack-quantities/source/template-contract.json`.
- Refresh Word fields, repaginate and export a PDF. Use the bundled renderer when available; on this Windows host, hidden Word COM is a verified fallback. Export to a fresh temporary PDF before replacing the final PDF.
- Render and inspect **every page**. Check page count, page numbers, navigation, no stale topic text/images, readable screenshots, correct totals and no overflow. Preserve editable DOCX and final PDF together.

## Narrate and compose the video

- Use the approved synthetic Australian reference `assets/approved-presenter.wav` and its text in `assets/presenter-config.json`. This voice was already used for the six prior explainers. Do not substitute a new voice without an explicit user preference or explaining an actual availability issue.
- Reuse the local Qwen pipeline described in [media-pipeline.md](references/media-pipeline.md). Generate natural English narration; preserve pronunciation of Procure Flow, Concur and quantities. No speed-up to force a duration.
- Align speech with word timestamps, review recognised differences and regenerate meaningful omissions or incorrect numbers. High ASR agreement alone is not an auditory review.
- Compose 1920 × 1080 scenes using the real screenshots, navy/cyan style, restrained movement and space for captions. Preserve aspect ratios. Include burned-in captions, separate SRT, transcript and poster.
- Run complete decode, duration, dimensions, FPS, loudness, peak, caption completeness and timing checks. Inspect frames from **every scene**, including caption-heavy frames. Listen to narration where audio playback is available; report the actual extent of checks.

## Package and release

1. Deliver PDF, DOCX, MP4, JPG poster, SRT, transcript and a ZIP. Keep scripts/storyboard/source captures and QA results reproducible, but exclude intermediate video segments, models, environments and build caches from Git.
2. Create a manifest with source app commit, release state, template/voice provenance, SHA-256, byte counts, measured duration, guide pages, visual QA and remaining launch steps. Run `scripts/verify_package.py --root PACKAGE`.
3. For HELD releases, stage app resources in their own feature folder and a separate `feature-entry.json`. Leave the current popup registry and production storage unchanged. Record launch-only steps, including replacing pre-release availability wording, migrations, data readiness, media upload verification and signed playback.
4. For an authorised release, follow the Supabase skill and existing private-media pipeline. Verify signed PDF/video/poster access as a normal user, popup visibility/dismissal and in-app replay. Existing scripts may hardcode a release date; inspect and update deliberately rather than uploading to the wrong folder.
5. Commit scoped changes on the requested branch. Keep a draft PR draft when launch is held. Follow AGENTS.md for significant-work logging through the live SPL Portfolio Tracker, then verify the applied entry.
6. Return concise links to the finished package and skill, state the release status and actual checks. Do not describe assets as published merely because they were generated.
