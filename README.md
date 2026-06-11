# Beat-Sync Video Generator

A real-time, browser-based audio visualizer and video synthesizer. Load an audio
track, watch it drive reactive visuals synced to the beat, and record the result
as a video — all client-side, no server or installation required.

## Features

- 🎵 **Audio analysis** — load a local audio file and analyze it in real time using the Web Audio API (BPM detection, waveform/frequency data).
- 🌈 **Beat-synced visuals** — six canvas-based visualizer themes that react to the music: Cosmic Pulse, Cyber Grid, Warp Tunnel, Aurora Flow, Kaleido Bloom, and Matrix Rain.
- 🎬 **Video recording** — capture the visualization to a downloadable video file via `MediaRecorder`.
- 🎛️ **Playback controls** — play / pause / stop, scrubbing, volume, and mute.
- ⚡ **100% client-side** — everything runs in the browser; nothing is uploaded.

## Tech Stack

- Vanilla JavaScript (no build step)
- Web Audio API
- HTML5 Canvas
- MediaRecorder API

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | App markup and UI |
| `index.css` | Styles |
| `app.js` | Main controller wiring UI, audio, visualizer, and recorder |
| `audio.js` | Audio loading, playback, and analysis |
| `visualizer.js` | Canvas rendering of beat-synced visuals |
| `encoder.js` | Video capture / encoding |

## Running Locally

Because the app uses ES modules and the Web Audio API, serve it over HTTP rather
than opening `index.html` directly:

```bash
# Python 3
python -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000 in a modern browser (Chrome/Edge recommended).

## Browser Support

Requires a modern browser with Web Audio API and `MediaRecorder` support.
Best experienced in the latest Chrome or Edge.

## License

MIT
