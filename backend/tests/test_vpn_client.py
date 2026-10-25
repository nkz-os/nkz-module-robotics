"""vpn internal device lookup."""

import httpx
import pytest
import respx

from app.services.vpn_client import VpnClient, VpnUnavailable

BASE = "http://vpn.test:8000"
U = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
URL = f"{BASE}/api/vpn/internal/devices/{U}"


@respx.mock
async def test_returns_device_with_internal_secret():
    route = respx.get(URL).mock(return_value=httpx.Response(200, json={
        "device_uuid": U, "tenant_id": "acme", "device_type": "rover", "state": "CLAIMED",
        "ngsi_entity_id": f"urn:ngsi-ld:ManufacturingMachine:acme:{U}", "ngsi_entity_type": "ManufacturingMachine",
        "node": None}))
    d = await VpnClient(BASE, "s3").get_device(U)
    assert (d.tenant_id, d.device_type, d.state) == ("acme", "rover", "CLAIMED")
    assert route.calls.last.request.headers["X-Internal-Service-Secret"] == "s3"


@respx.mock
async def test_missing_device_is_none():
    respx.get(URL).mock(return_value=httpx.Response(404, json={"detail": "Device not found"}))
    assert await VpnClient(BASE, "s3").get_device(U) is None


@respx.mock
async def test_other_failures_raise_unavailable():
    respx.get(URL).mock(return_value=httpx.Response(500))
    with pytest.raises(VpnUnavailable):
        await VpnClient(BASE, "s3").get_device(U)
    respx.get(URL).mock(side_effect=httpx.ConnectError("down"))
    with pytest.raises(VpnUnavailable):
        await VpnClient(BASE, "s3").get_device(U)


@respx.mock
async def test_generic_404_is_not_a_missing_device():
    # a misrouted URL answers 404 too; treating it as "device gone" would unenroll the whole fleet
    respx.get(URL).mock(return_value=httpx.Response(404, json={"detail": "Not Found"}))
    with pytest.raises(VpnUnavailable):
        await VpnClient(BASE, "s3").get_device(U)
