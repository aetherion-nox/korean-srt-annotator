# Korean SRT Annotator v1.0.37 — Web v1.1.56.50 core alignment

- Full shared lexical backend and reviewer sync from Web v1.1.56.50.
- Dictionary-backed Hanja reading safety, guarded literal "null" fallback, semantic-first manual/API prompts and first-pass smart segmentation audit; no mandatory second review request.
- Bounded batched Kiwi/Python analysis, progress checkpoints and model retry/partial-result salvage.
- Author-authored inline Hangul(Hanja) references parsed safely into SRT analysis; no duplicate parentheses in rendered subtitle output. Learn evidence only after it is encountered, with a session-only glossary; readings with positive mismatch do not propagate.
- Accurate model choice and projection statistics and guarded repeated names.
- Optional shared API/manual output budget switch.
- SRT timestamps, Korean/English bilingual preservation, linebreaks, encoding, style, existing parenthesized origins, export and partial results stay unchanged. No Kiwi online updater.
- GitHub Actions runs full JS/Python tests and packages complete runtime with ZIP integrity checking.
