"""Fresh-checkout-only setup. Existing private settings are never overwritten."""
import getpass
import os
from pathlib import Path
import secrets
from urllib.parse import quote

target = Path(__file__).resolve().parent.parent / "server" / ".env"
if os.geteuid() == 0:
    raise SystemExit("Run this helper as the normal project user, without sudo.")
if target.exists() or target.is_symlink():
    raise SystemExit("server/.env already exists; keep the working configuration unchanged.")
password = getpass.getpass("Local PostgreSQL password for tickets_user (hidden): ")
confirmation = getpass.getpass("Confirm PostgreSQL password (hidden): ")
if not password or password != confirmation:
    raise SystemExit("Passwords are empty or do not match; no file created.")
url = "postgresql://tickets_user:" + quote(password, safe="") + "@127.0.0.1:5432/tickets_db"
contents = (
    "NODE_ENV=development\nPORT=3000\nAPP_ORIGIN=http://localhost:5173\n"
    "ALLOW_INSECURE_HTTP=false\nDATABASE_URL=" + url
    + "\nSESSION_SECRET=" + secrets.token_hex(48) + "\n"
)
descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w") as stream:
    stream.write(contents)
print("Created owner-only server/.env. Password and signing secret withheld.")
