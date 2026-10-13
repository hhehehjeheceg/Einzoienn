"""Master loudness: soft limiter, then two-pass linear loudnorm to -14 LUFS / -1.3 dBTP. out/mix_raw.wav -> out/mix.wav + m4a."""
import json
import re
import subprocess

PRE = "volume=1.6dB,alimiter=limit=0.82:attack=3:release=60:level=false"


def measure(src, af):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", af + ",loudnorm=I=-14:TP=-1.3:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return json.loads(re.search(r"\{[^{}]*\}", r[r.rfind("Parsed_loudnorm"):], re.S).group(0))


j = measure("out/mix_raw.wav", PRE)
af = (PRE + f",loudnorm=I=-14:TP=-1.3:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "out/mix_raw.wav", "-af", af, "-c:a", "pcm_s16le", "out/mix.wav"], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "out/mix.wav", "-c:a", "aac", "-b:a", "256k", "auto-cles-minutes-audio.m4a"], check=True)
k = measure("out/mix.wav", "anull")
print(f"before: {j['input_i']} LUFS / {j['input_tp']} dBTP   after: {k['input_i']} LUFS / {k['input_tp']} dBTP")
