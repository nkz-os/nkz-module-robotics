"""Device lookup in the vpn module (internal route, shared internal secret)."""

from dataclasses import dataclass

import httpx


class VpnUnavailable(Exception):
    pass


@dataclass(frozen=True)
class VpnDevice:
    device_uuid: str
    tenant_id: str
    device_type: str
    state: str
    ngsi_entity_id: str | None


class VpnClient:
    def __init__(self, base_url: str, internal_secret: str, timeout: float = 10.0):
        self._base = base_url.rstrip("/")
        self._headers = {"X-Internal-Service-Secret": internal_secret}
        self._timeout = timeout

    async def get_device(self, device_uuid: str) -> VpnDevice | None:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.get(f"{self._base}/api/vpn/internal/devices/{device_uuid}", headers=self._headers)
        except httpx.HTTPError as exc:
            raise VpnUnavailable(type(exc).__name__) from None
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            raise VpnUnavailable(f"HTTP {r.status_code}")
        d = r.json()
        return VpnDevice(device_uuid=d["device_uuid"], tenant_id=d["tenant_id"], device_type=d["device_type"],
                         state=d["state"], ngsi_entity_id=d.get("ngsi_entity_id"))
