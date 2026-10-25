"""Robot passwords: generated here, shown once, stored encrypted (Fernet).

The Zenoh router's password dictionary needs plaintext, so the plaintext lives
only in the router's Secret, which this service regenerates from the database.
"""

import secrets

from cryptography.fernet import Fernet, InvalidToken


def new_password() -> str:
    return secrets.token_urlsafe(32)  # URL-safe alphabet: never ':' or a newline


class CredentialBox:
    def __init__(self, key: str):
        try:
            self._fernet = Fernet(key.encode("ascii"))
        except (ValueError, TypeError, UnicodeEncodeError) as exc:
            raise ValueError("invalid credential key (expected a Fernet key)") from exc

    def encrypt(self, password: str) -> bytes:
        return self._fernet.encrypt(password.encode("utf-8"))

    def decrypt(self, token: bytes) -> str:
        try:
            return self._fernet.decrypt(token).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("credential cannot be decrypted with this key") from exc
