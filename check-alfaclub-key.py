import os, base64, re
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

raw = os.environ.get("CANDIDATE_KEY", "").strip()
if not raw:
    raise SystemExit("Set CANDIDATE_KEY first")

b64 = re.sub(r"^wallet-auth:", "", raw)
key = serialization.load_der_private_key(base64.b64decode(b64), None, default_backend())
pub = base64.b64encode(
    key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
).decode()

print("match" if pub.endswith("1sKCuoSpOXUUK9WztreGwg==") else "no-match")