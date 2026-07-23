/* ============================================================
   ALFRED — controller
   - Scale the 1080x1920 stage to fit any screen (keeps portrait).
   - Spacebar-driven audio playback rig (Wizard-of-Oz).
   - Live-looking telemetry: clock, weather, memory, CPU, network.
   - Core intensifies while ALFRED "speaks".
   Zero external requests. Works from file:// and when deployed.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. SCALE-TO-FIT  (portrait 1080x1920 design canvas)
     --------------------------------------------------------- */
  const stage = document.getElementById("stage");
  function fit() {
    const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = "scale(" + scale + ")";
  }
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  fit();

  /* ---------------------------------------------------------
     2. AUDIO SEQUENCE RIG
     Probe /audio/01.mp3, 02.mp3 ... sequentially at startup so it
     works both on a static host and from a local file:// clone
     (no directory listing needed). Also accepts .wav / .m4a / .ogg.
     --------------------------------------------------------- */
  const EXTS = ["mp3", "wav", "m4a", "ogg"];
  const MAX_PROBE = 60;           // stop probing after this many missing in a row
  const clips = [];               // { src, audio }
  let idx = 0;                    // next phrase to play (0-based)
  let current = null;             // currently playing Audio

  const phraseIdxEl   = document.getElementById("phraseIdx");
  const phraseTotalEl = document.getElementById("phraseTotal");
  const voiceStateEl  = document.getElementById("voiceState");
  const core          = document.getElementById("core");

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Try to load audio/<NN>.<ext>; resolves with a src string or null.
  function probe(n) {
    return new Promise(function (resolve) {
      let ei = 0;
      function tryExt() {
        if (ei >= EXTS.length) return resolve(null);
        const src = "audio/" + pad(n) + "." + EXTS[ei];
        const a = new Audio();
        a.preload = "auto";
        let done = false;
        const ok = function () { if (done) return; done = true; cleanup(); resolve(src); };
        const bad = function () { if (done) return; done = true; cleanup(); ei++; tryExt(); };
        function cleanup() {
          a.removeEventListener("canplaythrough", ok);
          a.removeEventListener("loadedmetadata", ok);
          a.removeEventListener("error", bad);
        }
        a.addEventListener("canplaythrough", ok);
        a.addEventListener("loadedmetadata", ok); // file:// often fires this, not canplaythrough
        a.addEventListener("error", bad);
        a.src = src;
        a.load();
      }
      tryExt();
    });
  }

  async function discover() {
    for (let n = 1; n <= MAX_PROBE; n++) {
      const src = await probe(n);
      if (!src) break;                       // first gap ends the sequence
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.addEventListener("ended", onEnded);
      clips.push({ src: src, audio: audio });
    }
    phraseTotalEl.textContent = clips.length;
    updateCounter();
    if (clips.length === 0) {
      toast("No audio found in /audio — add 01.mp3, 02.mp3 …");
    }
  }

  function updateCounter() { phraseIdxEl.textContent = clips.length ? idx : 0; }

  function speaking(on) {
    core.classList.toggle("speaking", on);
    voiceStateEl.textContent = on ? "SPEAKING" : "IDLE";
    voiceStateEl.className = on ? "" : "muted";
    setStatus(on ? "PROCESSING" : "SYSTEM ONLINE",
              on ? "RESPONDING TO OPERATOR" : "ALL SYSTEMS NOMINAL");
    waveActive = on;
  }

  function stopCurrent() {
    if (current) { current.pause(); current.currentTime = 0; current = null; }
    speaking(false);
  }

  function play(i) {
    if (i < 0 || i >= clips.length) return;
    stopCurrent();
    current = clips[i].audio;
    current.currentTime = 0;
    const p = current.play();
    if (p && p.catch) p.catch(function () { /* autoplay gesture already satisfied by keypress */ });
    speaking(true);
  }

  function onEnded() { current = null; speaking(false); }

  function next() {
    if (!clips.length) return;
    if (idx >= clips.length) idx = 0;   // wrap
    play(idx);
    idx++;
    updateCounter();
  }
  function back() {
    if (!clips.length) return;
    idx = Math.max(0, idx - 1);
    play(idx);
    updateCounter();
  }
  function reset() {
    stopCurrent();
    idx = 0;
    updateCounter();
  }

  /* ---------------------------------------------------------
     3. KEYBOARD
     --------------------------------------------------------- */
  const operator = document.getElementById("operator");
  document.addEventListener("keydown", function (e) {
    switch (e.code) {
      case "Space":      e.preventDefault(); next(); break;
      case "Backspace":  e.preventDefault(); back(); break;
      case "KeyR":       e.preventDefault(); reset(); break;
      case "KeyF":       e.preventDefault(); toggleFullscreen(); break;
      case "KeyH":       e.preventDefault(); operator.classList.toggle("hidden"); break;
      case "Escape":     if (document.fullscreenElement) document.exitFullscreen(); break;
    }
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
    } else {
      document.exitFullscreen();
    }
  }

  /* ---------------------------------------------------------
     4. CURSOR AUTO-HIDE
     --------------------------------------------------------- */
  let cursorTimer;
  function pokeCursor() {
    document.body.classList.remove("hide-cursor");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () { document.body.classList.add("hide-cursor"); }, 2500);
  }
  window.addEventListener("mousemove", pokeCursor);
  pokeCursor();

  /* ---------------------------------------------------------
     5. TELEMETRY  (all fake — this is a prop)
     --------------------------------------------------------- */

  // -- Clock --
  const clockEl = document.getElementById("clock");
  const dateEl  = document.getElementById("dateStr");
  const tzEl    = document.getElementById("tzStr");
  function tickClock() {
    const d = new Date();
    const hh = pad(d.getHours()), mm = pad(d.getMinutes()), ss = pad(d.getSeconds());
    clockEl.textContent = hh + ":" + mm + ":" + ss;
    dateEl.textContent = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      tzEl.textContent = (tz.split("/").pop() || "LOCAL").replace(/_/g, " ").toUpperCase();
    } catch (_) { tzEl.textContent = "LOCAL"; }
  }
  setInterval(tickClock, 1000); tickClock();

  // -- Memory ring --
  const memArc = document.getElementById("memArc");
  const memPct = document.getElementById("memPct");
  const memUsed = document.getElementById("memUsed");
  const memFree = document.getElementById("memFree");
  const MEM_TOTAL = 16.0;
  const R = 50, CIRC = 2 * Math.PI * R;
  memArc.style.strokeDasharray = CIRC;
  let mem = 62;
  function tickMem() {
    mem += (Math.random() - 0.5) * 5;
    mem = Math.max(48, Math.min(78, mem));
    const v = Math.round(mem);
    memPct.textContent = v;
    memArc.style.strokeDashoffset = CIRC * (1 - v / 100);
    const used = (MEM_TOTAL * v / 100);
    memUsed.textContent = used.toFixed(1);
    memFree.textContent = (MEM_TOTAL - used).toFixed(1);
  }
  setInterval(tickMem, 2200); tickMem();

  // -- CPU / load --
  let waveActive = false;   // true while ALFRED is "speaking" (declared early: used below)
  const cpuEl = document.getElementById("cpu");
  const loadEl = document.getElementById("load");
  function tickCpu() {
    const base = waveActive ? 30 : 6;
    const c = Math.round(base + Math.random() * (waveActive ? 40 : 10));
    cpuEl.textContent = pad(c);
    loadEl.textContent = (c / 100 * 2.4).toFixed(2);
  }
  setInterval(tickCpu, 1500); tickCpu();

  // -- EKG heartbeat --
  const ekg = document.getElementById("ekgLine");
  const EKG_W = 260, EKG_H = 60, EKG_N = 70;
  let ekgData = new Array(EKG_N).fill(EKG_H / 2);
  let beat = 0;
  function tickEkg() {
    ekgData.shift();
    // occasional heartbeat spike, otherwise gentle noise
    let y = EKG_H / 2 + (Math.random() - 0.5) * 4;
    beat = (beat + 1) % 22;
    if (beat === 0) y = 6;
    else if (beat === 1) y = EKG_H - 8;
    else if (beat === 2) y = EKG_H / 2;
    ekgData.push(y);
    let pts = "";
    for (let i = 0; i < EKG_N; i++) pts += (i / (EKG_N - 1) * EKG_W).toFixed(1) + "," + ekgData[i].toFixed(1) + " ";
    ekg.setAttribute("points", pts.trim());
  }
  setInterval(tickEkg, 90);

  // -- Network bars --
  const netBars = document.getElementById("netBars");
  const NET_BARS = 22;
  for (let i = 0; i < NET_BARS; i++) { const s = document.createElement("span"); netBars.appendChild(s); }
  const netUp = document.getElementById("netUp");
  const netPing = document.getElementById("netPing");
  function tickNet() {
    const bars = netBars.children;
    for (let i = 0; i < bars.length; i++) bars[i].style.height = (10 + Math.random() * 60).toFixed(0) + "px";
    netUp.textContent = (100 + Math.round(Math.random() * 80));
    netPing.textContent = (8 + Math.round(Math.random() * 12));
  }
  setInterval(tickNet, 700); tickNet();

  // -- Weather (drifts slowly; purely cosmetic) --
  const wxTemp = document.getElementById("wxTemp");
  const wxFeels = document.getElementById("wxFeels");
  const wxCond = document.getElementById("wxCond");
  const wxIcon = document.getElementById("wxIcon");
  const CONDS = [
    { t: "CLEAR",          i: "☀" },
    { t: "PARTLY CLOUDY",  i: "⛅" },
    { t: "CLOUDY",         i: "☁" },
    { t: "LIGHT RAIN",     i: "🌧" },
  ];
  let wx = 72, wxc = 1;
  function tickWx() {
    wx += (Math.random() - 0.5) * 1.4;
    wx = Math.max(58, Math.min(84, wx));
    wxTemp.textContent = Math.round(wx);
    wxFeels.textContent = Math.round(wx - 2 + Math.random() * 2);
    if (Math.random() < 0.15) { wxc = (wxc + 1) % CONDS.length; }
    wxCond.textContent = CONDS[wxc].t;
    wxIcon.textContent = CONDS[wxc].i;
  }
  setInterval(tickWx, 6000); tickWx();

  // -- Voice waveform bars --
  const wave = document.getElementById("wave");
  const WAVE_BARS = 48;
  for (let i = 0; i < WAVE_BARS; i++) { const s = document.createElement("span"); wave.appendChild(s); }
  (function animateWave() {
    const bars = wave.children;
    const t = performance.now() / 200;
    for (let i = 0; i < bars.length; i++) {
      let h;
      if (waveActive) {
        h = 6 + Math.abs(Math.sin(t + i * 0.5)) * (24 + Math.random() * 34);
      } else {
        h = 5 + Math.abs(Math.sin(t * 0.3 + i * 0.4)) * 5; // gentle idle shimmer
      }
      bars[i].style.height = h.toFixed(1) + "px";
    }
    requestAnimationFrame(animateWave);
  })();

  /* ---------------------------------------------------------
     6. STATUS LINE + toast helpers
     --------------------------------------------------------- */
  const statusMain = document.getElementById("statusMain");
  const statusSub  = document.getElementById("statusSub");
  function setStatus(main, sub) { statusMain.textContent = main; statusSub.textContent = sub; }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    stage.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () { el.classList.remove("show"); setTimeout(function () { el.remove(); }, 400); }, 5000);
  }

  /* ---------------------------------------------------------
     7. GO
     --------------------------------------------------------- */
  discover();
})();
