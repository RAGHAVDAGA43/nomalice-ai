/**
 * NoMalice AI — Continuously Growing Circuit-Board Background
 * Renders staggered, pencil-thin silver traces (#A9BAC8) with mint growing tips
 * (#78D8BE) branching at 45°/90° angles from microchips on a fixed full-screen layer.
 */
(() => {
  const canvas = document.getElementById("circuit-bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const COLORS = {
    chipFill: "#0f1a24",
    chipStroke: "#93abae",
    traceSilver: "169, 186, 200", // #A9BAC8
    tipMint: "120, 216, 190"      // #78D8BE
  };

  // 8-direction compass in 45° increments (0 = East, 2 = South, 4 = West, 6 = North)
  const DIRS = [
    { x: 1, y: 0 },
    { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: 0, y: 1 },
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: -1, y: 0 },
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
    { x: 0, y: -1 },
    { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
  ];

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let isMobile = false;
  let chips = [];
  let rootTrees = [];
  let rafId = null;
  let resizeTimer = null;
  let seedCounter = 1337;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wrapDir(d) {
    return ((d % 8) + 8) % 8;
  }

  /**
   * Build a multi-point polyline segment that starts at (x, y) in `dir`,
   * travels `len1`, turns 45° or 90°, and travels `len2` to its end junction.
   */
  function buildElbowSegment(x, y, dir, len1, turnDelta, len2) {
    const v1 = DIRS[wrapDir(dir)];
    const x1 = x + v1.x * len1;
    const y1 = y + v1.y * len1;

    const nextDir = wrapDir(dir + turnDelta);
    const v2 = DIRS[nextDir];
    const x2 = x1 + v2.x * len2;
    const y2 = y1 + v2.y * len2;

    const totalLen = len1 + len2;
    return {
      points: [
        { x, y },
        { x: x1, y: y1 },
        { x: x2, y: y2 }
      ],
      len1,
      len2,
      totalLen,
      endDir: nextDir,
      endX: x2,
      endY: y2
    };
  }

  /**
   * Recursively generates branching segments up to `maxDepth`, splitting into
   * two child branches at each junction (45° or 90° turns).
   */
  function generateBranchTree(startX, startY, startDir, rng, maxDepth, scale, startTime) {
    const segments = [];
    const maxSegments = isMobile ? 7 : 11;

    function addNode(x, y, dir, depth, tStart, parentSectorBias) {
      if (depth > maxDepth || segments.length >= maxSegments) return;

      const baseLen1 = (depth === 0 ? 22 : 18) + rng() * (depth === 0 ? 22 : 20);
      const baseLen2 = 12 + rng() * 18;
      const len1 = baseLen1 * scale;
      const len2 = baseLen2 * scale;

      // Choose 45° (±1) or 90° (±2) turn, preferring 45° like nomalice-circuit.svg
      const turnMag = rng() < 0.72 ? 1 : 2;
      const turnSign = parentSectorBias !== 0
        ? parentSectorBias
        : (rng() < 0.5 ? 1 : -1);
      const turnDelta = turnMag * turnSign;

      const geom = buildElbowSegment(x, y, dir, len1, turnDelta, len2);
      // Keep tips comfortably inside viewport margins unless exiting edge subtly
      const pad = -30;
      if (
        geom.endX < pad ||
        geom.endX > width - pad ||
        geom.endY < pad ||
        geom.endY > height - pad
      ) {
        return;
      }

      const speed = (68 + rng() * 24) * scale; // px per second
      const duration = Math.max(0.45, geom.totalLen / speed);
      const tEnd = tStart + duration;

      segments.push({
        ...geom,
        depth,
        tStart,
        tEnd,
        duration
      });

      if (depth < maxDepth && segments.length < maxSegments) {
        // Split into two child branches starting at exact junction (geom.endX, geom.endY)
        const childATurn = rng() < 0.5 ? 0 : (rng() < 0.5 ? 1 : -1);
        const childBTurn = childATurn === 0
          ? (rng() < 0.5 ? 1 : -1) * (rng() < 0.65 ? 1 : 2)
          : -childATurn * (rng() < 0.6 ? 1 : 2);

        addNode(geom.endX, geom.endY, wrapDir(geom.endDir + childATurn), depth + 1, tEnd, 1);
        if (segments.length < maxSegments && (depth < maxDepth - 1 || rng() < 0.75)) {
          addNode(geom.endX, geom.endY, wrapDir(geom.endDir + childBTurn), depth + 1, tEnd + 0.04, -1);
        }
      }
    }

    addNode(startX, startY, startDir, 0, startTime, 0);

    let maxEnd = startTime + 1.0;
    for (const seg of segments) {
      if (seg.tEnd > maxEnd) maxEnd = seg.tEnd;
    }
    return { segments, growEnd: maxEnd };
  }

  function createChipSpecs() {
    if (isMobile) {
      // Compact irregular layout on mobile: fewer traces, keeping header title open
      return [
        { xNorm: 0.87, yNorm: 0.11, size: 32, pins: [2, 3, 4, 5], maxDepth: 2 },
        { xNorm: 0.08, yNorm: 0.48, size: 30, pins: [0, 1, 2, 6], maxDepth: 2 },
        { xNorm: 0.90, yNorm: 0.76, size: 32, pins: [4, 5, 6], maxDepth: 2 },
        { xNorm: 0.16, yNorm: 0.91, size: 28, pins: [0, 6, 7], maxDepth: 2 }
      ];
    }

    // Irregular desktop layout across left/right margins and between-section lanes,
    // leaving open breathing space around the upper-left header title
    return [
      { xNorm: 0.90, yNorm: 0.14, size: 42, pins: [2, 3, 4, 5, 6], maxDepth: 3 },
      { xNorm: 0.07, yNorm: 0.29, size: 38, pins: [0, 1, 2, 6, 7], maxDepth: 3 },
      { xNorm: 0.92, yNorm: 0.47, size: 40, pins: [2, 3, 4, 5, 6], maxDepth: 3 },
      { xNorm: 0.06, yNorm: 0.59, size: 38, pins: [0, 1, 2, 6], maxDepth: 3 },
      { xNorm: 0.88, yNorm: 0.81, size: 40, pins: [3, 4, 5, 6], maxDepth: 3 },
      { xNorm: 0.09, yNorm: 0.85, size: 36, pins: [0, 6, 7], maxDepth: 3 }
    ];
  }

  /**
   * Compute chip geometry + pins matching nomalice-circuit.svg aesthetic.
   */
  function buildChip(spec) {
    const cx = Math.round(spec.xNorm * width);
    const cy = Math.round(spec.yNorm * height);
    const s = spec.size;
    const half = s / 2;
    const pinLen = 5;
    const offsets = isMobile ? [-7, 7] : [-10, 0, 10];

    const pinLines = [];
    const pinTips = [];

    // Right side (dir 0), Bottom (dir 2), Left (dir 4), Top (dir 6)
    const sides = [
      { dir: 0, dx: 1, dy: 0, perpX: 0, perpY: 1 },
      { dir: 2, dx: 0, dy: 1, perpX: 1, perpY: 0 },
      { dir: 4, dx: -1, dy: 0, perpX: 0, perpY: 1 },
      { dir: 6, dx: 0, dy: -1, perpX: 1, perpY: 0 }
    ];

    for (const side of sides) {
      for (const off of offsets) {
        const sx = cx + side.dx * half + side.perpX * off;
        const sy = cy + side.dy * half + side.perpY * off;
        const ex = sx + side.dx * pinLen;
        const ey = sy + side.dy * pinLen;
        pinLines.push({ sx, sy, ex, ey });
        pinTips.push({ x: ex, y: ey, dir: side.dir, off });
      }
    }

    return { cx, cy, s, half, pinLines, pinTips, maxDepth: spec.maxDepth, allowedDirs: spec.pins };
  }

  function buildTreeForSlot(slot, phaseOffsetSec, nowSec) {
    const rng = mulberry32(++seedCounter * 7919);
    const scale = isMobile ? 0.82 : Math.min(1.22, Math.max(0.92, width / 1280));

    // Slightly jitter pin direction by ±45° occasionally or keep cardinal pin exit
    const { segments, growEnd } = generateBranchTree(
      slot.pin.x,
      slot.pin.y,
      slot.pin.dir,
      rng,
      slot.maxDepth,
      scale,
      0
    );

    const holdDur = 4.2 + rng() * 3.2;
    const fadeDur = 3.2 + rng() * 2.0;
    const pauseDur = 0.6 + rng() * 1.2;
    const totalCycle = growEnd + holdDur + fadeDur + pauseDur;

    return {
      slot,
      segments,
      growEnd,
      holdEnd: growEnd + holdDur,
      fadeEnd: growEnd + holdDur + fadeDur,
      totalCycle,
      cycleStart: nowSec - phaseOffsetSec
    };
  }

  function rebuildScene() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    isMobile = width <= 768;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const specs = createChipSpecs();
    chips = specs.map(buildChip);

    const slots = [];
    for (const chip of chips) {
      // Pick ~1-2 pins per active side so branches stay clean and bounded
      const chosenBySide = new Map();
      for (const tip of chip.pinTips) {
        if (!chip.allowedDirs.includes(tip.dir) && !chip.allowedDirs.includes(wrapDir(tip.dir - 1))) {
          continue;
        }
        const list = chosenBySide.get(tip.dir) || [];
        list.push(tip);
        chosenBySide.set(tip.dir, list);
      }

      for (const [, list] of chosenBySide.entries()) {
        if (list.length === 0) continue;
        // On desktop pick up to 2 spaced pins on main sides; on mobile pick 1
        if (!isMobile && list.length >= 3) {
          slots.push({ pin: list[0], maxDepth: chip.maxDepth });
          slots.push({ pin: list[2], maxDepth: chip.maxDepth });
        } else {
          const mid = list[Math.floor(list.length / 2)];
          slots.push({ pin: mid, maxDepth: chip.maxDepth });
        }
      }
    }

    const nowSec = performance.now() / 1000;
    const totalSlots = Math.max(1, slots.length);
    rootTrees = slots.map((slot, idx) => {
      // Stagger initial phases evenly across the lifecycle so every scroll band
      // always has active growing mint tips + silver trails + fading older traces
      const avgCycle = 12.5;
      const stagger = ((idx * 3.7) % totalSlots) / totalSlots * avgCycle;
      return buildTreeForSlot(slot, stagger, nowSec);
    });
  }

  function pointAlongSegment(seg, progress) {
    const dist = Math.max(0, Math.min(1, progress)) * seg.totalLen;
    const [p0, p1, p2] = seg.points;
    if (dist <= seg.len1) {
      const t = seg.len1 > 0 ? dist / seg.len1 : 1;
      return {
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
        passedCorner: false
      };
    }
    const rem = dist - seg.len1;
    const t = seg.len2 > 0 ? rem / seg.len2 : 1;
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      passedCorner: true
    };
  }

  function drawPartialSegment(seg, startFrac, endFrac) {
    const startPt = pointAlongSegment(seg, startFrac);
    const endPt = pointAlongSegment(seg, endFrac);
    const corner = seg.points[1];

    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    if (!startPt.passedCorner && endPt.passedCorner) {
      ctx.lineTo(corner.x, corner.y);
    }
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();
    return endPt;
  }

  function drawChips() {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (const chip of chips) {
      const { cx, cy, s, half, pinLines } = chip;
      const innerPad = Math.max(4, Math.round(s * 0.12));
      const innerSize = s - innerPad * 2;

      // Pins
      ctx.strokeStyle = "rgba(169, 186, 200, 0.36)";
      ctx.lineWidth = isMobile ? 1.15 : 1.3;
      ctx.beginPath();
      for (const p of pinLines) {
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(p.ex, p.ey);
      }
      ctx.stroke();

      // Outer chip body
      ctx.fillStyle = COLORS.chipFill;
      ctx.strokeStyle = "rgba(169, 186, 200, 0.42)";
      ctx.lineWidth = isMobile ? 1.3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - half, cy - half, s, s, 4);
      ctx.fill();
      ctx.stroke();

      // Inner die outline
      ctx.strokeStyle = "rgba(169, 186, 200, 0.24)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - half + innerPad, cy - half + innerPad, innerSize, innerSize, 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderFrame(nowMs, staticMode = false) {
    const nowSec = nowMs / 1000;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const baseLineWidth = isMobile ? 1.05 : 1.25;

    for (let i = 0; i < rootTrees.length; i++) {
      let tree = rootTrees[i];
      let elapsed = staticMode ? tree.growEnd + 0.5 : nowSec - tree.cycleStart;

      if (!staticMode && elapsed >= tree.totalCycle) {
        tree = buildTreeForSlot(tree.slot, 0, nowSec);
        rootTrees[i] = tree;
        elapsed = 0;
      }

      // Compute overall tree fade alpha
      let treeAlpha = 1;
      if (!staticMode) {
        if (elapsed > tree.fadeEnd) {
          continue; // brief pause before regenerating
        }
        if (elapsed > tree.holdEnd) {
          const fadeProg = (elapsed - tree.holdEnd) / (tree.fadeEnd - tree.holdEnd);
          treeAlpha = Math.max(0, 1 - fadeProg);
        }
      }

      const silverBaseAlpha = staticMode ? 0.34 : (elapsed <= tree.growEnd ? 0.46 : 0.34);
      const silverAlpha = silverBaseAlpha * treeAlpha;

      for (const seg of tree.segments) {
        if (elapsed <= seg.tStart) continue;

        const prog = staticMode
          ? 1
          : Math.min(1, (elapsed - seg.tStart) / seg.duration);

        // Dim muted silver trace (#A9BAC8)
        ctx.strokeStyle = `rgba(${COLORS.traceSilver}, ${silverAlpha.toFixed(3)})`;
        ctx.lineWidth = baseLineWidth;
        const tipPt = drawPartialSegment(seg, 0, prog);

        // Subtle mint growing tip highlight (#78D8BE) while drawing
        if (!staticMode && prog < 1) {
          const tipSpan = Math.min(prog, Math.min(0.32, 18 / Math.max(1, seg.totalLen)));
          const tailStart = Math.max(0, prog - tipSpan);

          // Soft mint glow trail
          ctx.strokeStyle = `rgba(${COLORS.tipMint}, ${(0.88 * treeAlpha).toFixed(3)})`;
          ctx.lineWidth = baseLineWidth + 0.55;
          drawPartialSegment(seg, tailStart, prog);

          // Bright mint leading spark
          ctx.fillStyle = `rgba(${COLORS.tipMint}, ${(0.28 * treeAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(tipPt.x, tipPt.y, isMobile ? 3.5 : 4.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(${COLORS.tipMint}, ${(0.95 * treeAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(tipPt.x, tipPt.y, isMobile ? 1.5 : 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (seg.depth >= 2 && silverAlpha > 0.08) {
          // Subtle terminal via dot on completed outer endpoints
          ctx.fillStyle = `rgba(${COLORS.traceSilver}, ${(silverAlpha * 0.85).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(seg.endX, seg.endY, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
    drawChips();
  }

  function startAnimation() {
    stopAnimation();
    if (reducedMotionQuery.matches) {
      renderFrame(performance.now(), true);
      return;
    }
    const loop = (ts) => {
      renderFrame(ts, false);
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
  }

  function stopAnimation() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function handleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      rebuildScene();
      if (reducedMotionQuery.matches) {
        renderFrame(performance.now(), true);
      }
    }, 150);
  }

  rebuildScene();
  startAnimation();

  window.addEventListener("resize", handleResize);
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", startAnimation);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(startAnimation);
  }
})();
