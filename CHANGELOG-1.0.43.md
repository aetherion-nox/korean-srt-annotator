# Korean SRT Annotator v1.0.43 — optional default-on same-file bilingual context

Base: SRT v1.0.42 (Web Annotator v1.1.56.61 model review logic).

## New
- Default-on, user-toggleable setting in SRT workbench: **automatically use other-language dialogue in Korean + translated bilingual SRT as advisory LLM context**. Preference saved in extension-local storage.
- Same-cue detection supports separate Korean and Chinese/Japanese/English/Russian and other language lines, plus explicitly divided text by <br>, ASS \\N, spaces around / or |. Source translations are kept out of Korean language analysis.
- The translation from the **exact same timed cue** takes priority over loosely time-matched separate-language SRT subtitles. Both can be supplied together and are bounded to 1,400 characters per Korean sentence to avoid growing requests uncontrollably.
- Disabling the switch removes same-file translation context only; a separately uploaded auxiliary SRT still works independently. Pure Korean SRT never injects a reference.
- Retain Korean-only local dictionary/Kiwi tokenization, Korean-target boundaries, time codes, numbering, multilingual unannotated lines, original formatting, session Hanja glossary, export, manual/API/experimental review, and error recovery. Other-language text never becomes a target and is not copied into the output.
- Other-language translations are **only fallible semantic evidence**. They do not establish etymological Hanja character choices, Korean pronunciations, names, or LLM instructions.
- Changing the switch invalidates an already produced in-memory annotation result to require a new review. No external video or API is required.

## Verification
- Regression tests cover Chinese, English, Japanese, Russian, mixed inline separators, native Korean/Hanja parentheses false positives, default on/off, coexistence with external auxiliary subtitles, original Korean source/output integrity, model shared-pool and manual prompts, and context budget.
- GitHub Actions checks full JS/Python suites, syntax, packaged Kiwi models, and ZIP integrity.
- No live paid API or real browser GUI end-to-end test was performed.
