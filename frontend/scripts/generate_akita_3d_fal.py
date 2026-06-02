#!/usr/bin/env python3
"""
Reliable image-to-3D for the AKITA hologram via fal.ai (paid, ~$0.05-0.20/run).

Uploads the AKITA token photo to fal storage, runs an image-to-3D model, and
downloads the resulting GLB into public/dev/ for /dev/tactical-map.

Setup:
  .venv-3d/bin/pip install fal-client requests
  # FAL_KEY in env or frontend/.env  (fal.ai/dashboard/keys)

Usage:
  .venv-3d/bin/python frontend/scripts/generate_akita_3d_fal.py
  .venv-3d/bin/python frontend/scripts/generate_akita_3d_fal.py --model fal-ai/trellis-2
  .venv-3d/bin/python frontend/scripts/generate_akita_3d_fal.py --model fal-ai/hunyuan3d/v2

Defaults to fal-ai/trellis (textured GLB, single image).
"""
import argparse
import os
import sys
from pathlib import Path

FRONTEND_ROOT = Path(__file__).resolve().parent.parent
AKITA_TOKEN = "0x5b674196812451b7cec024fe9d22d2c0b172fa75"


def load_env() -> None:
    env_path = FRONTEND_ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if key in os.environ:
            continue
        os.environ[key] = val.strip().strip('"').strip("'")


def get_source_image(image_arg: str | None) -> Path:
    if image_arg:
        return Path(image_arg).resolve()
    import requests

    url = f"http://localhost:5173/api/token/image?address={AKITA_TOKEN}&size=1024&style=raw"
    out = Path("/tmp/akita_src.png")
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    out.write_bytes(r.content)
    return out


def main() -> int:
    load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="fal-ai/trellis")
    ap.add_argument("--image", default="/tmp/akita_raw.png")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY not set (env or frontend/.env). Get one at https://fal.ai/dashboard/keys",
              file=sys.stderr)
        return 1

    import fal_client
    import requests

    img = get_source_image(args.image)
    print(f"[fal] uploading {img} …")
    image_url = fal_client.upload_file(str(img))

    # Per-model input/output key differences.
    is_hunyuan = "hunyuan" in args.model
    arguments: dict = {}
    if is_hunyuan:
        arguments["input_image_url"] = image_url
        arguments["textured_mesh"] = True
    else:
        arguments["image_url"] = image_url

    print(f"[fal] running {args.model} …")

    def on_update(update):
        logs = getattr(update, "logs", None) or []
        for log in logs:
            msg = log.get("message") if isinstance(log, dict) else None
            if msg:
                print(f"  {msg}")

    result = fal_client.subscribe(args.model, arguments=arguments, with_logs=True,
                                  on_queue_update=on_update)

    # Output key varies: model_mesh (trellis/hunyuan) or model_glb (trellis-2).
    mesh = result.get("model_mesh") or result.get("model_glb")
    if not mesh or not mesh.get("url"):
        print(f"[fal] no mesh url in result: {result}", file=sys.stderr)
        return 1
    glb_url = mesh["url"]

    slug = args.model.replace("/", "-")
    out_path = Path(args.out).resolve() if args.out else (
        FRONTEND_ROOT / "public" / "dev" / f"akita-{slug}.glb"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"[fal] downloading {glb_url}")
    glb = requests.get(glb_url, timeout=120).content
    out_path.write_bytes(glb)
    print(f"[fal] wrote {out_path} ({len(glb) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
