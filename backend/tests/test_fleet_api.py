"""Fleet routes: enrollment on top of vpn, per-robot credentials, E-Stop, listing."""

import json
import logging

import httpx
import pytest
import respx

from app.db.repo import EnrollmentRepo
from tests.conftest import ORION_URL, VPN_URL, gateway_headers

U1 = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
U2 = "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d"
ADMIN = gateway_headers("acme", "TenantAdmin")
FARMER = gateway_headers("acme", "Farmer")
OTHER = gateway_headers("tenant-b", "TenantAdmin")


def vpn_device(uuid=U1, tenant="acme", device_type="rover", state="CLAIMED"):
    return {"device_uuid": uuid, "tenant_id": tenant, "device_type": device_type, "state": state,
            "ngsi_entity_id": f"urn:ngsi-ld:ManufacturingMachine:{tenant}:{uuid}",
            "ngsi_entity_type": "ManufacturingMachine", "node": None}


@pytest.fixture
def mocks():
    with respx.mock(assert_all_called=False) as router:
        router.get(url__regex=rf"{VPN_URL}/api/vpn/internal/devices/.*", name="vpn").mock(
            side_effect=lambda req: httpx.Response(200, json=vpn_device(req.url.path.rsplit("/", 1)[-1])))
        router.get(f"{ORION_URL}/ngsi-ld/v1/entities", name="orion").mock(return_value=httpx.Response(200, json=[
            {"id": f"urn:ngsi-ld:ManufacturingMachine:acme:{U1}", "type": "ManufacturingMachine",
             "name": {"type": "Property", "value": "Mini 01"}, "category": {"type": "Property", "value": "robot"}}]))
        yield router


async def enroll(api, uuid=U1, headers=ADMIN):
    return await api.post(f"/api/robotics/fleet/robots/{uuid}/enroll", headers=headers)


async def drain(services):
    import asyncio

    while services.background:
        await asyncio.gather(*list(services.background), return_exceptions=True)


async def test_enroll_returns_credential_once_and_applies_acl(api, services, mocks):
    r = await enroll(api)
    assert r.status_code == 202
    body = r.json()
    assert body["state"] == "applying"
    z = body["zenoh"]
    assert (z["endpoint"], z["username"], z["key_prefix"]) == ("tcp/192.0.2.10:7447", U1, f"nkz/acme/{U1}")
    assert len(z["password"]) >= 40
    await drain(services)
    bundle = services.applier.bundles[-1]
    assert f"{U1}:{z['password']}" in bundle.credentials_txt
    assert "robotics-api:svc-pass" in bundle.credentials_txt
    status = await api.get(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=ADMIN)
    assert status.json() == {"device_uuid": U1, "state": "active"}
    assert mocks["vpn"].calls.last.request.headers["X-Internal-Service-Secret"] == "internal-secret"


async def test_password_is_stored_encrypted(api, services, db, mocks):
    password = (await enroll(api)).json()["zenoh"]["password"]
    async with db.platform_tx() as conn:
        row = await EnrollmentRepo(conn).get(U1)
    assert password.encode() not in row.password_enc
    assert services.box.decrypt(row.password_enc) == password


async def test_enroll_refuses_foreign_or_unclaimed(api, mocks):
    for device, expected in [(vpn_device(tenant="tenant-b"), 404), (vpn_device(device_type="sensor"), 409),
                             (vpn_device(state="PENDING"), 409), (vpn_device(state="REVOKED"), 409)]:
        mocks["vpn"].mock(return_value=httpx.Response(200, json=device))
        assert (await enroll(api)).status_code == expected, device
    mocks["vpn"].mock(return_value=httpx.Response(404, json={"detail": "Device not found"}))
    assert (await enroll(api)).status_code == 404
    mocks["vpn"].mock(return_value=httpx.Response(500))
    assert (await enroll(api)).status_code == 502


async def test_enroll_twice_409(api, services, mocks):
    assert (await enroll(api)).status_code == 202
    await drain(services)
    assert (await enroll(api)).status_code == 409


async def test_enroll_requires_admin(api, mocks):
    assert (await enroll(api, headers=FARMER)).status_code == 403


async def test_failed_router_restart_leaves_pending(api, services, mocks):
    services.applier.ok = False
    await enroll(api)
    await drain(services)
    state = (await api.get(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=ADMIN)).json()["state"]
    assert state == "pending_acl"


async def test_rotate_issues_new_password(api, services, mocks):
    first = (await enroll(api)).json()["zenoh"]["password"]
    await drain(services)
    r = await api.post(f"/api/robotics/fleet/robots/{U1}/rotate-credential", headers=ADMIN)
    assert r.status_code == 202
    second = r.json()["zenoh"]["password"]
    await drain(services)
    assert second != first
    assert f"{U1}:{second}" in services.applier.bundles[-1].credentials_txt
    assert f"{U1}:{first}" not in services.applier.bundles[-1].credentials_txt


async def test_unenroll_removes_credential(api, services, mocks):
    await enroll(api)
    await drain(services)
    assert (await api.delete(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=ADMIN)).status_code == 204
    await drain(services)
    assert U1 not in services.applier.bundles[-1].credentials_txt
    assert (await api.get(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=ADMIN)).status_code == 404


