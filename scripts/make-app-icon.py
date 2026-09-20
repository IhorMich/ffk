#!/usr/bin/env python3
"""Build Matchcard launcher icons from the intro card-stack look."""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BG = (5, 6, 12, 255)
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

CARDS = [
    {
        "top": (247, 241, 227),
        "bot": (231, 214, 180),
        "ink": (28, 20, 12),
        "muted": (122, 101, 72),
        "accent": (196, 132, 22),
        "line": (196, 132, 22, 96),
        "score": "7.2",
        "pos": "ST",
        "bars": (0.71, 0.64, 0.55, 0.68),
        "angle": -18,
        "dx": -0.20,
        "dy": 0.05,
        "z": 0,
    },
    {
        "top": (23, 48, 74),
        "bot": (11, 18, 32),
        "ink": (244, 230, 200),
        "muted": (168, 180, 196),
        "accent": (245, 185, 66),
        "line": (245, 185, 66, 72),
        "score": "7.8",
        "pos": "CB",
        "bars": (0.62, 0.41, 0.82, 0.79),
        "angle": 15,
        "dx": 0.21,
        "dy": 0.035,
        "z": 1,
    },
    {
        "top": (22, 56, 50),
        "bot": (11, 28, 26),
        "ink": (232, 245, 240),
        "muted": (143, 184, 172),
        "accent": (61, 220, 151),
        "line": (61, 220, 151, 72),
        "score": "8.1",
        "pos": "CM",
        "bars": (0.74, 0.84, 0.61, 0.73),
        "angle": -8,
        "dx": -0.07,
        "dy": -0.02,
        "z": 2,
    },
    {
        "top": (22, 20, 28),
        "bot": (7, 6, 12),
        "ink": (255, 233, 176),
        "muted": (196, 180, 138),
        "accent": (245, 185, 66),
        "line": (245, 185, 66, 82),
        "score": "9.1",
        "pos": "CAM",
        "bars": (0.86, 0.93, 0.78, 0.82),
        "angle": -1.5,
        "dx": 0.0,
        "dy": -0.055,
        "z": 3,
    },
]


def lerp(a, b, t):
    return int(a + (b - a) * t)


def vertical_gradient(size, c1, c2):
    w, h = size
    strip = Image.new("RGBA", (1, h))
    px = strip.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t), 255)
    return strip.resize((w, h), Image.BILINEAR)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def make_card(w, h, spec, detail):
    radius = max(12, int(w * 0.12))
    body = vertical_gradient((w, h), spec["top"], spec["bot"])
    mask = rounded_mask((w, h), radius)
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    card.paste(body, (0, 0), mask)

    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((1, 1, w - 2, h - 2), radius=radius, outline=spec["line"], width=max(2, w // 90))

    stripe_w = max(3, w // 28)
    stripe = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(stripe).rectangle(
        (int(w * 0.07), int(h * 0.08), int(w * 0.07) + stripe_w, int(h * 0.92)),
        fill=spec["accent"] + (255,),
    )
    stripe.putalpha(ImageChops.multiply(stripe.split()[-1], mask))
    card.alpha_composite(stripe)

    if detail:
        pad_l = int(w * 0.16)
        top_y = int(h * 0.08)
        try:
            font_score = ImageFont.truetype(FONT_BLACK, max(18, int(w * 0.34)))
            font_pos = ImageFont.truetype(FONT_BOLD, max(9, int(w * 0.08)))
        except OSError:
            font_score = font_pos = ImageFont.load_default()

        draw.text((pad_l, top_y), spec["pos"], font=font_pos, fill=spec["accent"] + (255,))
        draw.text((pad_l, int(h * 0.16)), spec["score"], font=font_score, fill=spec["accent"] + (255,))

        bar_x = pad_l
        bar_w = int(w * 0.68)
        bar_h = max(3, int(h * 0.018))
        gap = max(6, int(h * 0.042))
        y = int(h * 0.52)
        for p in spec["bars"]:
            track = (bar_x, y, bar_x + bar_w, y + bar_h)
            draw.rounded_rectangle(track, radius=bar_h, fill=(128, 128, 128, 48))
            fill_w = max(bar_h * 2, int(bar_w * p))
            draw.rounded_rectangle((bar_x, y, bar_x + fill_w, y + bar_h), radius=bar_h, fill=spec["accent"] + (255,))
            y += gap

    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sheen).polygon(
        [(0, 0), (w, 0), (w, int(h * 0.22)), (0, int(h * 0.38))],
        fill=(255, 255, 255, 22),
    )
    sheen.putalpha(ImageChops.multiply(sheen.split()[-1], mask))
    card.alpha_composite(sheen)
    return card


def halo(size, scale=1.0, alpha=150):
    w, h = size
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    cx, cy = w // 2, int(h * 0.50)
    rx = int(w * 0.24 * scale)
    ry = int(h * 0.20 * scale)
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(255, 214, 90, alpha))
    inner = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(inner).ellipse(
        (cx - int(rx * 0.55), cy - int(ry * 0.5), cx + int(rx * 0.55), cy + int(ry * 0.5)),
        fill=(255, 230, 150, min(220, alpha + 40)),
    )
    glow.alpha_composite(inner)
    return glow.filter(ImageFilter.GaussianBlur(radius=max(28, w // 14)))


def paste_rotated(base, src, cx, cy, angle):
    rot = src.rotate(angle, resample=Image.BICUBIC, expand=True)
    x = int(cx - rot.width / 2)
    y = int(cy - rot.height / 2)
    sh = Image.new("RGBA", rot.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 150), (0, 0), rot.split()[-1])
    sh = sh.filter(ImageFilter.GaussianBlur(radius=max(6, src.width // 18)))
    base.alpha_composite(sh, (x + src.width // 28, y + src.height // 22))
    base.alpha_composite(rot, (x, y))


def compose(size=1024, pad=0.20, detail=True, transparent=False):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0) if transparent else BG)
    if transparent:
        canvas.alpha_composite(halo((size, size), scale=0.78, alpha=110))
    else:
        canvas.alpha_composite(halo((size, size), scale=1.02, alpha=170))

    usable = size * (1 - 2 * pad)
    card_w = int(usable * 0.46)
    card_h = int(card_w * 1.436)
    cx = size / 2
    cy = size / 2 + size * 0.02

    layers = sorted(CARDS, key=lambda c: c["z"])
    for spec in layers:
        card = make_card(card_w, card_h, spec, detail=detail)
        paste_rotated(canvas, card, cx + spec["dx"] * usable, cy + spec["dy"] * usable, spec["angle"])
    return canvas


def circle_mask(img):
    size = img.size[0]
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.paste(img, (0, 0), mask)
    return out


def save_resized(src, path, size, round_mask=False):
    img = src.resize((size, size), Image.Resampling.LANCZOS)
    if round_mask:
        img = circle_mask(img)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def main():
    full = compose(1024, pad=0.18, detail=True, transparent=False)
    fg = compose(1024, pad=0.24, detail=True, transparent=True)
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
        save_resized(fg, folder / f"ic_launcher_foreground.png", dens_fg[name])
    print("wrote icons")


if __name__ == "__main__":
    main()
