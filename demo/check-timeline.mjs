// Usage: node demo/check-timeline.mjs [path]
// Checks that the rendered demo timeline obeys its timing and ordering rules.
import fs from "fs";
import path from "path";
import url from "url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const timelinePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, "out", "timeline.json");
const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
const violations = [];
const step = 60 / timeline.bpm / 4;
const onGrid = (t, tol) => Math.abs(t - Math.round(t / step) * step) <= tol;
const fail = (rule, detail) => violations.push(`FAIL R${rule}: ${detail}`);

for (const sound of timeline.sounds) {
  if (!(0 <= sound.t && sound.t < timeline.duration)) {
    fail(1, `sound t=${sound.t} is outside [0, ${timeline.duration})`);
  }
  if (["key-press", "flip", "chime", "sting"].includes(sound.kind) && !onGrid(sound.t, 0.001)) {
    fail(2, `${sound.kind} t=${sound.t} is off grid`);
  }
  if (sound.kind === "mouse-press" && !onGrid(sound.t, 0.07)) {
    fail(3, `mouse-press t=${sound.t} is off grid`);
  }
}

const flips = timeline.sounds.filter((sound) => sound.kind === "flip");
if (flips.length !== timeline.changed.length) {
  fail(4, `found ${flips.length} flips for ${timeline.changed.length} changed characters`);
}
const flipsByStep = new Array(flips.length);
for (const flip of flips) {
  if (!Number.isInteger(flip.step) || flip.step < 0 || flip.step >= flips.length || flipsByStep[flip.step]) {
    fail(4, `flip step=${flip.step} is invalid or duplicated`);
  } else {
    flipsByStep[flip.step] = flip;
  }
}
for (let i = 0; i < flipsByStep.length; i++) {
  if (!flipsByStep[i]) fail(4, `missing flip step=${i}`);
}
for (let i = 0; i + 1 < flipsByStep.length; i++) {
  if (flipsByStep[i] && flipsByStep[i + 1] && flipsByStep[i].t >= flipsByStep[i + 1].t) {
    fail(4, `flip times do not increase at step=${i} t=${flipsByStep[i].t}, step=${i + 1} t=${flipsByStep[i + 1].t}`);
  }
}

if (!(timeline.select.from < timeline.select.to && timeline.select.to < timeline.select.clear)) {
  fail(5, `select times are from=${timeline.select.from}, to=${timeline.select.to}, clear=${timeline.select.clear}`);
}
for (let i = 0; i < timeline.camera.length; i++) {
  const camera = timeline.camera[i];
  if (i > 0 && timeline.camera[i - 1].t > camera.t) {
    fail(6, `camera is unsorted at t=${camera.t}`);
  }
  if (i + 1 < timeline.camera.length && camera.t + camera.d > timeline.camera[i + 1].t) {
    fail(6, `camera move t=${camera.t}, d=${camera.d} overlaps next move at t=${timeline.camera[i + 1].t}`);
  }
}
if (!(timeline.endCard + 1 <= timeline.duration && timeline.gifEnd < timeline.endCard)) {
  fail(7, `endCard=${timeline.endCard}, gifEnd=${timeline.gifEnd}, duration=${timeline.duration}`);
}
for (const event of [...timeline.clicks, ...timeline.presses]) {
  if (!(event.up > event.t)) fail(8, `event t=${event.t}, up=${event.up} does not release after press`);
}

if (violations.length) {
  console.log(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`timeline check: OK (${timeline.sounds.length} sound events)`);
}
