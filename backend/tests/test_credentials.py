"""Robot passwords: random, encrypted at rest with the module key."""

import pytest
from cryptography.fernet import Fernet

from app.services.credentials import CredentialBox, new_password


def test_round_trip():
    box = CredentialBox(Fernet.generate_key().decode())
    assert box.decrypt(box.encrypt("s3cret")) == "s3cret"


def test_wrong_key_cannot_decrypt():
    token = CredentialBox(Fernet.generate_key().decode()).encrypt("s3cret")
    with pytest.raises(ValueError):
        CredentialBox(Fernet.generate_key().decode()).decrypt(token)


def test_invalid_key_rejected_at_construction():
    with pytest.raises(ValueError):
        CredentialBox("not-a-fernet-key")


def test_passwords_are_long_and_unique():
    a, b = new_password(), new_password()
    assert a != b and len(a) >= 40
    assert ":" not in a and "\n" not in a  # safe for the usrpwd dictionary format
