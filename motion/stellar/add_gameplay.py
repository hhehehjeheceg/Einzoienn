"""Drop real gameplay into the two gameplay slots of the film.

    python3 add_gameplay.py A clip_a.mp4 [start_s]   -> slot A, "revivre le Fortnite OG" (26.7 s to 33.3 s, 6.7 s used)
    python3 add_gameplay.py B clip_b.mp4 [start_s]   -> slot B, "va chercher le Top 1" (43.3 s to 46.3 s, 3 s used)
    python3 add_gameplay.py --clear                  -> back to the coded 3D shots

Frames are extracted at 30 fps (the film rate) as JPEGs, so the render stays frame-exact.
Then: python3 build.py, re-render the affected seconds, re-encode.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
GP = HERE / "assets" / "gameplay"
SLOTS = {"A": 6.8, "B": 3.1}

if len(sys.argv) > 1 and sys.argv[1] == "--clear":
    shutil.rmtree(GP, ignore_errors=True)
    print("gameplay removed: the film uses the coded 3D shots")
    sys.exit()
slot, src = sys.argv[1].upper(), Path(sys.argv[2])
start = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
assert slot in SLOTS, "slot must be A or B"
out = GP / slot
shutil.rmtree(out, ignore_errors=True)
out.mkdir(parents=True)
subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(SLOTS[slot]), "-i", str(src),
                "-vf", "fps=30,scale=1280:-2:flags=lanczos", "-q:v", "3", str(out / "f_%04d.jpg")], check=True)
n = len(list(out.glob("f_*.jpg")))
cfg_path = GP / "clips.json"
cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
cfg[slot] = {"dir": f"assets/gameplay/{slot}", "n": n, "fps": 30}
cfg_path.write_text(json.dumps(cfg, indent=1))
print(f"slot {slot}: {n} frames from {src.name} @ {start}s")
