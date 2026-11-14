# Korean SRT Annotator v1.0.36 — aligned with Web v1.1.56.28

- Web 56.15–28 lexical updates: source-bound word boundaries (no cross-whitespace targets), independent bounded Hanja audit, script-aware proper nouns, exact dictionary evidence for personal-name Hanja, truly functional `filterDictionaryPeople` toggle and candidate filtering.
- Keep c/n dictionary senses; accept enabled, independently verified experimental literal origins. Unknown/unsafe c and absent c/n options safely map to JSON null, preserving original Korean; strict target-identity checks remain.
- Manual review accepts compact t/c array, results object with or without batch_id when IDs uniquely match the active batch; explicit mismatched batch_id rejected. Automatic submission supports these new formats.
- Prompt instructions are conditional on the active experiment/smart repair switches. Stream preview, review counts and budget updated; scan-only targets do not inflate requested reply size.
- Fix unconditional fake dictionary initialization progress.
- Preserve all SRT parsing/output guarantees: timestamps, bilingual subtitles, line breaks, style markers, character encoding, review/partial downloads. Kiwi remains bundled, no online updater.
- Deflate embedded Kiwi .mdl files to reduce ZIP size, with CRC and exact model content checks on packaging.
