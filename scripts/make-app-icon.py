#!/usr/bin/env python3
"""Build Matchcard launcher icons from the intro stack at rest."""
import subprocess
import time
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BG = (244, 239, 228, 255)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SOURCE = ROOT / "scripts" / "icon-source.html"
CAPTURE = Path("/tmp/ffk-icon-src.png")


def capture():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/scripts/icon-source.html"
    urllib.request.urlopen(url, timeout=3).read()
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=2",
            "--window-size=1024,1024",
            f"--screenshot={CAPTURE}",
            "--virtual-time-budget=4000",
            url,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    server.shutdown()
    time.sleep(0.1)
    return Image.open(CAPTURE).convert("RGBA")


def circle_mask(img):
    size = img.size[0]
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.paste(img, (0, 0), mask)
    return out


def padded(img, fraction=0.10):
    size = img.size[0]
    pad = int(size * fraction)
    inner = img.resize((size - 2 * pad, size - 2 * pad), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", img.size, BG)
    canvas.paste(inner, (pad, pad))
    return canvas


def save_resized(src, path, size, round_mask=False):
    img = src.resize((size, size), Image.Resampling.LANCZOS)
    if round_mask:
        img = circle_mask(img)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def main():
    full = padded(capture(), 0.04)
    fg = padded(full, 0.08)
    bg = Image.new("RGBA", (1024, 1024), BG)

    save_resized(full, ROOT / "icons" / "icon-512.png", 512)
    save_resized(full, ROOT / "icons" / "icon-192.png", 192)
    save_resized(full, ROOT / "icons" / "apple-touch-icon.png", 180)
    save_resized(full, ROOT / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png", 1024)

    dens = {
        "ldpi": 36,
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    dens_fg = {
        "ldpi": 81,
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    for name, size in dens.items():
        folder = ROOT / "android" / "app" / "src" / "main" / "res" / f"mipmap-{name}"
        save_resized(full, folder / "ic_launcher.png", size)
        save_resized(full, folder / "ic_launcher_round.png", size, round_mask=True)
        save_resized(bg, folder / "ic_launcher_background.png", size)
        save_resized(fg, folder / "ic_launcher_foreground.png", dens_fg[name])
    print("wrote icons")


if __name__ == "__main__":
    main()
