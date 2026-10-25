"""Audio for the demo film: a quiet synthesized score, synthesized cues, CC0 recorded clicks and keys.
usage: python3 -I demo/music.py TIMELINE.json OUT.wav
Score: a calm F-major pad (Fmaj9 / Dm9 / Bbmaj7 / C6sus, one chord per 2 bars at 90 bpm). Cues from the
timeline's `sounds` list: mouse press and release and key press and release (recordings in sounds/, sources in
sounds/SOURCES.md), a two-note mic on/off blip, a bell arpeggio when the clipboard converts, a soft tick per
flipped character, and an airy swell on paste. Standard library only."""
import array, json, math, os, random, struct, sys, wave

SR = 48000
timeline = json.load(open(sys.argv[1], encoding="utf-8")); out = sys.argv[2]
DUR = float(timeline["duration"]); N = int(round(SR * DUR))
L = array.array("d", bytes(8 * N)); R = array.array("d", bytes(8 * N))
BPM = 90; BAR = 4 * 60 / BPM
TAU = 2 * math.pi
rng = random.Random(25)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
CH = [[41, 48, 52, 55, 57], [38, 45, 48, 53, 57], [46, 53, 57, 60, 62], [48, 55, 60, 62, 65]]  # Fmaj9 Dm9 Bbmaj7 C6sus

def add(start, samples, gl, gr):
    i0 = int(start * SR)
    for k, v in enumerate(samples):
        i = i0 + k
        if i >= N: break
        if i >= 0: L[i] += v * gl; R[i] += v * gr

def pad(m, d, det):
    f1, f2 = TAU * hz(m) * (1 + det) / SR, TAU * hz(m) * (1 - det) / SR
    n = int(d * SR); a, r = 2.0 * SR, 2.5 * SR; o = [0.0] * n
    for k in range(n):
        e = min(1.0, k / a, (n - k) / r)
        o[k] = (math.sin(f1 * k) + math.sin(f2 * k) + 0.25 * math.sin(2 * f1 * k)) * e * (0.88 + 0.12 * math.sin(TAU * 0.09 * k / SR))
    return o

def bell(m, d=1.8, bright=1.4):
    # FM bell: sine carrier with a decaying modulator
    f = TAU * hz(m) / SR; n = int(d * SR); o = [0.0] * n
    for k in range(n):
        t = k / SR
        mod = bright * math.exp(-t * 6) * math.sin(f * 3.5 * k)
        o[k] = math.sin(f * k + mod) * math.exp(-t * 2.6) * min(1.0, t / 0.002)
    return o

def blip(m1, m2):
    # two short soft sines, for the mic switching on (rising) or off (falling)
    o = []
    for m in (m1, m2):
        f = TAU * hz(m) / SR; n = int(0.075 * SR)
        o += [math.sin(f * k) * math.sin(math.pi * k / n) ** 2 for k in range(n)]
    return o

def tick():
    f = TAU * rng.uniform(2300, 2700) / SR; n = int(0.03 * SR)
    return [math.sin(f * k) * math.exp(-k / SR * 160) for k in range(n)]

def swell():
    # low-passed noise rising and falling over 0.35 s, with a soft low body at the end
    n = int(0.42 * SR); y = 0.0; o = [0.0] * n; body = TAU * 140 / SR
    for k in range(n):
        u, t = k / n, k / SR
        y += (0.04 + 0.25 * u) * ((rng.random() * 2 - 1) - y)
        o[k] = y * math.sin(math.pi * min(1.0, u * 1.15)) ** 2
        if t > 0.3:
            o[k] += 0.6 * math.sin(body * k) * math.exp(-(t - 0.3) * 30) * min(1.0, (t - 0.3) / 0.004)
    return o

# score: pad, one chord per two bars
bars = int(DUR / BAR) + 2
for b in range(0, bars, 2):
    c = CH[(b // 2) % 4]
    for j, m in enumerate(c):
        pan = 0.5 + 0.3 * math.sin(j * 1.9)
        add(b * BAR - 0.4, pad(m, 2 * BAR + 2.5, 0.0011 * (j + 1)), 0.016 * (1.2 - pan), 0.016 * (0.2 + pan))

HERE = os.path.dirname(os.path.abspath(__file__))
def load(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2
        ch = w.getnchannels(); raw = array.array("h", w.readframes(w.getnframes()))
    return [raw[i] / 32768 for i in range(0, len(raw), ch)]
def bank(prefix):
    d = os.path.join(HERE, "sounds")
    return [load(os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.startswith(prefix) and f.endswith(".wav")]
def vary(s, spread=0.035):
    # a few percent of pitch and level, so repeated clicks never sound identical
    r = 1 + rng.uniform(-spread, spread); g = 10 ** (rng.uniform(-2.0, 0.5) / 20)
    return [g * s[min(int(k * r), len(s) - 1)] for k in range(int(len(s) / r))]

BANKS = {"mouse-press": bank("mouse-press"), "mouse-release": bank("mouse-release"),
         "key-press": bank("press-"), "key-release": bank("release-")}
LEVEL = {"mouse-press": 0.55, "mouse-release": 0.4, "key-press": 0.6, "key-release": 0.4}

for ev in timeline["sounds"]:
    t, kind = float(ev["t"]), ev["kind"]
    if kind in BANKS:
        g = LEVEL[kind]; pan = 0.45 if kind.startswith("mouse") else 0.55
        add(t, vary(rng.choice(BANKS[kind])), g * 2 * (1 - pan), g * 2 * pan)
    elif kind == "mic-on":
        add(t, blip(81, 88), 0.05, 0.05)
    elif kind == "mic-off":
        add(t, blip(88, 81), 0.045, 0.045)
    elif kind == "chime":
        for i, m in enumerate((84, 88, 91, 96)):
            pan = 0.35 + 0.1 * i
            add(t + i * 0.07, bell(m), 0.045 * (1 - pan) * 2, 0.045 * pan * 2)
    elif kind == "tick":
        add(t, tick(), 0.012, 0.012)
    elif kind == "paste":
        add(t - 0.3, swell(), 0.06, 0.06)

# master: 0.6 s fade in, 2 s fade out, normalise to -3 dBFS
fi, fo = SR * 0.6, SR * 2.0
for i in range(N):
    g = min(1.0, i / fi, (N - i) / fo)
    L[i] *= g; R[i] *= g
peak = max(max(map(abs, L)), max(map(abs, R))) or 1.0
gain = 10 ** (-3 / 20) / peak
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        frames += struct.pack("<hh", int(L[i] * gain * 32767), int(R[i] * gain * 32767))
    w.writeframes(bytes(frames))
print(f"wrote {out} ({DUR:.2f} s, {N} frames, gain {gain:.3f})")
