import math
import struct
import os
import random
import subprocess

os.makedirs('public/audio', exist_ok=True)
sample_rate = 44100
duration = 20.0  # 20 seconds loop

def write_mp3(filename, generator):
    raw_path = f'/tmp/{filename}.raw'
    num_samples = int(duration * sample_rate)
    with open(raw_path, 'wb') as f:
        # Pre-seed random for deterministic generation
        random.seed(42)
        for i in range(num_samples):
            t = i / sample_rate
            val = generator(t, i)
            val = max(-0.95, min(0.95, val))
            sample = int(val * 32767)
            f.write(struct.pack('<h', sample))
    out_path = os.path.join('public/audio', filename)
    subprocess.run([
        'ffmpeg', '-y', '-f', 's16le', '-ar', str(sample_rate), '-ac', '1',
        '-i', raw_path, '-b:a', '128k', out_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(raw_path):
        os.remove(raw_path)
    print(f'Created {out_path} ({os.path.getsize(out_path)} bytes)')

# 1. Forest Sunlight Melody
def gen_forest(t, i):
    # Warm analog synth pad (C maj9: C, E, G, B, D)
    chord = (
        0.18 * math.sin(2 * math.pi * 130.81 * t) +
        0.14 * math.sin(2 * math.pi * 164.81 * t) +
        0.12 * math.sin(2 * math.pi * 196.00 * t) +
        0.08 * math.sin(2 * math.pi * 246.94 * t)
    )
    # Subtle chorus LFO
    lfo = 1.0 + 0.05 * math.sin(2 * math.pi * 0.2 * t)
    chord *= lfo
    
    # Wind chimes
    chimes = 0.0
    chime_notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]
    for idx, note in enumerate(chime_notes):
        step = (t - idx * 3.8) % 20.0
        if 0 <= step < 2.5:
            decay = math.exp(-step * 2.2)
            chimes += 0.15 * decay * math.sin(2 * math.pi * note * step)
    return chord * 0.6 + chimes * 0.4

# 2. Dewdrop Stream Flow
def gen_stream(t, i):
    # Water stream: filtered white noise + gentle bubbling sines
    noise = (random.random() * 2 - 1) * 0.15
    # Bubbles
    bubble = 0.0
    bubble_times = [0.4, 1.2, 2.1, 2.9, 3.7, 4.6, 5.8, 6.7, 7.5, 8.9, 10.2, 11.8, 13.5, 15.0, 16.8, 18.2]
    for b_time in bubble_times:
        diff = (t - b_time) % 20.0
        if 0 <= diff < 0.15:
            f = 450 + 250 * (diff / 0.15)
            env = math.sin(math.pi * (diff / 0.15))
            bubble += 0.22 * env * math.sin(2 * math.pi * f * diff)
    
    # Stream water body (low/mid frequency resonance)
    body = 0.18 * math.sin(2 * math.pi * 180 * t + math.sin(2 * math.pi * 3.5 * t))
    return noise * 0.4 + bubble * 0.45 + body * 0.35

# 3. Rain on Bamboo Canopy
def gen_rain(t, i):
    # Rain texture
    noise = (random.random() * 2 - 1) * 0.18
    # Gentle bamboo taps
    drops = 0.0
    for tap_t in [0.2, 0.7, 1.5, 2.3, 3.1, 4.0, 4.8, 5.7, 6.9, 7.8, 8.6, 9.5, 10.8, 12.0, 13.4, 14.7, 16.2, 17.5, 18.9]:
        d = (t - tap_t) % 20.0
        if 0 <= d < 0.08:
            env = math.exp(-d * 35.0)
            drops += 0.25 * env * math.sin(2 * math.pi * 880 * d)
    # Distant thunder/rumble drone
    drone = 0.12 * math.sin(2 * math.pi * 55 * t) * (0.8 + 0.2 * math.sin(2 * math.pi * 0.1 * t))
    return noise * 0.45 + drops * 0.4 + drone * 0.25

# 4. Morning Songbirds in Garden
def gen_birds(t, i):
    # Morning atmosphere drone
    pad = 0.12 * math.sin(2 * math.pi * 220 * t) + 0.08 * math.sin(2 * math.pi * 330 * t)
    # Bird chirps (frequency modulated bursts)
    chirps = 0.0
    bird_times = [1.0, 1.4, 3.5, 4.0, 6.2, 7.0, 9.8, 10.3, 12.5, 13.1, 15.6, 16.2, 18.5]
    for b_idx, bt in enumerate(bird_times):
        dt = (t - bt) % 20.0
        if 0 <= dt < 0.25:
            base_f = 2200 if b_idx % 2 == 0 else 2800
            f = base_f + 800 * math.sin(2 * math.pi * 8 * dt)
            env = math.sin(math.pi * (dt / 0.25))
            chirps += 0.22 * env * math.sin(2 * math.pi * f * dt)
    return pad * 0.4 + chirps * 0.6

# 5. Gentle Meadow Breeze
def gen_breeze(t, i):
    # Modulated wind sound
    wind_mod = 0.5 + 0.5 * math.sin(2 * math.pi * 0.15 * t)
    wind_noise = (random.random() * 2 - 1) * (0.15 * wind_mod)
    # Warm acoustic bells/harp resonance
    bells = 0.0
    for idx, f in enumerate([392.00, 440.00, 523.25, 587.33, 659.25]):
        bt = (t - idx * 4.0) % 20.0
        if 0 <= bt < 3.0:
            env = math.exp(-bt * 1.5)
            bells += 0.15 * env * math.sin(2 * math.pi * f * bt)
    return wind_noise * 0.45 + bells * 0.55

write_mp3('forest-sunlight-melody.mp3', gen_forest)
write_mp3('dewdrop-stream-flow.mp3', gen_stream)
write_mp3('rain-bamboo-canopy.mp3', gen_rain)
write_mp3('morning-songbirds.mp3', gen_birds)
write_mp3('gentle-meadow-breeze.mp3', gen_breeze)
