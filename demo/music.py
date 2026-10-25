"""Audio for the demo film: a bright synthesized score, synthesized cues, CC0 recorded clicks and keys.
usage: python3 -I demo/music.py TIMELINE.json OUT.wav
Score at the timeline's bpm, one chord per bar in C major (C, Am7, Fmaj7, G, Em7, F-G, C). It builds by section:
bar 0 marimba quarter notes; bars 1-5 marimba eighths with shaker and a short plucked bass; bars 2-5 add a soft
kick; a melody answers the conversion in bars 4-5; bar 6 is the end card, a rolled chord with a bell. Marimba
runs through a ping-pong delay. Cues from the timeline's `sounds` list: mouse press and release and key press and
release (recordings in sounds/, sources in sounds/SOURCES.md), a two-note mic blip, a bell arpeggio when the
clipboard converts, a rising pitched note per flipped character, and an airy swell on paste. Standard library only."""
import array, json, math, os, random, struct, sys, wave

SR = 48000
timeline = json.load(open(sys.argv[1], encoding="utf-8")); out = sys.argv[2]
DUR = float(timeline["duration"]); N = int(round(SR * DUR))
BEAT = 60 / float(timeline["bpm"]); BAR = 4 * BEAT
TAU = 2 * math.pi
rng = random.Random(25)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def buf(): return array.array("d", bytes(8 * N))
L, R = buf(), buf()            # final mix
ML, MR = buf(), buf()          # marimba and melody, sent through the delay
SL, SR_ = buf(), buf()         # rest of the score

def add(dl, dr, start, samples, gl, gr):
    i0 = int(start * SR)
    for k, v in enumerate(samples):
        i = i0 + k
        if i >= N: break
        if i >= 0: dl[i] += v * gl; dr[i] += v * gr

def marimba(m, d=1.0, ring=1.0):
    # bar partials at 1, 3.93 and 9.2 times the fundamental; higher notes die faster
    f = TAU * hz(m) / SR; n = int(d * SR); rate = (2.5 + hz(m) / 220) / ring; o = [0.0] * n
    for k in range(n):
        t = k / SR
        o[k] = (math.sin(f * k) * math.exp(-t * rate) + 0.3 * math.sin(3.93 * f * k) * math.exp(-t * rate * 4)
                + 0.06 * math.sin(9.2 * f * k) * math.exp(-t * rate * 9)) * min(1.0, t / 0.0015)
    return o

def bell(m, d=1.8, bright=1.4):
    # FM bell: sine carrier with a decaying modulator
    f = TAU * hz(m) / SR; n = int(d * SR); o = [0.0] * n
    for k in range(n):
        t = k / SR
        o[k] = math.sin(f * k + bright * math.exp(-t * 6) * math.sin(f * 3.5 * k)) * math.exp(-t * 2.6) * min(1.0, t / 0.002)
    return o

def pluck_bass(m):
    f = TAU * hz(m) / SR; n = int(0.45 * SR)
    return [(math.sin(f * k) + 0.3 * math.sin(2 * f * k)) * math.exp(-k / SR * 7) * min(1.0, k / SR / 0.004) for k in range(n)]

def shaker():
    n = int(0.05 * SR); lp = 0.0; o = [0.0] * n
    for k in range(n):
        x = rng.random() * 2 - 1; lp += 0.3 * (x - lp)
        o[k] = (x - lp) * math.exp(-k / SR * 90) * min(1.0, k / SR / 0.003)
    return o

def kick():
    n = int(0.22 * SR); ph = 0.0; o = [0.0] * n
    for k in range(n):
        t = k / SR; ph += TAU * (48 + 70 * math.exp(-t * 30)) / SR
        o[k] = math.sin(ph) * math.exp(-t * 16)
    return o

def blip(m1, m2):
    # two short soft sines, for the mic switching on (rising) or off (falling)
    o = []
    for m in (m1, m2):
        f = TAU * hz(m) / SR; n = int(0.075 * SR)
        o += [math.sin(f * k) * math.sin(math.pi * k / n) ** 2 for k in range(n)]
    return o

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

# score
CHORDS = {"C": [60, 64, 67, 72], "Am7": [57, 60, 64, 67], "Fmaj7": [60, 64, 65, 69], "G": [59, 62, 67, 71],
          "Em7": [59, 64, 67, 71], "F": [60, 65, 69, 72], "Cend": [64, 67, 72, 76]}
