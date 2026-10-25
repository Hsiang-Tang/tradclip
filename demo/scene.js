// Draws one frame of the demo film as a pure function of time (specs/002-demo-film).
// The renderer calls film.load(timeline) once, then film.seek(t) for every frame.
"use strict";

const $ = (id) => document.getElementById(id);
let T = null;
const targets = {}, shots = {};
// Shots frame their window inside the area above the keycaps, at most 1.6x.
const SAFE = { cx: 960, cy: 445, w: 1800, h: 790 }, MAX_SCALE = 1.6;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const fade = (t, a, b, d = 0.3) => Math.min(ease((t - a) / d), 1 - ease((t - b) / d));
const lerp = (a, b, u) => a + (b - a) * u;

function spans(parent, text, build) {
  parent.innerHTML = "";
  return [...text].map((ch, i) => {
    const s = document.createElement("span");
    build ? build(s, ch, i) : (s.textContent = ch);
    parent.appendChild(s);
    return s;
  });
}

function center(el, dx = 0, dy = 0) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy };
}

let dictated = [], clip = [], pasted = [], waveBars = [], charRects = [];

function build() {
  dictated = spans($("dictated"), T.simplified);
  clip = spans($("cliptext"), T.simplified, (s, ch, i) => {
    s.innerHTML = T.changed.includes(i)
      ? `<span class="old">${ch}</span><span class="new">${[...T.traditional][i]}</span>`
      : ch;
  });
  pasted = spans($("pasted"), T.traditional, (s, ch, i) => {
    s.textContent = ch;
    if (T.changed.includes(i)) s.classList.add("changed");
  });
  const wave = $("wave");
  for (let i = 0; i < 9; i++) waveBars.push(wave.appendChild(document.createElement("span")));
  for (const id of ["cmd", "c", "v"]) {
    const k = document.createElement("div");
    k.className = "k";
    k.id = `key-${id}`;
    k.textContent = id === "cmd" ? "⌘" : id.toUpperCase();
    $("keys").appendChild(k);
  }
  // Pointer targets and shots, measured once in world coordinates (camera at rest, every character laid out).
  targets.rest = { x: 980, y: 900 };
  targets.mic = center($("mic"), 4, 6);
  charRects = dictated.map((s) => s.getBoundingClientRect());
  const first = charRects[0], last = charRects[charRects.length - 1];
  const lineEnd = charRects.filter((r) => r.top === first.top).pop();
  const mid = (r) => r.top + r.height / 2;
  targets.textStart = { x: first.left - 2, y: mid(first) };
  targets.textEnd = { x: last.right + 2, y: mid(last) };
  // The drag runs along the first line, then down to the end of the second.
  targets.drag = [targets.textStart, { x: lineEnd.right + 2, y: mid(first) }, targets.textEnd];
  targets.term = center($("termbody"), 60, 90);
  const box = (ids, pad) => {
    const rs = ids.map((id) => $(id).getBoundingClientRect());
    const x0 = Math.min(...rs.map((r) => r.left)) - pad, x1 = Math.max(...rs.map((r) => r.right)) + pad;
    const y0 = Math.min(...rs.map((r) => r.top)) - pad, y1 = Math.max(...rs.map((r) => r.bottom)) + pad;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(MAX_SCALE, SAFE.w / (x1 - x0), SAFE.h / (y1 - y0)) };
  };
  shots.wide = { cx: SAFE.cx, cy: SAFE.cy, s: 1 };
  shots.chat = box(["composer"], 24);
  shots.clip = box(["clip", "tray"], 16);
  shots.term = box(["term"], 0);
}

function cameraAt(t) {
  let cam = shots.wide;
  for (const move of T.camera) {
    if (t < move.t) break;
    const to = shots[move.shot], u = ease((t - move.t) / move.d);
    cam = { cx: lerp(cam.cx, to.cx, u), cy: lerp(cam.cy, to.cy, u), s: cam.s * (to.s / cam.s) ** u };
  }
  // Never show past the edge of the desktop.
  const tx = clamp(SAFE.cx - cam.cx * cam.s, 1920 * (1 - cam.s), 0);
  const ty = clamp(SAFE.cy - cam.cy * cam.s, 1080 * (1 - cam.s), 0);
  return { s: cam.s, tx, ty };
}

function along(pts, u) {
  const len = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let d = u * len.reduce((a, b) => a + b, 0), i = 0;
  while (i < len.length - 1 && d > len[i]) d -= len[i++];
  const k = len[i] ? clamp(d / len[i], 0, 1) : 1;
  return { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) };
}

