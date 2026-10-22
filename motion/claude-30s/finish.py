"""Join the rendered chunks, encode the master (H.264, BT.709 TV range) and mux the score.

    python3 finish.py            -> claude-30s.mp4 + out/contact.png
"""
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
parts = sorted(OUT.glob("part[0-9].mkv"))
(OUT / "parts.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))


def run(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)


# two-pass loudnorm: -14 LUFS integrated, true peak -1.3 dB
LN = "loudnorm=I=-14:TP=-1.3:LRA=11"
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(OUT / "mix_raw.wav"), "-af", LN + ":print_format=json", "-f", "null", "-"],
                   capture_output=True, text=True).stderr
d = json.loads(re.search(r"\{[^{}]*\}", m[m.rfind("Parsed_loudnorm"):]).group(0))
run("-i", str(OUT / "mix_raw.wav"), "-af", f"{LN}:measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}"
    f":measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true", "-ar", "48000", str(OUT / "mix.wav"))
run("-i", str(OUT / "mix.wav"), "-c:a", "aac", "-b:a", "256k", str(HERE / "claude-30s-audio.m4a"))


run("-f", "concat", "-safe", "0", "-i", str(OUT / "parts.txt"), "-i", str(OUT / "mix.wav"),
    "-map", "0:v", "-map", "1:a",
    "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-r", "60",
    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(HERE / "claude-30s.mp4"))
run("-i", str(HERE / "claude-30s.mp4"), "-vf", "fps=2,scale=320:-1,tile=6x10", "-frames:v", "1", str(OUT / "contact.png"))
out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v", "-show_entries", "stream=nb_read_frames",
                      "-show_entries", "format=duration", "-of", "default=nw=1", str(HERE / "claude-30s.mp4")], capture_output=True, text=True).stdout
print(out.strip())
