# Korean SRT Annotator v1.0.39 — aligned with Web v1.1.56.52

Base: verified SRT v1.0.38 (Web v1.1.56.51 provider and preset sync).

- Tencent TokenHub: Hy4 Flash now supports the same visible **Disable thinking** switch as Hy4, Hy4 Preview and Hy3. Hy4-family thinking enabled transmits `thinking.type=enabled` and `reasoning_effort=high`; disabled transmits `thinking.type=disabled` and `reasoning_effort=no_think`.
- New `hy4-preview` selectable preset (Tencent marks it as nearing retirement); Hy4 and Hy4 Flash remain the recommended choices. Hy3 offers `low` or `high` when enabled, and `no_think` when disabled.
- The settings panel hides the effort selector while thinking is off and restores the supported effort list when enabled. Existing user API keys, profiles and custom region-specific endpoints are retained.
- Preserve SRT timestamps, multilingual lines, formatting and encodings, existing `Hangul(Hanja)` evidence, session-only glossary, manual/API review and partially exportable results; Kiwi stays bundled and the online updater remains removed.
- Add Hunyuan catalog, UI, request flags, streaming/nonstreaming JSON reply and `reasoning_content` isolation regression tests. The release workflow validates the complete SRT JS/Python suite and packages a verified Kiwi runtime ZIP. Real paid API calls and browser GUI end-to-end testing are not claimed.

Source parity: https://github.com/aetherion-nox/korean-web-annotator/tree/fix/v1.1.56.52-hunyuan-thinking