// Characters a drag from the first character to `pt` selects, in reading order.
function selectedTo(pt) {
  let n = 0;
  for (const r of charRects) {
    if (pt.y > r.bottom || (pt.y >= r.top && pt.x > r.left + r.width / 2)) n++;
    else break;
  }
  return n;
}

function pointerAt(t) {
  const m = T.mouse;
  let i = 0;
  while (i < m.length - 1 && m[i + 1].t <= t) i++;
  const a = m[i], b = m[Math.min(i + 1, m.length - 1)];
  const pa = targets[a.at], pb = targets[b.at];
  const u = b.t > a.t ? ease((t - a.t) / (b.t - a.t)) : 1;
  if (a.at === "textStart" && b.at === "textEnd") return along(targets.drag, u);
  return { x: lerp(pa.x, pb.x, u), y: lerp(pa.y, pb.y, u) };
}

function shown(t) {
  return T.dictation.filter((d) => d.t <= t).reduce((n, d) => Math.max(n, d.upto), 0);
}

function seek(t) {
  // Dictation: characters appear in phrases; the placeholder leaves with the first.
  const n = shown(t);
  dictated.forEach((s, i) => (s.style.visibility = i < n ? "visible" : "hidden"));
  $("placeholder").style.opacity = n > 0 ? 0 : 1;
  const rec = t >= T.recording[0] && t < T.recording[1];
  $("mic").style.background = rec ? "#f6dcc4" : "#efece5";
  waveBars.forEach((b, i) => {
    const h = rec ? 6 + 22 * Math.abs(Math.sin(t * 9 + i * 1.7) * Math.sin(t * 4.3 + i)) : 4;
    b.style.height = `${h.toFixed(1)}px`;
    b.style.opacity = rec ? 1 : 0;
  });

  // Selection: what the drag has reached so far. A drag never gives characters back.
  const sel = T.select;
  let count = 0;
  if (t >= sel.from) {
    const end = Math.min(t, sel.to);
    for (let k = 0; k <= 24; k++) count = Math.max(count, selectedTo(pointerAt(lerp(sel.from, end, k / 24))));
  }
  dictated.forEach((s, i) => s.classList.toggle("sel", i < count && t < sel.clear));

  // Clipboard card: slides in, characters flip to Traditional one by one.
  const card = $("clip"), c = fade(t, T.card[0], T.card[1], 0.4);
  card.style.opacity = c.toFixed(3);
  card.style.transform = `translateY(${(-24 * (1 - c)).toFixed(1)}px)`;
  T.changed.forEach((idx, k) => {
    const u = ease((t - (T.morph + k * T.morphStep)) / 0.22);
    const s = clip[idx], old = s.querySelector(".old"), nu = s.querySelector(".new");
    old.style.opacity = (1 - u).toFixed(3);
    old.style.transform = `translateY(${(-14 * u).toFixed(1)}px)`;
    nu.style.opacity = u.toFixed(3);
    nu.style.transform = `translateY(${(14 * (1 - u)).toFixed(1)}px)`;
    const glow = u > 0 ? Math.max(0, 1 - (t - (T.morph + k * T.morphStep)) / 0.9) : 0;
    nu.style.color = glow > 0 ? `rgb(${Math.round(lerp(29, 224, glow))}, ${Math.round(lerp(29, 122, glow))}, ${Math.round(lerp(27, 46, glow))})` : "";
  });

  // Menu bar item reacts when the clipboard is converted.
  const pulse = Math.max(0, 1 - Math.abs(t - T.trayPulse) / 0.35);
  $("tray").style.background = pulse > 0 ? `rgba(224, 122, 46, ${(0.9 * pulse).toFixed(3)})` : "transparent";
  $("tray").style.color = pulse > 0.4 ? "#fff" : "var(--ink)";
  $("tray").style.transform = `scale(${(1 + 0.18 * pulse).toFixed(3)})`;

  // Terminal: focused after the click, text appears on paste.
  const pastedNow = t >= T.paste;
  pasted.forEach((s, i) => {
    s.style.display = pastedNow ? "" : "none";
    let f = s.querySelector(".flash");
    if (T.changed.includes(i)) {
      if (!f) { f = document.createElement("span"); f.className = "flash"; s.appendChild(f); }
      f.style.opacity = pastedNow ? (0.6 * Math.max(0, 1 - (t - T.paste) / 1.2)).toFixed(3) : 0;
    }
  });
  const focused = t >= T.termFocus;
  const caretOn = focused && Math.floor(t * 1.8) % 2 === 0;
  $("tcaret").style.background = caretOn ? "#e9e6dd" : "transparent";
  $("term").style.borderColor = focused ? "#55534d" : "#2b2b28";

  // Keycaps.
  for (const id of ["cmd", "c", "v"]) {
    const k = $(`key-${id}`);
    const group = T.keyGroups.find((g) => g.keys.includes(id) && t >= g.show[0] - 0.3 && t < g.show[1] + 0.3);
    k.style.display = group ? "" : "none";
    if (group) {
      k.style.opacity = fade(t, group.show[0], group.show[1], 0.25).toFixed(3);
      k.classList.toggle("down", T.presses.some((p) => p.key === id && t >= p.t && t < p.up));
    }
  }

  // Captions.
  let text = "", alpha = 0;
  for (const cap of T.captions) {
    if (t >= cap.t - 0.3 && t < cap.end + 0.3) { text = cap.text; alpha = fade(t, cap.t, cap.end, 0.3); }
  }
  $("caption").textContent = text;
  $("caption").style.opacity = alpha.toFixed(3);

  // Camera on the windows; pointer, keycaps and captions stay in screen space.
  const cam = cameraAt(t);
  $("world").style.transform = `translate(${cam.tx.toFixed(2)}px, ${cam.ty.toFixed(2)}px) scale(${cam.s.toFixed(4)})`;

  // Pointer and click ring.
  const wpt = pointerAt(t), pt = { x: wpt.x * cam.s + cam.tx, y: wpt.y * cam.s + cam.ty };
  // Over text the pointer is an I-beam, centred on the hot spot.
  const overText = t >= T.ibeam[0] && t < T.ibeam[1];
  $("pointer").style.transform = `translate(${(pt.x - 3).toFixed(1)}px, ${(pt.y - 2).toFixed(1)}px)`;
  $("ibeam").style.transform = `translate(${(pt.x - 11).toFixed(1)}px, ${(pt.y - 24).toFixed(1)}px) scale(${cam.s.toFixed(3)})`;
  $("pointer").style.visibility = overText ? "hidden" : "visible";
  $("ibeam").style.visibility = overText ? "visible" : "hidden";
  const click = T.clicks.filter((c) => t >= c.t && t < c.t + 0.45).pop();
  const r = click ? (t - click.t) / 0.45 : 1;
  $("ring").style.opacity = click ? (0.8 * (1 - r)).toFixed(3) : 0;
  $("ring").style.transform = `translate(${(pt.x - 22).toFixed(1)}px, ${(pt.y - 22).toFixed(1)}px) scale(${(0.4 + 0.9 * r).toFixed(3)})`;
  $("pointer").style.opacity = (1 - ease((t - T.endCard) / 0.4)).toFixed(3);
  $("ibeam").style.opacity = $("pointer").style.opacity;

  $("end").style.opacity = ease((t - T.endCard) / 0.7).toFixed(3);
}

