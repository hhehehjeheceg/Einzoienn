"""Concat the 3 lossless chunks, mux the mastered audio, encode the delivery MP4 and check the frame count."""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
(OUT / "list.txt").write_text("".join(f"file 'c{i}.mkv'\n" for i in range(3)))
subprocess.run([
    "ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(OUT / "list.txt"), "-i", str(OUT / "mix.wav"),
    "-map", "0:v", "-map", "1:a",
    "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-color_range", "tv", "-colorspace", "bt709",
    "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(HERE / "auto-cles-minutes.mp4"),
], check=True)
n = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames",
                    "-of", "csv=p=0", str(HERE / "auto-cles-minutes.mp4")], capture_output=True, text=True).stdout.strip()
print("frames:", n, "(expected 1800)")
