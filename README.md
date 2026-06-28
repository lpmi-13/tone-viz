# Thai Tone Visualizer

A local-first browser MVP for Thai tone practice and pitch-contour exploration.

## Run

Serve the folder over HTTP so browser module loading and microphone permissions work:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Notes

- The app includes five static Thai lesson items and target contour templates.
- Learner audio is recorded by tap-to-toggle or press-and-hold, or uploaded, decoded locally, analyzed with a YIN-style pitch detector, normalized, and drawn on canvas.
- Practice feedback compares against the selected target and also runs an internal five-template diagnostic to choose clearer contour/register guidance without showing a score.
- Manual normalization prompts the learner to record three separate sustained อา samples: comfortable low, normal speaking pitch, and comfortable high. A sentence is not recommended for normalization because it includes tone movement and unvoiced segments.
- Saved calibration is stored in local browser storage and used for later practice/explore attempts as a floor/mid/ceiling speaker profile.
- When needed, normalization is shown as its own full-page flow and hides the rest of the app until saved or dismissed.
- After completion or dismissal, normalization is absent from the practice UI and can be reopened from the hamburger menu.
- Passive refinement also collects voiced pitch frames from practice/explore attempts. After about 30 seconds of voiced practice it can provide a passive range or expand a saved manual range if practice shows the original floor/ceiling was too narrow.
- Calibrated attempts can warn when pitch goes above or below the active comfortable range.
- The UI includes a dismissible first-use prompt, busy states during decode/analysis, and mobile-friendly record controls.
- Target playback currently falls back to a synthesized contour tone when no static audio file is configured. Native-speaker recordings can replace the empty `audio` fields in `data.js`.
