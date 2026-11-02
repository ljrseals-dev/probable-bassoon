Copyright © 2026 Lewis James Seals Jr. All rights reserved. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
# Reverb Designer

Design a room or a plate reverb in the browser, read its decay, and save the stereo impulse response (IR) for a DAW or any convolution reverb. Open `index.html`.

- **Room plan**: drag the source, the listener, or the lower-right corner. Sliders for width, depth, height, wall absorption, high-frequency damping, early reflections.
- **Plate**: decay, damping, pre-delay.
- **Presets**: small room, concert hall, cathedral, bright plate.
- **Direct sound** in the IR: off (for a send or return), panned by azimuth and distance, or HRTF.
- **Analysis**: echogram with Schroeder curve, RT60 (T20), early decay (EDT), clarity C80, definition D50, and T20 per octave band (125 Hz to 8 kHz).
- **Audition**: demo phrase, pink noise, clicks or your file through the same IR via the browser's convolver. Dry/wet control.
- **Export** (standalone `index.html`): stereo, 44.1 kHz, 24-bit WAV, peak-normalized to 0.89.

Build: `python3 build.py`. Test: `NODE_PATH=$(npm root -g) node tests/browser.test.cjs` (Playwright, Chromium). `src/worklets.js` holds the hall and plate processors.

## Measured in headless Chromium
- Undamped room reverb time vs the Eyring formula: 0.43 s vs 0.45 (small), 0.87 vs 0.90 (medium), 2.05 vs 2.16 (large), all within 15 percent.
- Damping: in a 12 x 16 x 6 m room, damping 0.3 gives T20 of 0.84 s at 500 Hz and 0.38 s at 8 kHz; with damping off both are about 0.86 s.
- Clarity falls with distance: C80 of 10.5, 6.6 and 3.8 dB at 1.5, 4 and 10 m.
- A source to the right puts the direct sound on the right channel; "direct off" removes it.
- Plate decay control: T20 of 1.0 s at decay 0.3 and 4.8 s at 0.8; pre-delay shifts the onset (21 ms at 12 ms setting, 89 ms at 80 ms).
- The tail is decorrelated between the ears (correlation about -0.08).
- The exported WAV reads back through the browser's decoder to within 1.5e-7 of the rendered IR, with the right length, channel count and peak.

## Not verified
- How it sounds. Nobody has listened to it.
- Whether it resembles any real room or plate.
- The plate coefficients, typed from memory of Dattorro's design.
- T20, EDT, C80 and D50 follow the usual ISO 3382 definitions as I recall them; I did not consult the standard, and they are estimates from one synthetic IR.
- The room is a plain box with one absorption value for every wall, and the damping control is an extra high-frequency loss that the Eyring formula does not include.

See CREDITS.md for citations.