BASS = {"C": 48, "Am7": 45, "Fmaj7": 53, "G": 55, "Em7": 52, "F": 53}
# per bar: (chord for beats 0-1, chord for beats 2-3)
BARS = [("C", "C"), ("Am7", "Am7"), ("Fmaj7", "Fmaj7"), ("G", "G"), ("Em7", "Em7"), ("F", "G")]
ARP = [0, 1, 2, 3, 1, 2, 3, 2]
MELODY = [(4, 1, 83, 1), (4, 2, 79, 0.5), (4, 2.5, 81, 0.5), (4, 3, 83, 1),
          (5, 0, 84, 1), (5, 1, 81, 1), (5, 2, 79, 1), (5, 3, 74, 1), (6, 0, 84, 2.5)]
FLIPS = [71, 74, 76, 79, 83, 86, 88, 91, 95, 98]  # G6 chord tones, rising across the flips
def at(bar, beat): return bar * BAR + beat * BEAT

for b, (first, second) in enumerate(BARS):
    for e in range(8 if b else 4):
        beat = e * (0.5 if b else 1)
        chord = CHORDS[first if beat < 2 else second]
        m = chord[ARP[e] if b else e]
        g = (0.30 if b else 0.34) * (1.0 if e % 2 == 0 else 0.8)
        pan = 0.5 + 0.18 * math.sin(e * 1.3 + b)
        add(ML, MR, at(b, beat), marimba(m), g * (1 - pan) * 2, g * pan * 2)
    if b >= 1:
        for beat, name in ((0, first), (2.5, second)):
            add(SL, SR_, at(b, beat), pluck_bass(BASS[name]), 0.22, 0.22)
        for e in range(8):
            g = 0.05 if e % 2 else 0.028
            add(SL, SR_, at(b, e * 0.5), shaker(), g * 0.8, g * 1.2)
    if b >= 2:
        for beat in (0, 2):
            add(SL, SR_, at(b, beat), kick(), 0.3, 0.3)
for b, beat, m, d in MELODY:
    add(ML, MR, at(b, beat), marimba(m, d=d * BEAT + 1.2, ring=1.8), 0.3, 0.3)
for i, m in enumerate(CHORDS["Cend"] + [84]):
    add(ML, MR, at(6, 0) + i * 0.035, marimba(m, d=2.6, ring=2.2), 0.24, 0.24)

for ev in timeline["sounds"]:
    if ev["kind"] == "flip":
        pan, g = 0.3 + 0.04 * ev["step"], 0.26 * (1 + 0.07 * ev["step"])  # high notes die fast; lift them
        add(ML, MR, float(ev["t"]), marimba(FLIPS[ev["step"]], ring=1.4), g * (1 - pan) * 2, g * pan * 2)

# ping-pong delay on the marimba: dotted eighth, soft feedback, darkened repeats
D = int(0.75 * BEAT * SR); FB = 0.32; WET = 0.28
dl, dr = buf(), buf(); lp_l = lp_r = 0.0
for i in range(D, N):
    lp_l += 0.35 * ((ML[i - D] + MR[i - D]) * 0.5 + FB * dr[i - D] - lp_l); dl[i] = lp_l
    lp_r += 0.35 * (dl[i - D] - lp_r); dr[i] = lp_r
score_peak = max(max(abs(ML[i] + SL[i] + WET * dl[i]), abs(MR[i] + SR_[i] + WET * dr[i])) for i in range(N)) or 1.0
sg = 0.24 / score_peak  # the score peaks well under the clicks
for i in range(N):
    L[i] = (ML[i] + SL[i] + WET * dl[i]) * sg
    R[i] = (MR[i] + SR_[i] + WET * dr[i]) * sg

# cues and recordings
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
        add(L, R, t, vary(rng.choice(BANKS[kind])), g * 2 * (1 - pan), g * 2 * pan)
    elif kind == "mic-on":
        add(L, R, t, blip(79, 84), 0.05, 0.05)
    elif kind == "mic-off":
        add(L, R, t, blip(84, 79), 0.045, 0.045)
    elif kind == "chime":
        for i, m in enumerate((79, 83, 86, 91)):
            pan = 0.35 + 0.1 * i
            add(L, R, t + i * 0.07, bell(m), 0.04 * (1 - pan) * 2, 0.04 * pan * 2)
    elif kind == "sting":
        for i, m in enumerate((84, 88, 91, 96)):
            add(L, R, t + i * 0.035, bell(m, d=2.8, bright=1.0), 0.03, 0.03)
    elif kind == "paste":
        add(L, R, t - 0.3, swell(), 0.06, 0.06)

# master: 0.3 s fade in, 2 s fade out, normalise to -3 dBFS
fi, fo = SR * 0.3, SR * 2.0
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
