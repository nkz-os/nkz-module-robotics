"""Service container and FastAPI dependency providers."""

from collections.abc import Callable
from dataclasses import dataclass, field

from fastapi import Request
from nkz_platform_sdk import OrionClient

from app.config import Settings
from app.db.session import Database
from app.services.acl_apply import AclApplier
from app.services.credentials import CredentialBox
from app.services.vpn_client import VpnClient
from app.services.zenoh_link import ZenohLink


@dataclass
class Services:
    settings: Settings
    db: Database
    link: ZenohLink
    applier: AclApplier
    vpn: VpnClient
    box: CredentialBox
    orion: Callable[[str], OrionClient]  # tenant_id -> client (caller closes it)
    background: set = field(default_factory=set)  # running background tasks (kept referenced)


def get_services(request: Request) -> Services:
    return request.app.state.services