window.film = {
  load(timeline) {
    T = timeline;
    build();
    seek(0);
  },
  seek,
  // QA (DF-7): text inside its box; the window a settled shot frames, and the keycaps, inside the frame.
  qa(t) {
    const out = [];
    const inside = (el, box, name) => {
      const range = document.createRange(); range.selectNodeContents(el);
      const r = range.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.width && (r.right > b.right - 12 || r.bottom > b.bottom - 8)) out.push(`${name} overflows`);
    };
    inside($("dictated"), $("composer"), "dictation");
    inside($("cliptext"), $("clip"), "clipboard");
    inside($("termbody"), $("term"), "terminal");
    const settled = T.camera.filter((m) => t >= m.t + m.d).pop();
    const moving = T.camera.some((m) => t >= m.t && t < m.t + m.d);
    const framed = moving ? [] : { wide: ["chat", "clip", "term"], chat: ["composer"], clip: ["clip"], term: ["term"] }[settled ? settled.shot : "wide"];
    for (const id of [...framed, "keys"]) {
      const r = $(id).getBoundingClientRect();
      if (r.left < 0 || r.right > 1920 || r.top < 0 || r.bottom > 1080) out.push(`${id} outside frame`);
    }
    const cap = $("caption").getBoundingClientRect();
    if ($("caption").textContent && cap.right > 1920 - 60) out.push("caption too long");
    return out;
  },
};