async def test_enrollment_of_other_tenant_404(api, services, mocks):
    await enroll(api)
    assert (await api.get(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=OTHER)).status_code == 404
    assert (await api.delete(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=OTHER)).status_code == 404


async def test_estop_any_role_exact_target(api, services, mocks):
    await enroll(api)
    r = await api.post(f"/api/robotics/fleet/robots/{U1}/estop", headers=FARMER)
    assert r.status_code == 200
    body = r.json()
    assert (body["published"], body["robot_connected"]) == (True, True)
    assert services.link.estops == [("acme", U1)]


async def test_estop_unknown_robot_404(api, services, mocks):
    r = await api.post(f"/api/robotics/fleet/robots/{U2}/estop", headers=FARMER)
    assert r.status_code == 404
    assert services.link.estops == []


async def test_estop_router_down_503(api, services, mocks):
    await enroll(api)
    services.link.connected = False
    assert (await api.post(f"/api/robotics/fleet/robots/{U1}/estop", headers=FARMER)).status_code == 503


async def test_estop_all_reports_each_robot(api, services, mocks):
    await enroll(api, U1)
    await enroll(api, U2)
    await drain(services)
    r = await api.post("/api/robotics/fleet/actions/estop-all", headers=FARMER)
    assert r.status_code == 200
    assert sorted(x["device_uuid"] for x in r.json()["results"]) == sorted([U1, U2])
    assert sorted(services.link.estops) == sorted([("acme", U1), ("acme", U2)])


async def test_list_merges_twin_enrollment_and_live(api, services, mocks):
    await enroll(api)
    await drain(services)
    services.link.state.apply(f"nkz/acme/{U1}/heartbeat", b'{"ts": 1, "robot_id": "x", "vitals_age_ms": 10}')
    r = await api.get("/api/robotics/fleet/robots", headers=FARMER)
    assert r.status_code == 200
    (robot,) = r.json()["robots"]
    assert robot["device_uuid"] == U1 and robot["name"] == "Mini 01"
    assert robot["enrollment"] == {"state": "active"}
    assert robot["live"]["online"] is True
    q = mocks["orion"].calls.last.request.url.params
    assert q["type"] == "ManufacturingMachine" and q["q"] == 'category=="robot"'


async def test_password_never_logged(api, services, mocks, caplog):
    caplog.set_level(logging.DEBUG)
    password = (await enroll(api)).json()["zenoh"]["password"]
    await drain(services)
    assert password not in caplog.text


async def test_openapi_has_no_teleoperation_routes(api):
    paths = (await api.get("/api/robotics/openapi.json")).json()["paths"]
    assert not any("control" in p or "zenoh-config" in p or "provision" in p for p in paths)
    assert "/api/robotics/fleet/robots/{device_uuid}/estop" in paths
    assert json.dumps(paths).count("cmd_vel") == 0


async def test_reconciler_reapplies_after_failed_unenroll_apply(api, services, mocks):
    from app.services import reconciler

    await enroll(api)
    await drain(services)
    services.applier.fail_next = True
    assert (await api.delete(f"/api/robotics/fleet/robots/{U1}/enrollment", headers=ADMIN)).status_code == 204
    await drain(services)
    assert U1 in services.applier.bundles[-1].credentials_txt  # the router still has the revoked robot
    await reconciler.reconcile_once(services)
    assert U1 not in services.applier.bundles[-1].credentials_txt


async def test_rotate_during_apply_is_not_marked_active(api, services, db, mocks):
    from app.services import enrollment

    await enroll(api)
    await drain(services)

    async def rotate_meanwhile():
        async with db.tenant_tx("acme") as conn:
            await EnrollmentRepo(conn).set_password(U1, services.box.encrypt("newer-password"), "u2")

    services.applier.during_wait = rotate_meanwhile
    await enrollment.apply_acl(services)  # snapshot taken before the rotation
    async with db.platform_tx() as conn:
        assert (await EnrollmentRepo(conn).get(U1)).state == "applying"
    await enrollment.apply_acl(services)
    async with db.platform_tx() as conn:
        assert (await EnrollmentRepo(conn).get(U1)).state == "active"


async def test_background_apply_failure_is_logged(api, services, mocks, caplog, monkeypatch):
    from app.services import enrollment

    async def boom(self):
        raise RuntimeError("db down")

    monkeypatch.setattr(EnrollmentRepo, "list_all", boom)
    caplog.set_level(logging.ERROR)
    enrollment.schedule_apply(services)
    await drain(services)
    assert "zenoh-acl apply failed" in caplog.text


async def test_estop_all_runs_concurrently(api, services, mocks):
    import time

    await enroll(api, U1)
    await enroll(api, U2)
    await drain(services)
    services.link.delay = 0.3
    t0 = time.monotonic()
    r = await api.post("/api/robotics/fleet/actions/estop-all", headers=FARMER)
    assert r.status_code == 200 and len(r.json()["results"]) == 2
    assert time.monotonic() - t0 < 0.5


async def test_estop_reports_sent_at(api, services, mocks):
    await enroll(api)
    body = (await api.post(f"/api/robotics/fleet/robots/{U1}/estop", headers=FARMER)).json()
    assert isinstance(body["sent_at"], float)
