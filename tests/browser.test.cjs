const { chromium } = require("playwright"), http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const file = process.argv[2] || path.join(__dirname, "../index.html"), shots = path.join(__dirname, "..");
const server = http.createServer((q, r) => { r.setHeader("content-type", "text/html; charset=utf-8"); r.end(fs.readFileSync(file)); });
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 1000 }, colorScheme: "dark" })).newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_|fonts\./.test(m.text())) errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__rd && window.__rd.ready() >= 1, null, { timeout: 120000 });

  const R = await page.evaluate(async () => {
    const { S, renderIR, analyze, sceneNow, roomStats, wav24 } = window.__rd, out = {};
    const base = () => Object.assign(sceneNow(), { rev: "hall", direct: "off", damp: 0, alpha: 0.25, early: 1 });
    // 1. reverb time vs Eyring, undamped, three sizes
    out.rt = {};
    for (const [n, [W, D, H]] of Object.entries({ small: [6, 8, 3], medium: [12, 16, 6], large: [30, 40, 14] })) {
      const sc = Object.assign(base(), { W, D, H, lx: W / 2, ly: D * 0.75, sx: W / 2, sy: D * 0.75 - 2 });
      const a = await analyze(await renderIR(sc)); out.rt[n] = { t20: a.T20, formula: roomStats(W, D, H, 0.25).rt, edt: a.EDT };
    }
    // 2. damping: high bands decay faster than low bands
    const dsc = Object.assign(base(), { W: 12, D: 16, H: 6, lx: 6, ly: 12, sx: 6, sy: 10, damp: 0.3 });
    const da = await analyze(await renderIR(dsc)), flat = await analyze(await renderIR(Object.assign({}, dsc, { damp: 0 })));
    const band = (a, fc) => a.oct.find((o) => o.fc === fc).T20;
    out.damp = { lo500: band(da, 500), hi8k: band(da, 8000), hi4k: band(da, 4000), flat500: band(flat, 500), flat8k: band(flat, 8000) };
    // 3. clarity falls as the source moves away (direct sound on)
    out.clar = {};
    for (const d of [1.5, 4, 10]) { const sc = Object.assign(base(), { W: 12, D: 24, H: 6, lx: 6, ly: 20, sx: 6, sy: 20 - d, direct: "pan" }); const a = await analyze(await renderIR(sc)); out.clar[d] = { c80: a.C80, d50: a.D50 }; }
    // 4. direct sound: panned to the right when the source is to the right
    const rsc = Object.assign(base(), { W: 12, D: 16, H: 6, lx: 6, ly: 12, sx: 10, sy: 10, direct: "pan" }), ir = await renderIR(rsc);
    const e5 = (ch) => { let e = 0; for (let i = 0; i < 441; i++) e += ch[i] ** 2; return e; };
    out.pan = { l: e5(ir.L), r: e5(ir.R) };
    const off = await renderIR(Object.assign({}, rsc, { direct: "off" })); out.offFirst = { l: e5(off.L), r: e5(off.R) };
    // 5. WAV round trip
    const w = wav24(ir.L, ir.R, ir.rate, 0.89); let m = 0; for (let i = 0; i < ir.L.length; i++) m = Math.max(m, Math.abs(ir.L[i]), Math.abs(ir.R[i]));
    const dec = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(w.slice(0)), k = 0.89 / m; let md = 0;
    for (let i = 0; i < ir.L.length; i++) { md = Math.max(md, Math.abs(dec.getChannelData(0)[i] - ir.L[i] * k), Math.abs(dec.getChannelData(1)[i] - ir.R[i] * k)); }
    out.wav = { ch: dec.numberOfChannels, len: dec.length, irLen: ir.L.length, maxDiff: md, rate: dec.sampleRate, bytes: w.byteLength, peak: (() => { let p = 0; for (let i = 0; i < dec.length; i++) p = Math.max(p, Math.abs(dec.getChannelData(0)[i]), Math.abs(dec.getChannelData(1)[i])); return p; })() };
    // 6. plate: decay control lengthens it; pre-delay shifts onset
    const psc = Object.assign(sceneNow(), { rev: "plate", direct: "off", pdamp: 0.3, ppre: 12 });
    const p1 = await analyze(await renderIR(Object.assign({}, psc, { pdecay: 0.3 }))), p2 = await analyze(await renderIR(Object.assign({}, psc, { pdecay: 0.8 })));
    const p3 = await analyze(await renderIR(Object.assign({}, psc, { pdecay: 0.5, ppre: 80 })));
    out.plate = { short: p1.T20, long: p2.T20, onset12: p1.onsetMs, onset80: p3.onsetMs };
    // 7. L/R decorrelation of the tail (stereo width)
    const t = ir.L.length >> 1; let c = 0, a2 = 0, b2 = 0; for (let i = t; i < ir.L.length; i++) { c += ir.L[i] * ir.R[i]; a2 += ir.L[i] ** 2; b2 += ir.R[i] ** 2; } out.corr = c / Math.sqrt(a2 * b2 + 1e-30);
    return out;
  });
  console.log(JSON.stringify(R, (k, v) => typeof v === "number" ? +v.toPrecision(4) : v));
  for (const [n, r] of Object.entries(R.rt)) assert(r.t20 && Math.abs(r.t20 / r.formula - 1) < 0.15, `${n}: T20 ${r.t20} vs Eyring ${r.formula}`);
  assert(R.rt.small.t20 < R.rt.medium.t20 && R.rt.medium.t20 < R.rt.large.t20, "RT grows with size");
  assert(R.damp.hi8k < R.damp.lo500 * 0.85, "damping shortens highs more than lows: " + JSON.stringify(R.damp));
  assert(R.damp.flat8k > R.damp.hi8k * 1.1, "damping off keeps the highs longer");
  assert(R.clar[1.5].c80 > R.clar[4].c80 && R.clar[4].c80 > R.clar[10].c80 && R.clar[1.5].c80 - R.clar[10].c80 > 6, "clarity falls with distance: " + JSON.stringify(R.clar));
  assert(R.clar[1.5].d50 > R.clar[10].d50, "definition falls with distance");
  assert(R.pan.r > R.pan.l * 2, "panned direct sound sits on the right: " + JSON.stringify(R.pan));
  assert(R.offFirst.l + R.offFirst.r < (R.pan.l + R.pan.r) * 0.05, "direct off removes the leading sound: " + JSON.stringify(R.offFirst));
  assert.equal(R.wav.ch, 2); assert.equal(R.wav.len, R.wav.irLen); assert.equal(R.wav.rate, 44100); assert.equal(R.wav.bytes, 44 + R.wav.irLen * 6);
  assert(R.wav.maxDiff < 3e-7, "24-bit round trip: " + R.wav.maxDiff); assert(Math.abs(R.wav.peak - 0.89) < 1e-4, "peak normalized: " + R.wav.peak);
  assert(R.plate.long > R.plate.short * 1.5, "plate decay control works: " + JSON.stringify(R.plate));
  assert(R.plate.onset80 > R.plate.onset12 + 40, "pre-delay shifts onset: " + JSON.stringify(R.plate));
  assert(Math.abs(R.corr) < 0.5, "tail is decorrelated between ears: " + R.corr);

  // UI: preset, corner drag, source drag, audition, theme, phone
  await page.click("#pCath"); await page.waitForFunction(() => window.__rd.S.W === 28); const r0 = await page.evaluate(() => window.__rd.ready());
  await page.waitForFunction((b) => window.__rd.ready() > b, r0 - 1, { timeout: 120000 }); await page.waitForTimeout(1500);
  const rtTxt = await page.textContent("#mRT"); assert(parseFloat(rtTxt) > 4, "cathedral reads long: " + rtTxt);
  await page.evaluate(() => window.scrollTo(0, 0));
  const pt = (mx, my) => page.evaluate(([mx, my]) => { const c = document.getElementById("plan"), r = c.getBoundingClientRect(), g = window.__rd.geo(); return { x: r.left + ((g.ox + mx * g.k) * r.width) / c.width, y: r.top + ((g.oy + my * g.k) * r.height) / c.height }; }, [mx, my]);
  const sPos = await pt(...(await page.evaluate(() => [window.__rd.S.sx, window.__rd.S.sy])));
  await page.mouse.move(sPos.x, sPos.y); await page.mouse.down(); await page.mouse.move(sPos.x + 40, sPos.y + 40, { steps: 4 }); await page.mouse.up();
  const sAfter = await page.evaluate(() => [window.__rd.S.sx, window.__rd.S.sy]); assert(sAfter[0] > 10 && sAfter[1] > 10, "source dragged from (6, 7): " + sAfter);
  const cPos = await pt(...(await page.evaluate(() => [window.__rd.S.W, window.__rd.S.D])));
  await page.mouse.move(cPos.x, cPos.y); await page.mouse.down(); await page.mouse.move(cPos.x - 60, cPos.y - 90, { steps: 4 }); await page.mouse.up();
  const dims = await page.evaluate(() => [window.__rd.S.W, window.__rd.S.D]); assert(dims[0] < 28 && dims[1] < 62, "corner drag resizes the room: " + dims);
  await page.waitForTimeout(3500);
  await page.click("#sPink"); await page.click("#play"); await page.waitForTimeout(700); assert.equal(await page.getAttribute("#play", "aria-pressed"), "true"); await page.click("#stop");
  await page.waitForTimeout(1500); await page.screenshot({ path: path.join(shots, "shot-dark.png"), fullPage: true });
  const ph = await (await browser.newContext({ viewport: { width: 400, height: 900 }, colorScheme: "light" })).newPage();
  await ph.goto(`http://127.0.0.1:${server.address().port}/`); await ph.waitForFunction(() => window.__rd && window.__rd.ready() >= 1, null, { timeout: 120000 }); await ph.waitForTimeout(1200);
  await ph.screenshot({ path: path.join(shots, "shot-phone.png"), fullPage: true });
  assert((await ph.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, "no horizontal overflow");
  assert.equal(errs.length, 0, errs.join("\n"));
  console.log("reverb designer tests ok; save button:", !!(await page.$("#dl")));
  await browser.close(); server.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
