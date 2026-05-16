#!/usr/bin/env python3
"""Generate an HS256 smoke JWT for local production-profile API checks."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import time


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--secret", required=True)
    parser.add_argument("--issuer", required=True)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--subject", required=True)
    parser.add_argument("--roles", required=True)
    parser.add_argument("--ttl", type=int, default=3600)
    args = parser.parse_args()

    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": args.subject,
        "tenant_id": args.tenant_id,
        "roles": [role for role in args.roles.split(",") if role],
        "iss": args.issuer,
        "iat": now,
        "exp": now + args.ttl,
    }
    signing_input = ".".join(
        [
            b64url(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(
        args.secret.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    print(f"{signing_input}.{b64url(signature)}")


if __name__ == "__main__":
    main()
