"""
The backend's Zenoh session (user robotics-api): live robot state in, E-Stop out.

Robots publish nkz/{tenant}/{uuid}/telemetry | heartbeat | mode (robot spec,
"Fase 4"); the platform keeps the last value per robot in memory (one backend
replica) and fans it out to the stream listeners of that tenant and robot. The
only command sent to a robot is the E-Stop: {"data": true} on .../safety/estop
(the robot accepts nothing else and the platform can never clear an E-Stop).

Zenoh callbacks run on Zenoh threads; they hand samples to the event loop with
call_soon_threadsafe. Blocking session calls run in a thread.
"""

import asyncio
import contextlib
import json
import logging
import re
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_TENANT = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VALID_MODES = ("MANUAL", "AUTO", "MISSION", "ESTOP")
ONLINE_WINDOW_S = 5.0  # robots send a heartbeat every second
ESTOP_PAYLOAD = json.dumps({"data": True})


class LinkDown(Exception):
    pass


@dataclass
class RobotLive:
    tenant_id: str
    device_uuid: str
    telemetry: dict[str, Any] | None = None
    telemetry_at: float | None = None
    heartbeat_at: float | None = None
    vitals_age_ms: int | None = None
    mode: str | None = None
    updated_at: float = 0.0


@dataclass(frozen=True)
class EstopResult:
    published: bool
    robot_connected: bool


