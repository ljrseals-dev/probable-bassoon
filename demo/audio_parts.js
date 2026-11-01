  function pink(sec) {
    const n = SR * sec, b = rc.createBuffer(1, n, SR), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, s = 987654321;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0; const w = s / 2147483648 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    return b;
  }
  async function demo() {
    const F = { i: [270, 2290, 3010], a: [730, 1090, 2440], u: [300, 870, 2240], e: [530, 1840, 2480], o: [570, 840, 2410] };
    const segs = [["s", 0.2], ["v", "i", 0.42], ["s", 0.16], ["v", "a", 0.46], ["s", 0.16], ["v", "u", 0.42], ["x", 0.14], ["v", "e", 0.36], ["v", "o", 0.55], ["x", 0.3]];
    const total = segs.reduce((t, s) => t + s[s.length - 1], 0), oc = new OfflineAudioContext(1, Math.ceil(total * SR), SR);
    const src = oc.createOscillator(); src.type = "sawtooth";
    const curve = new Float32Array(400); for (let i = 0; i < 400; i++) { const t = (i / 400) * total; curve[i] = 122 * (1 + 0.1 * Math.sin((2 * Math.PI * t) / 1.9)) - 9 * t; }
    src.frequency.setValueCurveAtTime(curve, 0, total); src.start(0);
    const vg = oc.createGain(); vg.gain.value = 0; src.connect(vg);
    const fm = [0, 1, 2].map((k) => { const b = oc.createBiquadFilter(); b.type = "bandpass"; b.Q.value = [8, 10, 12][k]; b.frequency.value = 500; const g = oc.createGain(); g.gain.value = [1, 0.6, 0.3][k]; vg.connect(b); b.connect(g); g.connect(oc.destination); return b; });
    const ns = oc.createBufferSource(); ns.buffer = pink(2); ns.loop = true; ns.start(0);
    const nbp = oc.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = 6200; nbp.Q.value = 1.2;
    const fg = oc.createGain(); fg.gain.value = 0; ns.connect(nbp); nbp.connect(fg); fg.connect(oc.destination);
    let t = 0;
    segs.forEach((s) => { const d = s[s.length - 1];
      if (s[0] === "s") { fg.gain.setTargetAtTime(2.2, t, 0.01); fg.gain.setTargetAtTime(0, t + d - 0.03, 0.01); }
      if (s[0] === "v") { fm.forEach((b, k) => b.frequency.setTargetAtTime(F[s[1]][k], t, 0.03)); vg.gain.setTargetAtTime(0.5, t, 0.012); vg.gain.setTargetAtTime(0, t + d - 0.02, 0.012); }
      t += d; });
    const r = await oc.startRendering(), d = new Float32Array(r.getChannelData(0)); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v));
    for (let i = 0; i < d.length; i++) d[i] *= 0.7 / m;
    const ob = new AudioBuffer({ length: d.length, numberOfChannels: 1, sampleRate: SR }); ob.copyToChannel(d, 0); return ob;
  }

