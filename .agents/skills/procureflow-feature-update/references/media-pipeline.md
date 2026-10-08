# Local production pipeline and checked example

Use load_workspace_dependencies for bundled Python/Node/Poppler paths. Do not bundle or commit virtual environments, model weights, API secrets or build segments.

## Existing local narration tools

On Aaron's Windows host, the previously verified runtime is:
C:/Github/ProcureFlow-App/output/video/qwen-voice-work/runtime/Scripts/python.exe

Model cache:
C:/Github/ProcureFlow-App/output/video/qwen-voice-work/models/Qwen3-TTS-12Hz-1.7B-Base

The example generator uses Qwen3-TTS Base locally, CUDA, NF4 generator weights and BF16 codec/residual components to fit the 4 GB RTX A500. The approved conditioning WAV and its literal reference text are bundled in this skill. Preserve their hash and text. QWEN_FAST=1 uses the previously reviewed MIT Faster Qwen CUDA runtime; only reuse it when available and reviewed. Base generation remains valid. Generate two adjacent scenes per pair, split at speech alignment; cache only when text/model/reference hash match.

The existing ASR package and model cache are under:
C:/Github/ProcureFlow-App/output/video/voice-audition/asr-deps
C:/Github/ProcureFlow-App/output/video/voice-audition/asr-model

The checked example uses faster-whisper base.en CPU int8, beam size 5 and word timestamps. Review semantic differences (especially numbers, product codes and negation), not just overall match ratio. Update 07 ratios were .971–1.000; remaining differences were spelling/homophones and minor recognised prepositions.

FFmpeg was available through imageio_ffmpeg under:
C:/Github/ProcureFlow-App/output/video/supplier-stock/work/deps

Discover these paths before reuse; if unavailable, prefer official packages/vendor model sources, explain the concrete limitation, and use the relevant tool approval rules. Do not clone a human voice as a fallback.

## Worked example

Repository docs/feature-updates/supplier-pack-quantities/source contains:
- template-contract.json: verified expected/replacement text slots and image assignments.
- storyboard.json: eight scene titles, notes, screenshot filenames and narration.
- generate_voice.py, align_speech.py, compose_video.py, render_video.py: checked production pipeline, adapted from the six originals.
- verification.json and video-manifest.json: actual measurements and provenance.
- build_guide.py: template package-preservation build.
These example scripts retain the original machine runtime paths and topic-specific names. Copy to a new package work directory, adjust ROOT/feature names and input paths, and read before running; do not run them unchanged for a new topic.

## Portable guide build

scripts/build_guide.py accepts a contract with:
reference (absolute or relative to contract), sha256, title, slots mapping of paragraph index to expected/text, and images list with index/file/max_width_pt/max_height_pt.
Image files resolve from PACKAGE/screenshots. It rejects unexpected source text, wrong template hash or modified preserve-only package parts.

After building, use documents skill rendering or installed Word:
open DOCX hidden, update fields, repaginate, save, ExportAsFixedFormat(...,17), close and quit in finally. Export to a unique intermediate PDF to avoid existing-output locks. Run pdftoppm and inspect every page.

## Acceptance checks

Guide: all pages visually checked, correct headings/navigation/counts, no old topic screenshot, no overlap and editable Word source. Video: full FFmpeg decode, H264/AAC 1080p24, MP4 moov before mdat, captions complete and aligned, approximately -16 LUFS with peak below -0.8 dB; inspect a caption-heavy frame for every scene.

Run scripts/verify_package.py against the delivery manifest; it verifies hashes/bytes, PDF pages, DOCX validity, caption ordering/count and MP4 header/faststart. It does not replace full decode, listening or visual review.

## Held release boundary

Guide 07 explicitly identifies illustrative unreleased branch records. Before launch, replace its availability paragraph with confirmed release wording, regenerate PDF, inspect and rehash/repackage. Keep current six live entries unchanged until authorised launch. The current publisher hardcodes 2026-10-06: inspect the source and deliberately parameterise/extend it before publishing this separate folder. Do not upload a new feature into the old release or infer production readiness from fixture screenshots.
