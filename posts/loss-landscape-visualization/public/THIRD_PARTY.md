# Browser dependencies

The build copies `plotly.js-dist-min` **3.6.0** (MIT) into `public/plotly/`,
including `LICENSE` and version metadata. Source: https://github.com/plotly/plotly.js/tree/v3.6.0.
Plotly renders the interactive charts and export frames; 3D surfaces require WebGL.

## Encoder dependencies

The build copies these pinned npm packages into `public/ffmpeg/`:

- `@ffmpeg/ffmpeg` 0.12.15 — JavaScript worker wrapper, MIT.
- `@ffmpeg/core` 0.12.10 — single-thread FFmpeg WebAssembly core, GPL-2.0-or-later
  (including external codec libraries such as x264, with their own applicable licenses).

The generated `ffmpeg/versions.json` records package versions and license metadata.
`licenses/` contains the wrapper's MIT notice and the GPL v2 license text.
Source and build instructions (including upstream library versions) are available from:

- https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v12.15
- https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v12.15/Dockerfile
- https://github.com/FFmpeg/FFmpeg/tree/n5.1.4
- https://ffmpegwasm.netlify.app/docs/faq/#what-is-the-license-of-ffmpegwasm

Deploying the generated assets redistributes the GPL-licensed core. Preserve applicable
notices/licenses and comply with the corresponding-source requirements of the core and
its bundled libraries. The wrapper's MIT license alone does not cover the encoder core.
