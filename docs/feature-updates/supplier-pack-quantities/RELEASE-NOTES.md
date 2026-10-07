# Feature update 07 — supplier bale and carton quantities

Prepared 7 October 2026 for the held branch codex/supplier-pack-quantities and draft PR #5. **Assets ready; feature not launched.**

The package matches the six October 6 guides and videos: editable seven-page Word guide, PDF, 1:55 narrated 1080p video with the same approved synthetic Australian presenter, burned-in captions, SRT, transcript and poster. Screens use actual POCreate/PODetail/DeliveryModal components in tests/fixtures/order-packs-preview.tsx with illustrative records and no Supabase connection.

Screens show a 30 Each pack, adjustment of 31 to 60, totals AUD333.60 ex GST / AUD33.36 GST / AUD366.96 inc GST, an unknown-pack ordering block, saved pack details, and a 7-unit receipt remaining 7.

All seven guide pages and all eight rendered video scenes were visually reviewed. Full video decode, caption completeness/timing and loudness passed. Word was refreshed/repaginated using installed Word COM because LibreOffice was unavailable. Speech recognition checks matched .971–1.000; differences were spelling/homophones and minor prepositions. No independent human listening review was recorded.

## Before launch

- Complete the feature's migration and supplier pack-data readiness checks documented in the draft PR; verify the real staging request → approval → purchasing → receiving → finance/export flow.
- Confirm launch date and release availability. Update the guide's final availability paragraph, regenerate the PDF and refresh hashes/ZIP.
- Review whether the six prior guides contain quantity advice that should change with this feature. Do not overwrite their release files accidentally.
- Publish this separate resource folder using a deliberately extended media publisher. The current publisher hardcodes 2026-10-06; it does not automatically include this feature.
- Only at authorised launch, add the prepared feature-entry.json entry to the popup registry with the appropriate release announcement identity. Verify authenticated signed PDF, video and poster access and popup reopening/dismissal as a normal user.
- Keep PR #5 draft and main unchanged until launch is authorised.

The reusable skill is versioned at .agents/skills/procureflow-feature-update and installed locally under Aaron's Codex skills. Source contracts, storyboard, pipeline and QA records are retained in source/. Intermediate voices and render segments stay in ignored work/.
