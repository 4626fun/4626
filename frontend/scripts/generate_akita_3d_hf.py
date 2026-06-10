#!/usr/bin/env python3
"""
Free image-to-3D generator for the AKITA hologram, via a Hugging Face Space
(TRELLIS by default; Hunyuan3D-2 also supported through --space).

Turns the AKITA token logo (a photo of a red Shiba Inu) into a real GLB and
writes it into public/dev/ so /dev/tactical-map can project it.

Setup:
  pip3 install --user gradio_client pillow requests
  # HF_TOKEN in env or frontend/.env  (huggingface.co/settings/tokens, Read scope)

Usage:
  python3 scripts/generate_akita_3d_hf.py
  python3 scripts/generate_akita_3d_hf.py --space JeffreyXiang/TRELLIS --out public/dev/akita-hf.glb

Notes:
  ZeroGPU Spaces queue and occasionally abort; re-run on transient failures.
"""
import argparse
import os
import shutil
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
        val = val.strip().strip('"').strip("'")
        os.environ[key] = val


def get_source_image(image_arg: str | None) -> Path:
    if image_arg:
        return Path(image_arg).resolve()
    # Default: pull the AKITA token photo from the local dev server.
    import requests

    url = f"http://localhost:5173/api/token/image?address={AKITA_TOKEN}&size=1024&style=raw"
    out = Path("/tmp/akita_src.png")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"[src] downloaded AKITA photo -> {out} ({len(r.content)} bytes)")
    return out


# Sensible defaults for known TRELLIS parameter names; we only send the ones the
# Space actually declares (auto-detected via view_api) so signature drift is OK.
IMAGE_TO_3D_DEFAULTS = {
    "multiimages": [],
    "is_multiimage": False,
    "seed": 0,
    "randomize_seed": False,
    "ss_guidance_strength": 7.5,
    "ss_sampling_steps": 12,
    "slat_guidance_strength": 3.0,
    "slat_sampling_steps": 12,
    "multiimage_algo": "stochastic",
}
EXTRACT_GLB_DEFAULTS = {
    "mesh_simplify": 0.95,
    "texture_size": 1024,
}


def param_names(client, api_name: str) -> list[str]:
    info = client.view_api(return_format="dict")
    ep = info.get("named_endpoints", {}).get(api_name)
    if not ep:
        return []
    return [p.get("parameter_name") or p.get("python_name") or "" for p in ep.get("parameters", [])]


def main() -> int:
    load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", default="JeffreyXiang/TRELLIS")
    ap.add_argument("--image", default=None)
    ap.add_argument("--out", default="public/dev/akita-hf.glb")
    args = ap.parse_args()

    token = (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGINGFACE_TOKEN")
        or os.environ.get("HUGGING_FACE_API_KEY")
        or os.environ.get("HUGGINGFACE_API_KEY")
    )
    if not token:
        print("HF_TOKEN not set (env or frontend/.env). Create one at "
              "https://huggingface.co/settings/tokens (Read scope).", file=sys.stderr)
        return 1

    from gradio_client import Client, handle_file

    img_path = get_source_image(args.image)
    out_path = (Path.cwd() / args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"[hf] connecting to Space {args.space} …")
    client = Client(args.space, token=token)

    # ---- Step 1: image_to_3d -> state ----
    names = param_names(client, "/image_to_3d")
    kwargs = {}
    for n in names:
        if n == "image":
            kwargs["image"] = handle_file(str(img_path))
        elif n in IMAGE_TO_3D_DEFAULTS:
            kwargs[n] = IMAGE_TO_3D_DEFAULTS[n]
    if "image" not in kwargs:
        kwargs["image"] = handle_file(str(img_path))
    print(f"[hf] /image_to_3d params: {list(kwargs.keys())}")
    res = client.predict(api_name="/image_to_3d", **kwargs)
    state = res[0] if isinstance(res, (list, tuple)) else res
    print("[hf] got 3D state, extracting GLB …")

    # ---- Step 2: extract_glb -> glb path ----
    enames = param_names(client, "/extract_glb")
    ekwargs = {}
    for n in enames:
        if n in ("state", "model", "input"):
            ekwargs[n] = state
        elif n in EXTRACT_GLB_DEFAULTS:
            ekwargs[n] = EXTRACT_GLB_DEFAULTS[n]
    if not any(k in ekwargs for k in ("state", "model", "input")):
        ekwargs["state"] = state
    glb_res = client.predict(api_name="/extract_glb", **ekwargs)
    glb_path = glb_res[0] if isinstance(glb_res, (list, tuple)) else glb_res

    shutil.copyfile(glb_path, out_path)
    size_kb = out_path.stat().st_size / 1024
    print(f"[hf] wrote {out_path} ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
