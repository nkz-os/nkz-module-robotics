"""Live stream: cookie auth, tenant isolation, event content."""

import json

import pytest

import app.api.stream as stream_mod
from app.api.stream import stream_events
from app.db.repo import EnrollmentRepo

U1 = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
PATH = f"/api/robotics/teleop/{U1}/stream"


@pytest.fixture
def token_for(monkeypatch):
    def set_tenant(tenant):
        monkeypatch.setattr(stream_mod, "verify_websocket_token", lambda token: {"tenant_id": tenant, "sub": "u1"})
    return set_tenant


async def _enroll(db, tenant="acme"):
    async with db.tenant_tx(tenant) as conn:
        await EnrollmentRepo(conn).create(U1, tenant, b"enc", "u1")


async def test_missing_cookie_401(api):
    assert (await api.get(PATH)).status_code == 401


async def test_invalid_token_401(api, monkeypatch):
    import jwt

    def bad(token):
        raise jwt.InvalidTokenError("bad")

    monkeypatch.setattr(stream_mod, "verify_websocket_token", bad)
    assert (await api.get(PATH, headers={"Cookie": "nkz_token=x"})).status_code == 401


async def test_foreign_origin_403(api, token_for, monkeypatch):
    token_for("acme")
    monkeypatch.setattr(stream_mod, "allowed_origins", lambda: ["https://app.example.test"])
    r = await api.get(PATH, headers={"Cookie": "nkz_token=x", "Origin": "https://evil.example.test"})
    assert r.status_code == 403


async def test_stream_tenant_isolation(api, db, token_for):
    await _enroll(db, "acme")
    token_for("tenant-b")
    assert (await api.get(PATH, headers={"Cookie": "nkz_token=x"})).status_code == 404


async def test_events_link_state_and_updates(services):
    services.link.state.apply(f"nkz/acme/{U1}/mode", b'{"value": "AUTO"}')
    calls = {"n": 0}

    async def disconnected():
        calls["n"] += 1
        return calls["n"] > 1

    gen = stream_events(services, "acme", U1, disconnected, keepalive=0.1)
    first = await gen.__anext__()
    second = await gen.__anext__()
    services.link.state.apply(f"nkz/acme/{U1}/mode", b'{"value": "ESTOP"}')
    third = await gen.__anext__()
    await gen.aclose()
    assert first.startswith(b"event: link") and b'"up"' in first
    assert second.startswith(b"event: state") and json.loads(second.split(b"data: ")[1])["mode"] == "AUTO"
    assert third.startswith(b"event: state") and json.loads(third.split(b"data: ")[1])["mode"] == "ESTOP"


async def test_events_never_carry_another_robot(services):
    other = "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d"
    gen = stream_events(services, "acme", U1, lambda: _false(), keepalive=0.05)
    await gen.__anext__()  # link
    services.link.state.apply(f"nkz/acme/{other}/mode", b'{"value": "AUTO"}')
    services.link.state.apply(f"nkz/tenant-b/{U1}/mode", b'{"value": "AUTO"}')
    nxt = await gen.__anext__()
    await gen.aclose()
    assert nxt == b": keepalive\n\n"


async def _false():
    return False
