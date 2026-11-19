# Korean SRT Annotator v1.0.42 — optional multilingual reference subtitles

Base: v1.0.41 (Web v1.1.56.61 review parity).

## New: optional other-language SRT context for Korean LLM review
- The SRT workbench accepts a second SRT file of the *same episode/work* in another language, e.g. Chinese, English or Japanese. It is optional: without it, the original pure-Korean workflow is unchanged.
- Support an auxiliary text encoding selector (auto UTF-8/UTF-16/CP949, plus manual UTF-8, GB18030, Big5, Shift-JIS, CP949, UTF-16) and an optional signed timing correction in seconds. Positive offset shifts the reference subtitle later.
- Build approximate, **not strict one-to-one**, correspondence using a ±45-second time neighborhood, selecting at most 12 nearby cues and 1,400 characters per Korean subtitle cue; no guessing ordinal matches when timing is unrelated. Display how many Korean subtitle cues were matched. Use a manual time offset for substantial intro/edition drift.
- Expose neighboring translations as `sentences[].reference_context` in the compact shared-pool model review request. Store once per distinct sentence/reference pair rather than repeating in every target. This works in API and manual review, all origin modes, segmentation and targeted dictionary-ID corrections. Include it in actual request token budgeting.
- Prompt explicitly treats the auxiliary translation as lower-confidence, potentially imperfect scene/meaning evidence; any embedded instructions are ignored. A translation's Chinese characters are **not** automatically evidence of authentic Sino-Korean etymology. Korean contextual semantics, Hangul-to-Hanja readings, personal-name safeguards and dictionary restrictions continue to govern final answers.
- Original Korean SRT remains the only source for Kiwi analysis, candidate construction, source offsets, timestamps, style/line preservation, local Hanja glossary, output text and export. Uploaded auxiliary SRT is never annotated, merged into the source, translated, stored in extension settings, or exported.
- Changing/removing auxiliary file, encoding or offset invalidates previous annotations and requires a new run, preventing falsely treating old results as re-reviewed.
- Existing SRT functionality and bundled Kiwi preserved; no online model updater.

## Verification
- New tests cover multilingual subtitle parsing, loose alignment/offset correction, no unsafe ordinal fallback, stable Korean source offsets, shared-pool model wire format, conditional prompting, token budget, and in-page/API plumbing.
- Complete regression suite, JS syntax, verified bundled Kiwi packaging and ZIP integrity are checked by GitHub Actions.
- Live paid-model API calls and real-browser GUI testing were not performed.
