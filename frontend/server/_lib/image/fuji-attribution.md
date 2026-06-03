# Fuji LUT attribution

3D LUT presets under `luts/` are derived from the open-source [Fuji XTrans III LUT pack](https://blog.sowerby.me/fuji-film-simulation-profiles/), as bundled in [fujilab](https://github.com/MatthewGreenberg/fujilab).

CPU trilinear grading in `lut3dGrade.ts` ports the LUT sampling step from fujilab’s WebGL renderer (`src/gpu/renderer.js`); it does not ship the fujilab application.
