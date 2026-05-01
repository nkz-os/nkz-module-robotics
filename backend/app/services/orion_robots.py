"""Orion-LD client for AgriRobot entities."""
import logging
from typing import Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

CONTEXT = [
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
    "https://smartdatamodels.org/context.jsonld",
]


class OrionRobotClient:
    """CRUD for AgriRobot entities in Orion-LD."""

    def __init__(self, tenant_id: str):
        self.base = settings.ORION_URL.rstrip("/")
        self.tenant = tenant_id
        self.headers = {
            "Content-Type": "application/ld+json",
            "Accept": "application/ld+json",
            "NGSILD-Tenant": tenant_id,
        }

    async def _req(self, method: str, path: str, json_data: Optional[dict] = None) -> Optional[dict]:
        url = f"{self.base}{path}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.request(method, url, json=json_data, headers=self.headers)
            if r.status_code in (200, 201, 204):
                return r.json() if r.content else None
            logger.warning("Orion-LD %s %s -> %s: %s", method, path, r.status_code, r.text[:200])
            return None

    async def list_robots(self) -> list[dict]:
        result = await self._req("GET", "/ngsi-ld/v1/entities?type=AgriRobot&limit=200")
        return result if isinstance(result, list) else []

    async def get_robot(self, robot_id: str) -> Optional[dict]:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        return await self._req("GET", f"/ngsi-ld/v1/entities/{urn}")

    async def create_robot(self, robot_id: str, name: str, robot_type: str, parcel_id: Optional[str] = None) -> dict:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        entity = {
            "@context": CONTEXT,
            "id": urn,
            "type": "AgriRobot",
            "name": {"type": "Property", "value": name},
            "robotType": {"type": "Property", "value": robot_type},
            "operationMode": {"type": "Property", "value": "MONITOR"},
            "battery": {"type": "Property", "value": 0},
            "location": {"type": "GeoProperty", "value": {"type": "Point", "coordinates": [0, 0]}},
        }
        if parcel_id:
            entity["refAgriParcel"] = {
                "type": "Relationship",
                "object": parcel_id if parcel_id.startswith("urn:") else f"urn:ngsi-ld:AgriParcel:{parcel_id}",
            }
        await self._req("POST", "/ngsi-ld/v1/entities", entity)
        return entity

    async def update_robot(self, robot_id: str, attrs: dict) -> bool:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        patch = {"@context": CONTEXT}
        for key, value in attrs.items():
            patch[key] = {"type": "Property", "value": value}
        await self._req("PATCH", f"/ngsi-ld/v1/entities/{urn}/attrs", patch)
        return True

    async def delete_robot(self, robot_id: str) -> bool:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        await self._req("DELETE", f"/ngsi-ld/v1/entities/{urn}")
        return True


def get_orion_robots(tenant_id: str) -> OrionRobotClient:
    return OrionRobotClient(tenant_id)
