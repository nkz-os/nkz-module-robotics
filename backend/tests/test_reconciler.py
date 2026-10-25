"""Reconciler: vpn revocations unenroll robots; pending ACL retried; twin location throttled."""

import json

import httpx
import respx

from app.db.repo import EnrollmentRepo
from app.services import reconciler
from tests.conftest import ORION_URL, VPN_URL

U1 = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
U2 = "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d"


def vpn(uuid, state="CLAIMED", tenant="acme"):
    return {"device_uuid": uuid, "tenant_id": tenant, "device_type": "rover", "state": state,
            "ngsi_entity_id": f"urn:ngsi-ld:ManufacturingMachine:{tenant}:{uuid}"}


async def _enroll(services, uuid, state="active"):
    async with services.db.tenant_tx("acme") as conn:
        repo = EnrollmentRepo(conn)
        await repo.create(uuid, "acme", services.box.encrypt("pw-" + uuid[:4]), "u1")
        await repo.set_state(uuid, state)


async def _states(services):
    async with services.db.platform_tx() as conn:
        return {e.device_uuid: e.state for e in await EnrollmentRepo(conn).list_all()}


async def test_reconcile_unenrolls_revoked(services):
    await _enroll(services, U1)
    await _enroll(services, U2)
    with respx.mock(assert_all_called=False) as r:
        revoked = httpx.Response(200, json=vpn(U1, "REVOKED"))
        r.get(f"{VPN_URL}/api/vpn/internal/devices/{U1}").mock(return_value=revoked)
        r.get(f"{VPN_URL}/api/vpn/internal/devices/{U2}").mock(return_value=httpx.Response(200, json=vpn(U2)))
        summary = await reconciler.reconcile_once(services)
    assert summary["unenrolled"] == [U1]
    assert await _states(services) == {U2: "active"}
    assert U1 not in services.applier.bundles[-1].credentials_txt


async def test_reconcile_unenrolls_missing_or_moved_device(services):
    await _enroll(services, U1)
    await _enroll(services, U2)
    with respx.mock(assert_all_called=False) as r:
        r.get(f"{VPN_URL}/api/vpn/internal/devices/{U1}").mock(return_value=httpx.Response(404))
        r.get(f"{VPN_URL}/api/vpn/internal/devices/{U2}").mock(
            return_value=httpx.Response(200, json=vpn(U2, tenant="tenant-b")))
        summary = await reconciler.reconcile_once(services)
    assert sorted(summary["unenrolled"]) == sorted([U1, U2])


async def test_vpn_outage_unenrolls_nothing(services):
    await _enroll(services, U1)
    with respx.mock(assert_all_called=False) as r:
        r.get(f"{VPN_URL}/api/vpn/internal/devices/{U1}").mock(return_value=httpx.Response(500))
        summary = await reconciler.reconcile_once(services)
    assert summary["unenrolled"] == [] and await _states(services) == {U1: "active"}


async def test_pending_acl_is_retried(services):
    await _enroll(services, U1, state="pending_acl")
    with respx.mock(assert_all_called=False) as r:
        r.get(f"{VPN_URL}/api/vpn/internal/devices/{U1}").mock(return_value=httpx.Response(200, json=vpn(U1)))
        summary = await reconciler.reconcile_once(services)
    assert summary["applied"] is True
    assert await _states(services) == {U1: "active"}


def _telemetry(services, uuid, lat, lon, now):
    payload = {"battery_pct": 80.0, "heading_deg": 0.0, "lat": lat, "lon": lon, "lin_x": 0.0, "ang_z": 0.0,
               "speed_kmh": 0.0, "ts": now}
    services.link.state.apply(f"nkz/acme/{uuid}/telemetry", json.dumps(payload).encode(), now=now)


async def test_location_sync_is_throttled_and_validated(services):
    last: dict = {}
    with respx.mock(assert_all_called=False) as r:
        patch = r.patch(url__regex=rf"{ORION_URL}/ngsi-ld/v1/entities/.*/attrs").mock(
            return_value=httpx.Response(204))
        _telemetry(services, U1, 42.5, -1.6, now=100.0)
        assert await reconciler.sync_locations_once(services, last, now=100.0) == 1
        body = json.loads(patch.calls.last.request.content)
        assert body == {"location": {"type": "GeoProperty", "value": {"type": "Point", "coordinates": [-1.6, 42.5]}}}
        assert str(patch.calls.last.request.url).endswith(f"urn:ngsi-ld:ManufacturingMachine:acme:{U1}/attrs")
        _telemetry(services, U1, 42.6, -1.6, now=110.0)
        assert await reconciler.sync_locations_once(services, last, now=110.0) == 0   # < 30 s
        assert await reconciler.sync_locations_once(services, last, now=131.0) == 1
        _telemetry(services, U2, 95.0, -1.6, now=131.0)                               # invalid latitude
        assert await reconciler.sync_locations_once(services, last, now=200.0) == 0
