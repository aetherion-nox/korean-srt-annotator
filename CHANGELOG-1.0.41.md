# Korean SRT Annotator v1.0.41 — aligned with Web v1.1.56.61

Base: SRT v1.0.40 (Web v1.1.56.59 review quality and Hanja diagnostics).

## Shared model review improvements (Web .60–.61)
- Evaluate contextual meaning, Korean pronunciation, and lexical boundaries before choosing any dictionary c/n key. A lone but semantically wrong candidate must not be selected.
- Distinguish standard dictionary-only review from experiments enabling direct authentic Hanja and/or Latin loanword etymologies. Korean Hanja must reflect Sino-Korean readings, not a translation to Chinese characters that happens to mean the same thing. Personal-name safety rules remain enforced.
- Correct invalid dictionary IDs by retrying only affected targets. The correction request preserves the *original enabled* experimental Hanja/Latin permissions and per-target audit flags, while still disabling new segmentation repairs. Genuine origin strings are allowed when enabled, verified and no dictionary sense matches; otherwise choose actual JSON null. Other already validated answers remain saved.
- For manual review, reconstruct the smaller correction prompt retaining its origin_mode, allowed_origin_types, audit markers, original sentence/context, and applicable guidelines. In the API path, the correction call inherits the original experimental toggles.
- Keep the two mutually exclusive settings from v1.0.40: targeted retry on by default, discard invalid results off by default. If users disable experiment origins, corrections stay strictly dictionary-only.
- SRT retains cue indexes/timestamps, bilingual and multilingual text, encoding, styling, original line breaks, annotated-parenthesis evidence, forward-only session glossary, incremental previews, partial export and bundled Kiwi runtime. No Kiwi online update feature.

## Validation
- Include Web .60 and .61 origin-prompt/targeted-retry regression coverage, adapted where the SRT workbench replaces browser-page disconnected recovery. Full SRT JavaScript/Python regressions, packaging, CRC and bundled Kiwi integrity are checked by CI.
- No paid live API invocation or real-browser GUI end-to-end test is claimed.
