export const CUES = {
  "_doc": "Single timeline for picture and sound. 120 BPM: beat 0.5 s, bar 2 s. tools/audio.py parses this file (JSON after the first '=').",
  "bpm": 120,
  "dur": 30,
  "scene": [0, 3, 7, 12, 17, 22, 26, 30],
  "s1": { "spark": 0.5, "pulse1": 0.62, "spawn0": 0.8, "spawn1": 2.0, "pulse2": 2.0, "formed": 2.9 },
  "s2": { "burst": 3.0, "frag0": 3.38, "fragStep": 0.08, "frags": 12, "shock": 4.5,
          "letter0": 4.72, "letterStep": 0.085, "sub": 5.9, "sweep": 6.15, "antic": 6.75 },
  "s3": { "dive": 7.0, "cross": 7.42, "panels": [7.62, 7.87, 8.12, 8.37, 8.62], "links": 8.85,
          "words": [9.0, 10.0, 11.0], "whip": 11.72 },
  "s4": { "core": 12.0, "modules": [12.5, 12.75, 13.0, 13.25, 13.5, 13.75], "beamLag": 0.22,
          "words": [14.0, 15.0, 16.0], "rise": 16.6 },
  "s5": { "code": 17.0, "codeEnd": 18.2, "wire0": 18.0, "wire1": 19.4, "fill0": 19.4, "fill1": 20.3,
          "spin0": 19.45, "spin1": 20.55, "mat": 20.3, "brake": 20.6, "pulse": 21.0, "text": 21.0 },
  "s6": { "conv0": 22.0, "pull": 23.0, "pulse": 23.5, "burst": 23.6, "slow0": 23.85, "slow1": 24.8,
          "pass": [24.92, 25.12], "cut": 25.4 },
  "s7": { "symbol": 26.0, "word": 27.0, "tag": 27.8, "final": 28.6, "sheen": 28.75 }
};
