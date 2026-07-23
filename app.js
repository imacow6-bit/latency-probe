/* ============================================================
   ALFRED — controller (v3)
   - Sizes the 9:16 stage to the screen and auto-rotates when a
     physically-rotated monitor is still fed a landscape signal
     (press O to override the rotation mode).
   - Procedurally builds the dense neural-iris SVG.
   - State machine: IDLE / LISTENING / PROCESSING / SPEAKING;
     each SPACE press runs the cinematic sequence and speaks the
     next line (audio + transcript).
   - Live-looking telemetry. Zero external requests.
   ============================================================ */
(function () {
  "use strict";

  var body = document.body;
  var stage = document.getElementById("stage");
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  /* =========================================================
     LAYOUT + ROTATION
     The design is portrait 9:16. If the viewport is landscape
     (OS not rotated), render the stage rotated so it reads
     upright on the physically-rotated monitor.
     ========================================================= */
  var ROT_MODES = ["auto", "0", "90", "270"];
  var rotMode = "auto";

  function applyLayout() {
    var W = window.innerWidth, H = window.innerHeight;
    var rot = rotMode === "auto" ? (W > H ? 90 : 0) : parseInt(rotMode, 10);
    // fill the viewport completely — no letterboxing; the flexible core
    // zone absorbs any deviation from a strict 9:16 ratio
    var sw = (rot === 90 || rot === 270) ? H : W;
    var sh = (rot === 90 || rot === 270) ? W : H;
    stage.style.width = sw + "px";
    stage.style.height = sh + "px";
    stage.style.transform = "translate(-50%, -50%)" + (rot ? " rotate(" + rot + "deg)" : "");
    requestAnimationFrame(bgBuild);   // rebuild depth layer at the new size
  }
  window.addEventListener("resize", applyLayout);
  window.addEventListener("orientationchange", applyLayout);

  function cycleRotation() {
    rotMode = ROT_MODES[(ROT_MODES.indexOf(rotMode) + 1) % ROT_MODES.length];
    applyLayout();
    toast("ROTATION: " + rotMode.toUpperCase());
  }

  /* =========================================================
     DEPTH LAYER (canvas behind the UI)
     Starfield, distant rings around the core, graticule,
     nebula glow, micro-markers, vignette. Static parts are
     pre-rendered; ~70 stars twinkle on top each frame.
     ========================================================= */
  var bgCanvas = document.getElementById("bgfx");
  var bgCtx = bgCanvas.getContext("2d");
  var bgStatic = null;          // offscreen prerender
  var bgW = 0, bgH = 0, bgDpr = 1;
  var twinkles = [];

  function bgBuild() {
    var seed0 = 4242;
    function r() { seed0 = (seed0 * 16807) % 2147483647; return (seed0 - 1) / 2147483646; }

    bgW = stage.clientWidth; bgH = stage.clientHeight;
    if (!bgW || !bgH) return;
    bgDpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = Math.round(bgW * bgDpr);
    bgCanvas.height = Math.round(bgH * bgDpr);

    // ring center = actual core center within the stage
    var coreBox = document.getElementById("core");
    var cx = coreBox.offsetLeft + coreBox.offsetWidth / 2;
    var cy = coreBox.offsetTop + coreBox.offsetHeight / 2;

    bgStatic = document.createElement("canvas");
    bgStatic.width = bgCanvas.width; bgStatic.height = bgCanvas.height;
    var c = bgStatic.getContext("2d");
    c.scale(bgDpr, bgDpr);

    // nebula glows
    function glow(x, y, rad, rgba) {
      var g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(0, 0, bgW, bgH);
    }
    glow(cx, cy, bgW * 0.95, "rgba(28,105,215,0.10)");
    glow(bgW * 0.85, bgH * 0.12, bgW * 0.5, "rgba(20,80,180,0.05)");
    glow(bgW * 0.12, bgH * 0.92, bgW * 0.55, "rgba(18,70,160,0.05)");

    // graticule
    c.strokeStyle = "rgba(90,170,230,0.035)"; c.lineWidth = 1;
    for (var gx = 1; gx < 8; gx++) {
      c.beginPath(); c.moveTo(bgW * gx / 8, 0); c.lineTo(bgW * gx / 8, bgH); c.stroke();
    }
    for (var gy = 1; gy < 14; gy++) {
      c.beginPath(); c.moveTo(0, bgH * gy / 14); c.lineTo(bgW, bgH * gy / 14); c.stroke();
    }
    // brighter center axes running the full stage
    c.strokeStyle = "rgba(90,170,230,0.07)";
    c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, bgH); c.stroke();
    c.beginPath(); c.moveTo(0, cy); c.lineTo(bgW, cy); c.stroke();

    // distant rings continuing out past the panels
    [0.44, 0.56, 0.70, 0.86, 1.04, 1.24].forEach(function (f, i) {
      c.beginPath(); c.arc(cx, cy, bgW * f, 0, Math.PI * 2);
      c.strokeStyle = "rgba(80,160,230," + (i % 2 ? 0.045 : 0.065) + ")";
      c.setLineDash(i === 2 ? [2, 16] : []);
      c.lineWidth = 1; c.stroke(); c.setLineDash([]);
    });
    // a few brighter partial arcs on those distant rings
    for (var a0 = 0; a0 < 6; a0++) {
      var rr = bgW * (0.5 + r() * 0.7), st = r() * Math.PI * 2;
      c.beginPath(); c.arc(cx, cy, rr, st, st + 0.25 + r() * 0.5);
      c.strokeStyle = "rgba(110,190,245," + (0.05 + r() * 0.06).toFixed(3) + ")";
      c.lineWidth = 1.4; c.stroke();
    }

    // micro-markers: crosses, squares, ticks
    for (var mM = 0; mM < 46; mM++) {
      var mx = r() * bgW, my = r() * bgH, s = 2 + r() * 3.4;
      c.strokeStyle = "rgba(120,190,240," + (0.05 + r() * 0.09).toFixed(3) + ")";
      c.lineWidth = 1;
      var kind = r();
      if (kind < 0.45) {          // cross
        c.beginPath(); c.moveTo(mx - s, my); c.lineTo(mx + s, my);
        c.moveTo(mx, my - s); c.lineTo(mx, my + s); c.stroke();
      } else if (kind < 0.75) {   // square
        c.strokeRect(mx - s / 2, my - s / 2, s, s);
      } else {                    // tick
        c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + s * 2, my); c.stroke();
      }
    }

    // static star base
    for (var sB = 0; sB < 240; sB++) {
      var x = r() * bgW, y = r() * bgH, rad = 0.4 + r() * 1.1;
      c.fillStyle = "rgba(170,220,255," + (0.06 + r() * 0.22).toFixed(3) + ")";
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }

    // vignette
    var v = c.createRadialGradient(bgW / 2, bgH / 2, bgH * 0.28, bgW / 2, bgH / 2, bgH * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.42)");
    c.fillStyle = v; c.fillRect(0, 0, bgW, bgH);

    // twinkling stars (animated each frame)
    twinkles = [];
    for (var tw = 0; tw < 70; tw++) {
      twinkles.push({
        x: r() * bgW, y: r() * bgH,
        r: 0.6 + r() * 1.7,
        p: r() * Math.PI * 2,           // phase
        f: 0.4 + r() * 1.4,             // frequency
        big: r() < 0.14                 // a few get a glow halo
      });
    }
  }

  function bgDraw(now) {
    if (!bgStatic) return;
    bgCtx.setTransform(1, 0, 0, 1, 0, 0);
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.drawImage(bgStatic, 0, 0);
    bgCtx.setTransform(bgDpr, 0, 0, bgDpr, 0, 0);
    var t = now / 1000;
    for (var i = 0; i < twinkles.length; i++) {
      var s = twinkles[i];
      var a = 0.10 + 0.5 * Math.abs(Math.sin(s.p + t * s.f));
      if (s.big) {
        bgCtx.fillStyle = "rgba(140,215,255," + (a * 0.16).toFixed(3) + ")";
        bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.r * 4.5, 0, Math.PI * 2); bgCtx.fill();
      }
      bgCtx.fillStyle = "rgba(200,235,255," + a.toFixed(3) + ")";
      bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2); bgCtx.fill();
    }
  }

  /* =========================================================
     PROCEDURAL NEURAL IRIS
     Seeded RNG so the pattern is identical on every load.
     ========================================================= */
  var seed = 1337;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var SVGNS = "http://www.w3.org/2000/svg";
  var CX = 300, CY = 300;

  function el(name, attrs, parent) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  function polar(r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }
  function arcPath(r, a0, a1) {
    var p0 = polar(r, a0), p1 = polar(r, a1);
    var large = (a1 - a0) % 360 > 180 ? 1 : 0;
    return "M" + p0[0].toFixed(2) + " " + p0[1].toFixed(2) +
           " A" + r + " " + r + " 0 " + large + " 1 " +
           p1[0].toFixed(2) + " " + p1[1].toFixed(2);
  }

  (function buildIris() {
    var g;

    // axes: full crosshair + small perpendicular ticks + axis markers
    g = document.getElementById("gAxes");
    el("line", { x1: CX, y1: 8, x2: CX, y2: 592, "class": "st-axis" }, g);
    el("line", { x1: 8, y1: CY, x2: 592, y2: CY, "class": "st-axis" }, g);
    [78, 138, 198, 258].forEach(function (d) {
      [[CX, CY - d], [CX, CY + d]].forEach(function (p) {
        el("circle", { cx: p[0], cy: p[1], r: 2.6, "class": "st-dot" }, g);
      });
      [[CX - d, CY], [CX + d, CY]].forEach(function (p) {
        el("rect", { x: p[0] - 2.2, y: p[1] - 2.2, width: 4.4, height: 4.4,
                     fill: "none", "class": "st-hair" }, g);
      });
    });

    // static hairline rings
    g = document.getElementById("gStatic");
    [92, 130, 168, 206, 244, 272, 290].forEach(function (r, i) {
      el("circle", { cx: CX, cy: CY, r: r, "class": i % 2 ? "st-hair" : "st-line" }, g);
    });
    // dotted ring
    el("circle", { cx: CX, cy: CY, r: 148, "class": "st-hair",
      "stroke-dasharray": "0.1 9", "stroke-linecap": "round", "stroke-width": 2 }, g);

    // outer tick ring (144 ticks, major every 12)
    g = document.getElementById("gTicks");
    for (var t = 0; t < 144; t++) {
      var major = t % 12 === 0;
      var deg = t * 2.5;
      var r1 = 284, r2 = major ? 296 : 290;
      var pA = polar(r1, deg), pB = polar(r2, deg);
      el("line", { x1: pA[0].toFixed(1), y1: pA[1].toFixed(1),
                   x2: pB[0].toFixed(1), y2: pB[1].toFixed(1),
                   "class": major ? "st-tick-M" : "st-tick" }, g);
    }

    // segmented data arcs, two counter-rotating layers
    function segLayer(id, rings) {
      var gg = document.getElementById(id);
      rings.forEach(function (ring) {
        var a = rnd() * 360;
        for (var s = 0; s < ring.n; s++) {
          var len = 8 + rnd() * ring.len;
          el("path", { d: arcPath(ring.r, a, a + len), "class": "st-seg",
                       "stroke-width": ring.w, opacity: (0.35 + rnd() * 0.55).toFixed(2) }, gg);
          a += len + 6 + rnd() * 40;
        }
        // one bright accent arc per ring
        var b = rnd() * 360;
        el("path", { d: arcPath(ring.r, b, b + 24 + rnd() * 30), "class": "st-bright",
                     "stroke-width": ring.w + 0.6 }, gg);
      });
    }
    segLayer("gArcsA", [ { r: 258, n: 7, len: 46, w: 3.2 }, { r: 188, n: 6, len: 40, w: 2.4 } ]);
    segLayer("gArcsB", [ { r: 226, n: 8, len: 34, w: 4.2 }, { r: 112, n: 5, len: 30, w: 2.0 } ]);

    // satellite nodes (small ringed dots) on the slow layer
    g = document.getElementById("gNodes");
    [22, 105, 170, 236, 305].forEach(function (deg, i) {
      var r = [252, 214, 262, 196, 238][i];
      var p = polar(r, deg);
      el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 7, "class": "st-hair" }, g);
      el("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.6, "class": "st-node" }, g);
    });

    // sunburst spokes around the nucleus (dense, varying length)
    g = document.getElementById("gSpokes");
    for (var s = 0; s < 120; s++) {
      var deg2 = s * 3;
      var inner = 64 + rnd() * 6;
      var outer = inner + 6 + rnd() * 18;
      var q0 = polar(inner, deg2), q1 = polar(outer, deg2);
      el("line", { x1: q0[0].toFixed(1), y1: q0[1].toFixed(1),
                   x2: q1[0].toFixed(1), y2: q1[1].toFixed(1),
                   "class": "st-spoke", opacity: (0.25 + rnd() * 0.5).toFixed(2) }, g);
    }

    // inner counter-rotating ring w/ short inward spokes
    g = document.getElementById("gInner");
    el("circle", { cx: CX, cy: CY, r: 74, "class": "st-line",
      "stroke-dasharray": "20 9" }, g);

    // bright iris filaments just inside the nucleus ring
    g = document.getElementById("gIrisSpokes");
    for (var f = 0; f < 48; f++) {
      var deg3 = f * 7.5;
      var w0 = polar(24 + rnd() * 8, deg3), w1 = polar(50 - rnd() * 6, deg3);
      el("line", { x1: w0[0].toFixed(1), y1: w0[1].toFixed(1),
                   x2: w1[0].toFixed(1), y2: w1[1].toFixed(1),
                   "class": "st-iris", opacity: (0.35 + rnd() * 0.55).toFixed(2) }, g);
    }
  })();

  /* =========================================================
     STATE MACHINE
     ========================================================= */
  var STATE = { IDLE: "idle", LISTENING: "listening", PROCESSING: "processing", SPEAKING: "speaking" };
  var stateLabel = document.getElementById("stateLabel");
  var LABELS = { idle: "STANDBY", listening: "LISTENING", processing: "PROCESSING", speaking: "SPEAKING" };
  var stateTimers = [];
  function clearTimers() { stateTimers.forEach(clearTimeout); stateTimers = []; }
  function later(fn, ms) { var t = setTimeout(fn, ms); stateTimers.push(t); return t; }

  var waveMode = STATE.IDLE;
  function setState(s) {
    body.setAttribute("data-state", s);
    stateLabel.textContent = LABELS[s];
    waveMode = s;
  }

  /* =========================================================
     AUDIO SEQUENCE + TRANSCRIPTS
     ========================================================= */
  var EXTS = ["mp3", "wav", "m4a", "ogg"];
  var MAX_PROBE = 60;
  var clips = [];
  var idx = 0;
  var current = null;
  var transcripts = (window.ALFRED_TRANSCRIPTS || []);

  var phraseIdxEl   = document.getElementById("phraseIdx");
  var phraseTotalEl = document.getElementById("phraseTotal");
  var transcriptEl  = document.getElementById("transcript");
  var seqDotsEl     = document.getElementById("seqDots");

  function totalPhrases() { return Math.max(clips.length, transcripts.length); }

  function buildDots() {
    seqDotsEl.innerHTML = "";
    var n = Math.min(totalPhrases(), 14);
    for (var i = 0; i < n; i++) seqDotsEl.appendChild(document.createElement("span"));
    paintDots();
  }
  function paintDots() {
    var dots = seqDotsEl.children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("hit", i < idx);
  }
  function updateCounter() { phraseIdxEl.textContent = totalPhrases() ? idx : 0; paintDots(); }

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
    phraseTotalEl.textContent = totalPhrases();
    buildDots(); updateCounter();
    if (!clips.length) toast("NO AUDIO IN /audio — ADD 01.mp3, 02.mp3 …", true);
  }

  /* cinematic sequence: LISTENING -> PROCESSING -> SPEAKING */
  var LISTEN_MS = 750, PROCESS_MS = 950, NO_AUDIO_SPEAK_MS = 3600;
  var IDLE_LINE = "AWAITING VOICE COMMAND";

  function stopAudio() { if (current) { current.pause(); current.currentTime = 0; current = null; } }

  /* =========================================================
     AUDIO-REACTIVE NUCLEUS (Shazam-style)
     A Web Audio analyser reads the real amplitude of whatever
     ALFRED is saying and drives the nucleus scale + ripple
     rings. Falls back to a synthetic envelope if the browser
     won't expose sample data (some file:// setups).
     ========================================================= */
  var audioCtx = null, analyser = null, tdData = null;
  var analyserAlive = false;   // saw real signal at least once
  var speakStart = 0;
  var ampSm = 0;               // smoothed amplitude 0..1
  var synthAmp = 0.3;
  var lastRipple = 0;
  var coreEl = document.getElementById("core");
  var gNucleus = document.getElementById("gNucleus");
  gNucleus.style.transformOrigin = "300px 300px";

  function initAudioGraph() {
    if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      tdData = new Uint8Array(analyser.fftSize);
      analyser.connect(audioCtx.destination);
    } catch (e) { audioCtx = null; analyser = null; }
  }
  function wireClip(clip) {
    if (!audioCtx || clip.wired) return;
    try {
      var src = audioCtx.createMediaElementSource(clip.audio);
      src.connect(analyser);
      clip.wired = true;
    } catch (e) { /* element already wired or tainted — fallback covers it */ }
  }

  function currentAmp(now) {
    var target;
    if (analyser && current) {
      analyser.getByteTimeDomainData(tdData);
      var sum = 0;
      for (var i = 0; i < tdData.length; i++) { var d = tdData[i] - 128; sum += d * d; }
      var rms = Math.sqrt(sum / tdData.length) / 128;
      if (rms > 0.004) analyserAlive = true;
      if (analyserAlive) {
        target = Math.min(1, rms * 3.4);
      } else if (now - speakStart > 600) {
        target = null; // analyser silent — use synthetic
      } else {
        target = 0;    // grace period while playback ramps up
      }
    } else {
      target = null;
    }
    if (target === null) {
      // synthetic envelope: speech-like random walk
      synthAmp += (Math.random() - 0.5) * 0.22;
      synthAmp = Math.max(0.08, Math.min(0.72, synthAmp));
      target = synthAmp * (0.6 + 0.4 * Math.abs(Math.sin(now / 140)));
    }
    // fast attack, slower release
    ampSm = target > ampSm ? ampSm * 0.45 + target * 0.55 : ampSm * 0.88;
    return ampSm;
  }

  function spawnRipple(now, amp) {
    if (now - lastRipple < 120 || amp < 0.14) return;
    lastRipple = now;
    var r = document.createElement("div");
    r.className = "ripple";
    r.style.setProperty("--rs", (1.9 + amp * 2.3).toFixed(2));
    coreEl.appendChild(r);
    setTimeout(function () { r.remove(); }, 1100);
  }

  function playSequence(i) {
    clearTimers(); stopAudio();
    setState(STATE.LISTENING);
    later(function () {
      setState(STATE.PROCESSING);
      later(function () { beginSpeak(i); }, PROCESS_MS);
    }, LISTEN_MS);
  }
  function beginSpeak(i) {
    setState(STATE.SPEAKING);
    speakStart = performance.now();
    transcriptEl.textContent = transcripts[i] || IDLE_LINE;
    var clip = clips[i];
    if (clip) {
      initAudioGraph();
      wireClip(clip);
      current = clip.audio; current.currentTime = 0;
      var p = current.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      later(onSpeakEnd, NO_AUDIO_SPEAK_MS);
    }
  }
  function onSpeakEnd() {
    current = null;
    setState(STATE.IDLE);
    transcriptEl.textContent = IDLE_LINE;
  }

  function next() {
    if (!totalPhrases()) return;
    if (idx >= totalPhrases()) idx = 0;
    playSequence(idx);
    idx++; updateCounter();
  }
  function back() {
    if (!totalPhrases()) return;
    idx = Math.max(0, idx - 1);
    playSequence(idx);
    updateCounter();
  }
  function reset() {
    clearTimers(); stopAudio(); idx = 0;
    setState(STATE.IDLE);
    transcriptEl.textContent = IDLE_LINE;
    updateCounter();
  }
  function forceState(s) {
    clearTimers(); stopAudio();
    if (s === STATE.SPEAKING) transcriptEl.textContent = transcripts[Math.max(0, idx - 1)] || IDLE_LINE;
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
      case "KeyO":      e.preventDefault(); cycleRotation(); break;
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
      var el2 = document.documentElement;
      (el2.requestFullscreen || el2.webkitRequestFullscreen || function () {}).call(el2);
    } else { document.exitFullscreen(); }
  }

  /* cursor auto-hide */
  var cursorTimer;
  function pokeCursor() {
    body.classList.remove("hide-cursor");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () { body.classList.add("hide-cursor"); }, 2500);
  }
  window.addEventListener("mousemove", pokeCursor); pokeCursor();

  /* =========================================================
     TELEMETRY  (cosmetic — this is a prop)
     ========================================================= */
  function drift(v, step, lo, hi) {
    v += (Math.random() - 0.5) * step;
    return Math.max(lo, Math.min(hi, v));
  }

  // EKG
  var ekg = document.getElementById("ekgLine");
  var EKG_W = 300, EKG_H = 42, EKG_N = 90, ekgData = [], beat = 0;
  for (var i0 = 0; i0 < EKG_N; i0++) ekgData.push(EKG_H / 2);
  setInterval(function () {
    ekgData.shift();
    var y = EKG_H / 2 + (Math.random() - 0.5) * 3;
    beat = (beat + 1) % 24;
    if (beat === 0) y = 5; else if (beat === 1) y = EKG_H - 6; else if (beat === 2) y = EKG_H / 2;
    ekgData.push(y);
    var pts = "";
    for (var j = 0; j < EKG_N; j++) pts += (j / (EKG_N - 1) * EKG_W).toFixed(1) + "," + ekgData[j].toFixed(1) + " ";
    ekg.setAttribute("points", pts.trim());
  }, 90);

  // diagnostics rows
  var cpuEl = document.getElementById("cpu"), memEl = document.getElementById("memPct");
  var tempEl = document.getElementById("coreTemp"), netEl = document.getElementById("netRate");
  var procEl = document.getElementById("procs"), upEl = document.getElementById("uptime");
  var mem = 46, coreTemp = 31, procs = 112;
  var upStart = Date.now() - ((7 * 3600) + (42 * 60) + 11) * 1000;
  setInterval(function () {
    var busyState = (waveMode === STATE.PROCESSING || waveMode === STATE.SPEAKING);
    cpuEl.textContent = Math.round((busyState ? 38 : 8) + Math.random() * (busyState ? 40 : 9)) + "%";
    mem = drift(mem, 4, 38, 62); memEl.textContent = Math.round(mem) + "%";
    coreTemp = drift(coreTemp, 0.6, 29, 36); tempEl.textContent = coreTemp.toFixed(0) + "°C";
    netEl.textContent = (0.8 + Math.random() * 0.9).toFixed(1) + " Gbps";
    if (Math.random() < 0.3) procs = Math.round(drift(procs, 6, 98, 130));
    procEl.textContent = procs;
    var s = Math.floor((Date.now() - upStart) / 1000);
    upEl.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
  }, 1400);

  // environment + power
  var envTempEl = document.getElementById("envTemp"), envHumEl = document.getElementById("envHum");
  var envCo2El = document.getElementById("envCo2");
  var wxTempEl = document.getElementById("wxTemp"), wxIconEl = document.getElementById("wxIcon");
  var batteryEl = document.getElementById("battery"), powerEl = document.getElementById("power");
  var reserveEl = document.getElementById("reserve"), devicesEl = document.getElementById("devices");
  var envTemp = 21.3, envHum = 42, co2 = 612, wx = 72, battery = 78, kw = 1.4, devices = 12;
  var WX_ICONS = ["☀", "⛅", "☁", "🌧"]; var wxc = 1;
  setInterval(function () {
    envTemp = drift(envTemp, 0.3, 20.2, 23.1); envTempEl.textContent = envTemp.toFixed(1) + "°C";
    envHum = drift(envHum, 1.4, 38, 47); envHumEl.textContent = Math.round(envHum) + "%";
    co2 = drift(co2, 14, 540, 720); envCo2El.textContent = Math.round(co2) + " ppm";
    wx = drift(wx, 1.2, 58, 84); wxTempEl.textContent = Math.round(wx);
    if (Math.random() < 0.12) { wxc = (wxc + 1) % WX_ICONS.length; wxIconEl.textContent = WX_ICONS[wxc]; }
    battery = drift(battery, 0.4, 74, 82); batteryEl.textContent = Math.round(battery) + "%";
    kw = drift(kw, 0.2, 0.9, 2.2); powerEl.textContent = kw.toFixed(1) + " kW";
    reserveEl.textContent = (battery * 0.08).toFixed(1) + " kWh";
    if (Math.random() < 0.15) { devices = Math.round(drift(devices, 2, 11, 14)); devicesEl.textContent = devices; }
  }, 3000);

  // mirrored real-time waveform (heights in % of its container)
  var wave = document.getElementById("wave");
  var WAVE_BARS = 96;
  for (var w0 = 0; w0 < WAVE_BARS; w0++) wave.appendChild(document.createElement("span"));
  (function animateWave() {
    var now = performance.now();
    bgDraw(now);
    var bars = wave.children, t = now / 190;
    var mid = (WAVE_BARS - 1) / 2;
    var speaking = waveMode === STATE.SPEAKING;

    // amplitude drives the nucleus while speaking; eases back to rest otherwise
    var amp = 0;
    if (speaking) {
      amp = currentAmp(now);
      spawnRipple(now, amp);
    } else {
      ampSm *= 0.90;
      amp = ampSm;
    }
    gNucleus.style.transform = "scale(" + (1 + amp * 0.85).toFixed(3) + ")";

    for (var m = 0; m < bars.length; m++) {
      var falloff = 1 - Math.pow(Math.abs(m - mid) / mid, 1.6);  // taper at edges
      var h;
      if (speaking)
        h = 6 + falloff * (0.35 + amp * 2.1) * Math.abs(Math.sin(t + m * 0.55)) * (26 + Math.random() * 30);
      else if (waveMode === STATE.PROCESSING)
        h = 5 + falloff * Math.abs(Math.sin(t * 0.9 + m)) * (14 + Math.random() * 14);
      else if (waveMode === STATE.LISTENING)
        h = 5 + falloff * Math.abs(Math.sin(t * 1.5 + m * 0.3)) * 22;
      else
        h = 3 + falloff * Math.abs(Math.sin(t * 0.32 + m * 0.4)) * 6;
      bars[m].style.height = Math.min(100, h).toFixed(1) + "%";
    }
    requestAnimationFrame(animateWave);
  })();

  /* =========================================================
     TOAST
     ========================================================= */
  function toast(msg, isErr) {
    var el3 = document.createElement("div");
    el3.className = "toast" + (isErr ? " err" : "");
    el3.textContent = msg;
    stage.appendChild(el3);
    requestAnimationFrame(function () { el3.classList.add("show"); });
    setTimeout(function () { el3.classList.remove("show"); setTimeout(function () { el3.remove(); }, 400); }, 3800);
  }

  /* GO */
  applyLayout();
  setState(STATE.IDLE);
  discover();
})();
