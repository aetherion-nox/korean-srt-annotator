# Korean SRT Annotator v1.0.40 — aligned with Web v1.1.56.59

Base: tested SRT v1.0.39, aligned with archived Korean Web Annotator v1.1.56.59.

- Apply individually validated model decisions immediately. New default-on `retryInvalidDictionaryChoices` enables dictionary-only correction prompts for invalid numbered c/n choices (API automatic; manual request shows only unsolved dictionary entries). Do not repeat or overwrite accepted targets; free-form etymologies are not included in these corrections.
- Add mutually exclusive default-off `discardInvalidReviewResults`: unrecognized, omitted, structurally invalid or conflicting answers are safely treated as JSON null/KEEP rather than retried. Network failures retain transport retries. Completely identical valid t/c duplicates are collapsed; different valid c choices for one t all fail, regardless of dictionary/literal validation. Malformed siblings do not invalidate one well-formed row.
- Recover independently complete t/c JSON objects from malformed or incomplete model replies without inventing missing answers or overriding batch-ID safety.
- Preserve experimental Hanja-only KEEP targets when explicitly marked; count generated, retained, submitted, proposed direct Hanja, accepted and rejected origins, including reading, boundary, name and conflict reasons with bounded samples. API/manual diagnostics use the same validator.
- Add 2 switches to the grouped options/reset set (14 total); retain keys, batch context budget, provider profiles, dictionary and request logs. Tencent Hunyuan Flash stays first in the preset list.
- Preserve subtitle cue numbering/timestamps, bilingual text, encodings, line breaks and styling, existing parenthetical etymology evidence, session-only glossary, partial exports and manual/API modes. Kiwi WASM/model stays bundled; no online Kiwi update.
- Verification: automated JavaScript/Python regressions plus complete installable runtime ZIP integrity via GitHub Actions. Real-model API and browser UI end-to-end tests have not been performed.

Source: Korean Web Annotator archive branch `feat/v1.1.56.59-hanja-audit-visibility`.
