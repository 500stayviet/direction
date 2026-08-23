"""Export app icons from the wide brand mockup (center blue squircle)."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BRAND_DIR = ROOT / "scripts" / "brand"
SRC = BRAND_DIR / "logo-wide.png"


def crop_icon_square(im: Image.Image) -> Image.Image:
    rgb = im.convert("RGB")
    arr = np.asarray(rgb)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    mask = (b > g + 8) & (b > r + 20) & (b > 140) & (r < 200)
    ys, xs = np.where(mask)
    if xs.size == 0:
        raise SystemExit("blue icon region not found")
    left, right = int(xs.min()), int(xs.max())
    top, bottom = int(ys.min()), int(ys.max())
    h, w = arr.shape[:2]
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    side = max(right - left, bottom - top) + 8
    half = side / 2
    box = (
        max(0, int(cx - half)),
        max(0, int(cy - half)),
        min(w, int(cx + half)),
        min(h, int(cy + half)),
    )
    crop = rgb.crop(box)
    s = max(crop.size)
    fill = tuple(int(x) for x in arr[int(cy), int(cx)])
    out = Image.new("RGB", (s, s), fill)
    ox = (s - crop.size[0]) // 2
    oy = (s - crop.size[1]) // 2
    out.paste(crop, (ox, oy))
    return out


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    square = crop_icon_square(Image.open(SRC))
    master = square.resize((1024, 1024), Image.Resampling.LANCZOS)
    master.save(BRAND_DIR / "logo-square.png", "PNG", optimize=True)
    master.save(PUBLIC / "icon-1024.png", "PNG", optimize=True)
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (32, "favicon.png")):
        master.resize((size, size), Image.Resampling.LANCZOS).save(
            PUBLIC / name, "PNG", optimize=True
        )
    print("wrote icons from logo-wide.png")


if __name__ == "__main__":
    main()
