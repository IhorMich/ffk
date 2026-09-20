#!/usr/bin/env python3
"""Render store/feature-graphic.png at 1024×500 for Google Play."""
import subprocess
import time
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CAPTURE = Path("/tmp/ffk-feature-src.png")
OUT = ROOT / "store" / "feature-graphic.png"


def capture():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/store/feature-source.html"
    urllib.request.urlopen(url, timeout=3).read()
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=2",
            "--window-size=1024,500",
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
    return Image.open(CAPTURE).convert("RGB")


def main():
    img = capture().resize((1024, 500), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG")
    print(OUT, img.size)


if __name__ == "__main__":
    main()
