/* ============================================================
   ALFRED — controller
   - Portrait-native terminal; sizing is CSS (container units),
     so nothing here scales a fixed canvas.
   - State machine: IDLE / LISTENING / PROCESSING / SPEAKING.
     Each SPACE press runs a cinematic lead-in and speaks the
     next line (audio + transcript), then returns to IDLE.
   - Live-looking telemetry (clock, weather, memory, CPU, net).
   Zero external requests. Works deployed and from file://.
   ============================================================ */
(function () {
  "use strict";

  var body = document.body;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  /* =========================================================
     STATE MACHINE
     ========================================================= */
  var STATE = { IDLE: "idle", LISTENING: "listening", PROCESSING: "processing", SPEAKING: "speaking" };
  var stateLabel = document.getElementById("stateLabel");
  var stateSub   = document.getElementById("stateSub");
  var sysMsg     = document.getElementById("sysMsg");
  var LABELS = {
    idle:       ["STANDBY",   "VOICE INPUT IDLE",      "ALL SYSTEMS NOMINAL"],
    listening:  ["LISTENING", "AWAITING INPUT",        "VOICE CAPTURE ACTIVE"],
    processing: ["PROCESSING","ANALYZING REQUEST",     "NEURAL CORE ENGAGED"],
    speaking:   ["SPEAKING",  "RESPONDING TO OPERATOR","VOICE SYNTHESIS ACTIVE"]
  };
  var stateTimers = [];
  function clearTimers() { stateTimers.forEach(clearTimeout); stateTimers = []; }
  function later(fn, ms) { var t = setTimeout(fn, ms); stateTimers.push(t); return t; }

  function setState(s) {
    body.setAttribute("data-state", s);
    stateLabel.textContent = LABELS[s][0];
    stateSub.textContent   = LABELS[s][1];
    sysMsg.textContent     = LABELS[s][2];
    waveMode = s;
  }

  /* =========================================================
     AUDIO SEQUENCE  (probe audio/01.<ext>, 02 ... in order)
     ========================================================= */
  var EXTS = ["mp3", "wav", "m4a", "ogg"];
  var MAX_PROBE = 60;
  var clips = [];        // { audio }
  var idx = 0;           // next phrase to play (0-based)
  var current = null;
  var transcripts = (window.ALFRED_TRANSCRIPTS || []);

  var phraseIdxEl   = document.getElementById("phraseIdx");
  var phraseTotalEl = document.getElementById("phraseTotal");
  var transcriptEl  = document.getElementById("transcript");

  function probe(n) {
    return new Promise(function (resolve) {
      var ei = 0;
      (function tryExt() {
        if (ei >= EXTS.length) return resolve(null);
        var src = "audio/" + pad(n) + "." + EXTS[ei];
        var a = new Audio(); a.preload = "auto";
        var done = false;
        function ok()  { if (done) return; done = true; clean(); resolve(src); }
        function bad() { if (done) return; done = true; clean(); ei++; tryExt(); }
        function clean() {
          a.removeEventListener("canplaythrough", ok);
          a.removeEventListener("loadedmetadata", ok);
          a.removeEventListener("error", bad);
        }
        a.addEventListener("canplaythrough", ok);
        a.addEventListener("loadedmetadata", ok); // file:// often only fires this
        a.addEventListener("error", bad);
        a.src = src; a.load();
      })();
    });
  }

  async function discover() {
    for (var n = 1; n <= MAX_PROBE; n++) {
      var src = await probe(n);
      if (!src) break;
      var audio = new Audio(src); audio.preload = "auto";
      audio.addEventListener("ended", onSpeakEnd);
      clips.push({ audio: audio });
    }
    phraseTotalEl.textContent = clips.length;
    updateCounter();
    if (!clips.length) toast("No audio in /audio — states still work; add 01.mp3, 02.mp3 …");
  }
  function updateCounter() { phraseIdxEl.textContent = clips.length ? idx : 0; }

  /* =========================================================
     CINEMATIC PLAY  (LISTENING -> PROCESSING -> SPEAKING)
     ========================================================= */
  var LISTEN_MS = 750, PROCESS_MS = 950, NO_AUDIO_SPEAK_MS = 3600;
  var busy = false;

  function showTranscript(i) {
    var t = transcripts[i];
    transcriptEl.innerHTML = t ? escapeHtml(t) : '<span class="cursor">▌</span>';
  }
  function escapeHtml(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function stopAudio() {
    if (current) { current.pause(); current.currentTime = 0; current = null; }
  }

  function playSequence(i) {
    if (i < 0) return;
    clearTimers();
    stopAudio();
    busy = true;
    setState(STATE.LISTENING);
    later(function () {
      setState(STATE.PROCESSING);
      later(function () { beginSpeak(i); }, PROCESS_MS);
    }, LISTEN_MS);
  }

  function beginSpeak(i) {
    setState(STATE.SPEAKING);
    showTranscript(i);
    var clip = clips[i];
    if (clip) {
      current = clip.audio;
      current.currentTime = 0;
      var p = current.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      // no audio file — hold the SPEAKING state a beat so visuals still read
      later(onSpeakEnd, NO_AUDIO_SPEAK_MS);
    }
  }

  function onSpeakEnd() {
    current = null; busy = false;
    setState(STATE.IDLE);
    transcriptEl.innerHTML = '<span class="cursor">▌</span>';
  }

  /* operator actions */
  function next() {
    var total = Math.max(clips.length, transcripts.length);
    if (!total) { flashLine(); return; }
    if (idx >= total) idx = 0;
    playSequence(idx);
    idx++; updateCounter();
  }
  function back() {
    var total = Math.max(clips.length, transcripts.length);
    if (!total) { flashLine(); return; }
    idx = Math.max(0, idx - 1);
    playSequence(idx);
    updateCounter();
  }
  function reset() {
    clearTimers(); stopAudio(); busy = false; idx = 0;
    setState(STATE.IDLE);
    transcriptEl.innerHTML = '<span class="cursor">▌</span>';
    updateCounter();
  }
  // if there is truly nothing to play, still give a visual cue
  function flashLine() { playSequence(-0); }

  /* manual state override for rehearsal (keys 1-4) */
  function forceState(s) {
    clearTimers(); stopAudio(); busy = false;
    if (s === STATE.SPEAKING) showTranscript(Math.max(0, idx - 1));
    setState(s);
  }

  /* =========================================================
     KEYBOARD
     ========================================================= */
  var operator = document.getElementById("operator");
  document.addEventListener("keydown", function (e) {
    switch (e.code) {
      case "Space":     e.preventDefault(); next(); break;
      case "Backspace": e.preventDefault(); back(); break;
      case "KeyR":      e.preventDefault(); reset(); break;
      case "KeyF":      e.preventDefault(); toggleFullscreen(); break;
      case "KeyH":      e.preventDefault(); operator.classList.toggle("hidden"); break;
      case "Digit1":    e.preventDefault(); forceState(STATE.IDLE); break;
      case "Digit2":    e.preventDefault(); forceState(STATE.LISTENING); break;
      case "Digit3":    e.preventDefault(); forceState(STATE.PROCESSING); break;
      case "Digit4":    e.preventDefault(); forceState(STATE.SPEAKING); break;
      case "Escape":    if (document.fullscreenElement) document.exitFullscreen(); break;
    }
  });
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      var el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
    } else { document.exitFullscreen(); }
  }

  /* =========================================================
     CURSOR AUTO-HIDE
     ========================================================= */
  var cursorTimer;
  function pokeCursor() {
    body.classList.remove("hide-cursor");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () { body.classList.add("hide-cursor"); }, 2500);
  }
  window.addEventListener("mousemove", pokeCursor); pokeCursor();

  /* =========================================================
     TELEMETRY  (all cosmetic — this is a prop)
     ========================================================= */
  var waveMode = STATE.IDLE;

  // clock
  var hClock = document.getElementById("hClock");
  function tickClock() {
    var d = new Date();
    hClock.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  setInterval(tickClock, 1000); tickClock();

  // uptime
  var uptimeEl = document.getElementById("uptime");
  var upStart = Date.now() - (37 * 60 + 12) * 1000;
  function tickUptime() {
    var s = Math.floor((Date.now() - upStart) / 1000);
    uptimeEl.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }
  setInterval(tickUptime, 1000); tickUptime();

  // memory ring
  var memArc = document.getElementById("memArc"), memPct = document.getElementById("memPct");
  var memUsed = document.getElementById("memUsed"), memFree = document.getElementById("memFree");
  var memPill = document.getElementById("memPill");
  var R = 52, CIRC = 2 * Math.PI * R, MEM_TOTAL = 16.0, mem = 62;
  memArc.style.strokeDasharray = CIRC;
  function tickMem() {
    mem += (Math.random() - 0.5) * 5; mem = Math.max(48, Math.min(82, mem));
    var v = Math.round(mem);
    memPct.textContent = v;
    memArc.style.strokeDashoffset = CIRC * (1 - v / 100);
    var used = MEM_TOTAL * v / 100;
    memUsed.textContent = used.toFixed(1);
    memFree.textContent = (MEM_TOTAL - used).toFixed(1);
    memPill.textContent = v > 78 ? "HIGH" : "NOMINAL";
  }
  setInterval(tickMem, 2200); tickMem();

  // cpu / load
  var cpuEl = document.getElementById("cpu"), loadEl = document.getElementById("load");
  function tickCpu() {
    var busyState = (waveMode === STATE.PROCESSING || waveMode === STATE.SPEAKING);
    var c = Math.round((busyState ? 34 : 6) + Math.random() * (busyState ? 42 : 10));
    cpuEl.textContent = pad(c);
    loadEl.textContent = (c / 100 * 2.4).toFixed(2);
  }
  setInterval(tickCpu, 1400); tickCpu();

  // EKG heartbeat
  var ekg = document.getElementById("ekgLine");
  var EKG_W = 300, EKG_H = 70, EKG_N = 80, ekgData = [], beat = 0;
  for (var i = 0; i < EKG_N; i++) ekgData.push(EKG_H / 2);
  function tickEkg() {
    ekgData.shift();
    var y = EKG_H / 2 + (Math.random() - 0.5) * 4;
    beat = (beat + 1) % 22;
    if (beat === 0) y = 7; else if (beat === 1) y = EKG_H - 9; else if (beat === 2) y = EKG_H / 2;
    ekgData.push(y);
    var pts = "";
    for (var j = 0; j < EKG_N; j++) pts += (j / (EKG_N - 1) * EKG_W).toFixed(1) + "," + ekgData[j].toFixed(1) + " ";
    ekg.setAttribute("points", pts.trim());
  }
  setInterval(tickEkg, 90);

  // network bars
  var netBars = document.getElementById("netBars");
  for (var b = 0; b < 26; b++) netBars.appendChild(document.createElement("span"));
  var netUp = document.getElementById("netUp"), netPing = document.getElementById("netPing");
  function tickNet() {
    var bars = netBars.children;
    for (var k = 0; k < bars.length; k++) bars[k].style.height = (14 + Math.random() * 74).toFixed(0) + "%";
    netUp.textContent = 100 + Math.round(Math.random() * 80);
    netPing.textContent = 8 + Math.round(Math.random() * 12);
  }
  setInterval(tickNet, 700); tickNet();

  // weather
  var wxTemp = document.getElementById("wxTemp"), wxFeels = document.getElementById("wxFeels");
  var wxCond = document.getElementById("wxCond"), wxIcon = document.getElementById("wxIcon");
  var CONDS = [ {t:"CLEAR",i:"☀"}, {t:"PARTLY CLOUDY",i:"⛅"}, {t:"CLOUDY",i:"☁"}, {t:"LIGHT RAIN",i:"🌧"} ];
  var wx = 72, wxc = 1;
  function tickWx() {
    wx += (Math.random() - 0.5) * 1.4; wx = Math.max(58, Math.min(84, wx));
    wxTemp.textContent = Math.round(wx);
    wxFeels.textContent = Math.round(wx - 2 + Math.random() * 2);
    if (Math.random() < 0.15) wxc = (wxc + 1) % CONDS.length;
    wxCond.textContent = CONDS[wxc].t; wxIcon.textContent = CONDS[wxc].i;
  }
  setInterval(tickWx, 6000); tickWx();

  // voice waveform (mode-reactive)
  var wave = document.getElementById("wave");
  var WAVE_BARS = 56;
  for (var w = 0; w < WAVE_BARS; w++) wave.appendChild(document.createElement("span"));
  (function animateWave() {
    var bars = wave.children, t = performance.now() / 200;
    for (var m = 0; m < bars.length; m++) {
      var h;
      if (waveMode === STATE.SPEAKING)        h = 4 + Math.abs(Math.sin(t + m * 0.5)) * (30 + Math.random() * 34);
      else if (waveMode === STATE.PROCESSING) h = 4 + Math.abs(Math.sin(t * 0.8 + m)) * (10 + Math.random() * 12);
      else if (waveMode === STATE.LISTENING)  h = 4 + Math.abs(Math.sin(t * 1.4 + m * 0.3)) * 14;
      else                                    h = 3 + Math.abs(Math.sin(t * 0.3 + m * 0.4)) * 4; // idle shimmer
      bars[m].style.height = h.toFixed(1) + "px";
    }
    requestAnimationFrame(animateWave);
  })();

  /* =========================================================
     BUILD SVG DECORATION (radial ticks + orbital nodes)
     ========================================================= */
  (function buildIris() {
    var ticks = document.getElementById("ticks");
    var cx = 250, cy = 250, rOut = 244, N = 72;
    for (var a = 0; a < N; a++) {
      var ang = (a / N) * Math.PI * 2;
      var major = (a % 6 === 0);
      var len = major ? 16 : 8;
      var x1 = cx + Math.cos(ang) * rOut, y1 = cy + Math.sin(ang) * rOut;
      var x2 = cx + Math.cos(ang) * (rOut - len), y2 = cy + Math.sin(ang) * (rOut - len);
      var ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", x1.toFixed(1)); ln.setAttribute("y1", y1.toFixed(1));
      ln.setAttribute("x2", x2.toFixed(1)); ln.setAttribute("y2", y2.toFixed(1));
      if (major) ln.setAttribute("class", "major");
      ticks.appendChild(ln);
    }
    var orbits = document.getElementById("orbits");
    var rN = 188, nodes = [0, 90, 180, 270];
    nodes.forEach(function (deg) {
      var ang = deg * Math.PI / 180;
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", (cx + Math.cos(ang) * rN).toFixed(1));
      c.setAttribute("cy", (cy + Math.sin(ang) * rN).toFixed(1));
      c.setAttribute("r", "4.5"); c.setAttribute("class", "node");
      orbits.appendChild(c);
    });
  })();

  /* =========================================================
     TOAST
     ========================================================= */
  function toast(msg) {
    var el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    document.getElementById("stage").appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () { el.classList.remove("show"); setTimeout(function () { el.remove(); }, 400); }, 5500);
  }

  /* GO */
  setState(STATE.IDLE);
  discover();
})();