@dataclass
class LiveState:
    robots: dict[tuple[str, str], RobotLive] = field(default_factory=dict)
    _listeners: dict[tuple[str, str], set[asyncio.Queue]] = field(default_factory=lambda: defaultdict(set))
    link_up: bool = False

    def apply(self, key: str, payload: bytes | str, now: float | None = None) -> None:
        now = time.time() if now is None else now
        parts = key.split("/")
        if len(parts) != 4 or parts[0] != "nkz" or not _TENANT.match(parts[1]) or not _UUID.match(parts[2]):
            return
        tenant, uuid, channel = parts[1], parts[2], parts[3]
        if channel not in ("telemetry", "heartbeat", "mode"):
            return
        try:
            data = json.loads(payload)
        except (TypeError, ValueError):
            return
        if not isinstance(data, dict):
            return
        robot = self.robots.setdefault((tenant, uuid), RobotLive(tenant, uuid))
        if channel == "telemetry":
            robot.telemetry, robot.telemetry_at = data, now
        elif channel == "heartbeat":
            robot.heartbeat_at = now
            age = data.get("vitals_age_ms")
            robot.vitals_age_ms = age if isinstance(age, int) else None
        elif data.get("value") in VALID_MODES:
            robot.mode = data["value"]
        else:
            return
        robot.updated_at = now
        self._notify(robot, now)

    def get(self, tenant_id: str, device_uuid: str) -> RobotLive | None:
        return self.robots.get((tenant_id, device_uuid))

    def snapshot(self, robot: RobotLive, now: float | None = None) -> dict[str, Any]:
        now = time.time() if now is None else now
        age = round(now - robot.heartbeat_at, 1) if robot.heartbeat_at is not None else None
        return {"online": age is not None and age <= ONLINE_WINDOW_S, "heartbeat_age_s": age,
                "vitals_age_ms": robot.vitals_age_ms, "mode": robot.mode, "telemetry": robot.telemetry}

    def subscribe(self, tenant_id: str, device_uuid: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._listeners[(tenant_id, device_uuid)].add(q)
        return q

    def unsubscribe(self, tenant_id: str, device_uuid: str, q: asyncio.Queue) -> None:
        self._listeners[(tenant_id, device_uuid)].discard(q)

    def _notify(self, robot: RobotLive, now: float) -> None:
        event = {"type": "state", **self.snapshot(robot, now)}
        for q in list(self._listeners.get((robot.tenant_id, robot.device_uuid), ())):
            if q.full():
                q.get_nowait()  # slow listener: drop the oldest, keep the newest
            q.put_nowait(event)

    def set_link(self, up: bool) -> None:
        if up == self.link_up:
            return
        self.link_up = up
        for queues in self._listeners.values():
            for q in list(queues):
                if not q.full():
                    q.put_nowait({"type": "link", "state": "up" if up else "down"})


class ZenohLink:
    def __init__(self, endpoint: str, user: str, password: str, state: LiveState, session_factory=None,
                 poll_interval: float = 2.0):
        self._endpoint, self._user, self._password = endpoint, user, password
        self.state = state
        self._factory = session_factory or self._open_real
        self._poll = poll_interval
        self._session = None
        self._publishers: dict[str, Any] = {}
        self._task: asyncio.Task | None = None
        self.connected = False

    def _open_real(self):
        import zenoh

        cfg = zenoh.Config()
        cfg.insert_json5("mode", '"client"')
        cfg.insert_json5("connect/endpoints", json.dumps([self._endpoint]))
        cfg.insert_json5("scouting/multicast/enabled", "false")
        cfg.insert_json5("transport/auth/usrpwd", json.dumps({"user": self._user, "password": self._password}))
        return zenoh.open(cfg)

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="zenoh-link")

    async def _run(self) -> None:
        loop = asyncio.get_running_loop()

        def on_sample(sample) -> None:
            payload = sample.payload.to_bytes() if hasattr(sample.payload, "to_bytes") else sample.payload
            loop.call_soon_threadsafe(self.state.apply, str(sample.key_expr), payload)

        backoff = 1.0
        while True:
            if self._session is None:
                try:
                    self._session = await asyncio.to_thread(self._factory)
                    for channel in ("telemetry", "heartbeat", "mode"):
                        await asyncio.to_thread(self._session.declare_subscriber, f"nkz/*/*/{channel}", on_sample)
                    backoff = 1.0
                except Exception as exc:  # router unreachable or credentials refused: retry with backoff
                    logger.warning("zenoh session not available: %s", type(exc).__name__)
                    self._session = None
                    self._set_connected(False)
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 30.0)
                    continue
            try:
                routers = await asyncio.to_thread(lambda: list(self._session.info.routers_zid()))
            except Exception:  # a closed session raises; reopen
                routers = []
                self._session, self._publishers = None, {}
            self._set_connected(bool(routers))
            await asyncio.sleep(self._poll)

    def _set_connected(self, up: bool) -> None:
        if up != self.connected:
            logger.info("zenoh link %s", "up" if up else "down")
        self.connected = up
        self.state.set_link(up)

    async def estop(self, tenant_id: str, device_uuid: str) -> EstopResult:
        if not _TENANT.match(tenant_id) or not _UUID.match(device_uuid):
            raise ValueError("invalid robot id")
        if not self.connected or self._session is None:
            raise LinkDown("zenoh router not reachable")
        key = f"nkz/{tenant_id}/{device_uuid}/safety/estop"

        def publish() -> bool:
            pub = self._publishers.get(key)
            if pub is None:
                pub = self._publishers[key] = self._session.declare_publisher(key)
                deadline = time.monotonic() + 0.5  # matching status propagates shortly after declaring
                while not pub.matching_status.matching and time.monotonic() < deadline:
                    time.sleep(0.05)
            connected = bool(pub.matching_status.matching)
            pub.put(ESTOP_PAYLOAD)
            return connected

        try:
            robot_connected = await asyncio.to_thread(publish)
        except Exception as exc:
            raise LinkDown(type(exc).__name__) from None
        logger.warning("E-Stop sent", extra={"tenant_id": tenant_id, "device_uuid": device_uuid,
                                             "robot_connected": robot_connected})
        return EstopResult(published=True, robot_connected=robot_connected)

    async def close(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
        if self._session is not None:
            await asyncio.to_thread(self._session.close)
            self._session = None
        self._set_connected(False)
