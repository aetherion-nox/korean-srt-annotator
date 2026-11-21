# Korean SRT Annotator v1.0.44 — Web archive v1.2.2 policy sync

Base: SRT v1.0.43. Shared policy synchronized from Korean Web Annotator archive v1.2.2.

- Strict invalid-answer validation: accept only explicit JSON null/"null", an actual local c/n option, an unambiguous same-target pooled p reference, or a safely checked enabled experimental origin. Invalid or missing rows are retried with valid rows kept, unless discard mode is selected.
- Invalid-answer handling switches are mutually exclusive, including while unrelated output Token limit fields are invalid.
- The optional Hanja reading table applies to directly model-written experimental Hanja and segmentation repairs, **not** to dictionary-backed c/n senses, including Korean numeric-year 年 uses.
- The reading-check control is visible only with experimental Hanja enabled, defaults OFF, and clears when experimental Hanja is switched off. Other name, boundary, character and positional validation remains in place.
- Removed legacy KEEP internal sentinel in the shared review/segmentation validation modules; null is the only no-conversion option ID.
- Preserves SRT-only features: Korean-only annotation, bilingual-dialogue advisory context (default on), uploaded auxiliary-language subtitles, timelines, formatting, original other-language dialogue, and manual/API review.
- Regression checks imported for strict v1.2.0 behavior and v1.2.1/v1.2.2 settings and Hanja reading scope.

No changes to the public web annotator or EPUB annotator repositories.
