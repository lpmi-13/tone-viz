# Thai Tone Visualizer

A local-first browser MVP for Thai tone practice and pitch-contour exploration.

## Run

Build the TypeScript app, then serve the generated `dist/` folder over HTTP so browser module loading and microphone permissions work:

```bash
npm run build
python3 -m http.server 5173 -d dist
```

Then open `http://localhost:5173`.

The build writes JavaScript and CSS assets to `dist/assets/`, emits gzip and Brotli versions for each `.js` and `.css` asset, copies root static files from `public/`, and copies the static audio files into `dist/audio/`. Netlify serves the Content Security Policy and other security headers from `netlify.toml`. Set `SITE_URL` in Netlify to override the canonical/social preview URL; otherwise the build uses Netlify's `URL`.

## Audio

The MVP uses static generated Thai audio from Microsoft Edge/Azure-style Thai neural TTS. The app ships both tested speakers:

- `th-TH-PremwadeeNeural` in `audio/generated/th-th-premwadee/`
- `th-TH-NiwatNeural` in `audio/generated/th-th-niwat/`

Premwadee is the default speaker, and the header speaker menu lets learners switch between the two. Audio files are referenced directly by the static app.

To regenerate the lesson audio from `src/data.ts`:

```bash
python3 scripts/generate_edge_tts.py
```

## Notes

- The app organizes practice by the five Thai tones, with multiple target words per tone and target contour templates.
- Practice items include isolated target-word audio plus longer phrase-context clips with the target word highlighted in Thai script.
- Learners can cycle target words within a tone and cycle phrase variants for the selected word.
- Quiz mode plays phrase clips from the expanded variant set and asks the learner to select the tone of the highlighted monosyllabic word.
- Learner audio is recorded by tap-to-toggle or press-and-hold, or uploaded, decoded locally, analyzed with a YIN-style pitch detector, normalized, and drawn on canvas.
- Practice feedback compares against the selected target and also runs an internal five-template diagnostic to choose clearer contour/register guidance without showing a score.
- Manual normalization prompts the learner to record three separate sustained อา samples: comfortable low, normal speaking pitch, and comfortable high. A sentence is not recommended for normalization because it includes tone movement and unvoiced segments.
- Saved calibration is stored in local browser storage and used for later practice/explore attempts as a floor/mid/ceiling speaker profile.
- When needed, normalization is shown as its own full-page flow and hides the rest of the app until saved or dismissed.
- After completion or dismissal, normalization is absent from the practice UI and can be reopened from the hamburger menu.
- Passive refinement also collects voiced pitch frames from practice/explore attempts. After about 30 seconds of voiced practice it can provide a passive range or expand a saved manual range if practice shows the original floor/ceiling was too narrow.
- Calibrated attempts can warn when pitch goes above or below the active comfortable range.
- The UI includes a dismissible first-use prompt, busy states during decode/analysis, and mobile-friendly record controls.
- Target and phrase playback use the generated speaker audio files for the expanded word and phrase variants.
