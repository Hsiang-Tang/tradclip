// Demo film director (specs/002-demo-film).
// usage: node demo/render.mjs timeline|qa|stills|video|gif|all
// timeline: converts the dictated sentence with the real `tradclip` and lays out the beats.
// The page draws a frame as a function of time; this script seeks it 1/fps s per frame,
// screenshots it, and ffmpeg encodes the frames with the audio from music.py.
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import url from "url";
import { execFileSync } from "child_process";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(here, "out");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = "ffmpeg";
const FPS = 60;
const SENTENCE = "这版改完之后，记得更新说明文档，然后通知团队一起测试。";
// Dictation arrives phrase by phrase, as voice typing does.
const PHRASES = ["这版", "改完", "之后，", "记得", "更新", "说明", "文档，", "然后", "通知", "团队", "一起", "测试。"];
const mode = process.argv[2] || "all";
fs.mkdirSync(out, { recursive: true });

function convert(text) {
  execFileSync("cargo", ["build", "-q", "--release", "-p", "tradclip-cli"], { cwd: root, stdio: "inherit" });
  return execFileSync(path.join(root, "target/release/tradclip"), { input: text, encoding: "utf8" });
}

function buildTimeline() {
  const traditional = convert(SENTENCE);
  const s = [...SENTENCE], tr = [...traditional];
  if (s.length !== tr.length) throw new Error("conversion changed the length; the scene expects one character per character");
  const changed = s.map((ch, i) => (ch !== tr[i] ? i : -1)).filter((i) => i >= 0);
  if (PHRASES.join("") !== SENTENCE) throw new Error("PHRASES must spell SENTENCE");

  // Beats, in seconds.
  const micOn = 1.2, micOff = 4.75;
  const dictation = [];
  let t = 1.55, upto = 0;
  PHRASES.forEach((p, i) => {
    upto += [...p].length;
    dictation.push({ t: +t.toFixed(3), upto });
    t += 0.2 + (p.endsWith("，") ? 0.22 : 0) + (i % 3) * 0.03;
  });
  const select = { from: 5.8, to: 6.75, clear: 7.75 };
  const card = [7.55, 12.1];
  const morph = 8.15, morphStep = 0.075;
  const paste = 11.12;
  const endCard = 13.7;

  const clicks = [
    { t: micOn, up: micOn + 0.09 },
    { t: micOff, up: micOff + 0.09 },
    { t: select.from - 0.06, up: select.to + 0.12 },
    { t: 10.42, up: 10.51 },
  ];
  const presses = [
    { key: "cmd", t: 7.15, up: 7.62 }, { key: "c", t: 7.3, up: 7.44 },
    { key: "cmd", t: 10.9, up: 11.34 }, { key: "v", t: 11.04, up: 11.18 },
  ];
  const timeline = {
    fps: FPS, duration: +(endCard + 2.4).toFixed(2), endCard, gifEnd: endCard - 0.3,
    simplified: SENTENCE, traditional, changed,
    dictation, recording: [micOn + 0.1, micOff], select, card, morph, morphStep,
    trayPulse: morph - 0.15, termFocus: 10.42, paste,
    clicks, presses,
    keyGroups: [{ keys: ["cmd", "c"], show: [6.95, 7.95] }, { keys: ["cmd", "v"], show: [10.7, 11.7] }],
    mouse: [
      { t: 0, at: "rest" }, { t: 0.45, at: "rest" }, { t: 1.08, at: "mic" }, { t: 4.75, at: "mic" },
      { t: 5.15, at: "mic" }, { t: 5.72, at: "textStart" }, { t: select.from, at: "textStart" },
      { t: select.to, at: "textEnd" }, { t: 9.55, at: "textEnd" }, { t: 10.32, at: "term" },
    ],
    captions: [
      { t: 1.3, end: 4.9, text: "Voice typing comes out Simplified" },
      { t: 5.25, end: 7.7, text: "Copy as usual" },
      { t: 7.95, end: 10.05, text: "tradclip turns the clipboard Traditional" },
      { t: 10.35, end: 13.1, text: "Paste anywhere" },
    ],
    // Sound events for music.py.
    sounds: [
      ...clicks.flatMap((c) => [{ t: c.t, kind: "mouse-press" }, { t: c.up, kind: "mouse-release" }]),
      ...presses.flatMap((p) => [{ t: p.t, kind: "key-press" }, { t: p.up, kind: "key-release" }]),
      { t: micOn + 0.1, kind: "mic-on" }, { t: micOff + 0.05, kind: "mic-off" },
      { t: morph - 0.15, kind: "chime" },
      ...changed.map((_, k) => ({ t: morph + k * morphStep, kind: "tick" })),
      { t: paste - 0.02, kind: "paste" },
    ],
  };
  fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(timeline));
  console.log(`timeline: ${timeline.duration} s, ${changed.length} characters change\n${SENTENCE}\n${traditional}`);
  return timeline;
}

