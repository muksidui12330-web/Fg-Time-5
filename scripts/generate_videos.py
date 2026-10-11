import os
import subprocess

os.makedirs('public/videos', exist_ok=True)

# Generate 3 beautiful 720x1280 8-second vertical MP4 videos with embedded audio
videos = [
    {
        'name': 'forest-stream.mp4',
        'color': '12372A',
        'title': 'Forest Stream in Sunlight',
        'audio': 'public/audio/dewdrop-stream-flow.mp3',
        'filter': 'drawbox=x=40:y=100:w=640:h=1080:color=00C853@0.35:t=fill,drawbox=x=80:y=200:w=560:h=880:color=69F0AE@0.2:t=fill,drawbox=x=160:y=350:w=400:h=580:color=1B5E20@0.4:t=fill'
    },
    {
        'name': 'monstera-leaves.mp4',
        'color': '0B2219',
        'title': 'Rain on Monstera Leaves',
        'audio': 'public/audio/rain-bamboo-canopy.mp3',
        'filter': 'drawbox=x=50:y=80:w=620:h=1120:color=00E676@0.25:t=fill,drawbox=x=120:y=250:w=480:h=780:color=00C853@0.3:t=fill'
    },
    {
        'name': 'waterfall-canopy.mp4',
        'color': '144231',
        'title': 'Gentle Waterfall Canopy',
        'audio': 'public/audio/forest-sunlight-melody.mp3',
        'filter': 'drawbox=x=60:y=60:w=600:h=1160:color=69F0AE@0.25:t=fill,drawbox=x=140:y=180:w=440:h=920:color=00C853@0.35:t=fill'
    }
]

for v in videos:
    out_path = os.path.join('public/videos', v['name'])
    cmd = [
        'ffmpeg', '-y',
        '-f', 'lavfi', '-i', f"color=c={v['color']}:s=720x1280:r=24:d=8",
        '-i', v['audio'],
        '-vf', v['filter'],
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k',
        '-shortest',
        out_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Generated {out_path} ({os.path.getsize(out_path)} bytes)")
