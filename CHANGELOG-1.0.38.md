# Korean SRT Annotator v1.0.38 — aligned with Web v1.1.56.51

Base: verified SRT v1.0.37 (Web v1.1.56.50 quality sync).

- Port the 12 dictionary/model-review switch defaults precisely from Web 1.1.56.51. Exactly eleven switches enabled by default, `reviewAllCandidates` disabled; manual chat enabled for new installations. Respect explicit old preferences and keep legacy explicitly-disabled model review intact until users opt to reset.
- Add a separate 12-switch grouped panel and **scope-specific reset** that writes only the 12 boolean keys. Batch context, API settings/key storage, dictionary and logs remain unchanged.
- New-install batch context capacity: 1M heuristic budgeting; retain any previously saved valid tier. This is not a provider context-size guarantee.
- Add official OpenAI-compatible Gemini, Meta Muse and Tencent Hunyuan TokenHub provider presets and their curated models. Match provider-specific thinking, reasoning effort and output token parameters; Chinese/international TokenHub guidance and user custom endpoints preserved.
- Preserve SRT timestamps, bilingual dialogue, text styling, linebreaks, encoding, source inline Hangul(Hanja), session-only glossary, manual/API review, incremental display and partial exports. Kiwi model remains bundled; online Kiwi update stays removed.
- Verify new/reset and provider settings using mocked API nonstreaming/streaming fixtures; run full SRT and Python regressions and package an installable runtime ZIP with model decompression/CRC checks. Real paid API and GUI end-to-end requests are not claimed.