async function withPage(timeline, fn) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--force-color-profile=srgb"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(url.pathToFileURL(path.join(here, "scene.html")).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((tl) => window.film.load(tl), timeline);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

const seek = (page, t) => page.evaluate((x) => window.film.seek(x), t);

async function qa(timeline) {
  const problems = await withPage(timeline, async (page) => {
    const found = [];
    for (let t = 0; t < timeline.endCard; t += 0.1) {
      await seek(page, t);
      for (const p of await page.evaluate(() => window.film.qa())) found.push(`${t.toFixed(1)} s: ${p}`);
    }
    return found;
  });
  console.log(problems.length ? problems.join("\n") : "qa: OK");
  if (problems.length) process.exitCode = 1;
}

async function stills(timeline) {
  const dir = path.join(out, "stills");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const times = [0.6, 1.25, 3.0, 4.8, 6.3, 7.35, 7.8, 8.6, 9.4, 10.45, 11.1, 11.4, 12.5, timeline.endCard + 1.5];
  await withPage(timeline, async (page) => {
    for (const [i, t] of times.entries()) {
      await seek(page, t);
      await page.screenshot({ path: path.join(dir, `s${String(i).padStart(2, "0")}.png`) });
    }
  });
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-pattern_type", "glob", "-i", path.join(dir, "s*.png"),
    "-vf", "scale=640:-1,tile=4x4:padding=6:color=white", "-frames:v", "1", path.join(out, "contact.png")]);
  console.log(`stills: ${times.length} -> out/contact.png`);
}

async function video(timeline) {
  const dir = path.join(out, "frames");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(timeline.duration * timeline.fps);
  await withPage(timeline, async (page) => {
    for (let f = 0; f < n; f++) {
      await seek(page, f / timeline.fps);
      await page.screenshot({ path: path.join(dir, `f${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 94 });
      if (f % 300 === 0) console.log(`frame ${f}/${n}`);
    }
  });
  const silent = path.join(out, "silent.mp4"), audio = path.join(out, "audio.wav");
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(timeline.fps), "-i", path.join(dir, "f%05d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", silent]);
  execFileSync("python3", ["-I", path.join(here, "music.py"), path.join(out, "timeline.json"), audio], { stdio: "inherit" });
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", silent, "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", path.join(out, "tradclip-demo.mp4")]);
  console.log("video: out/tradclip-demo.mp4");
}

function gif(timeline) {
  const silent = path.join(out, "silent.mp4"), palette = path.join(out, "palette.png"), gifOut = path.join(here, "tradclip-demo.gif");
  const vf = "fps=20,scale=960:-1:flags=lanczos";
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-t", String(timeline.gifEnd), "-i", silent, "-vf", `${vf},palettegen=max_colors=64:stats_mode=diff`, palette]);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-t", String(timeline.gifEnd), "-i", silent, "-i", palette,
    "-lavfi", `${vf}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, gifOut]);
  console.log(`gif: ${(fs.statSync(gifOut).size / 1e6).toFixed(2)} MB, ${timeline.gifEnd.toFixed(1)} s`);
}

const timeline = mode === "timeline" || mode === "all" || !fs.existsSync(path.join(out, "timeline.json"))
  ? buildTimeline() : JSON.parse(fs.readFileSync(path.join(out, "timeline.json"), "utf8"));
if (mode === "qa" || mode === "all") await qa(timeline);
if (mode === "stills" || mode === "all") await stills(timeline);
if (mode === "video" || mode === "all") await video(timeline);
if (mode === "gif" || mode === "all") gif(timeline);
