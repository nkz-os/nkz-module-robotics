"""Live robot state from Zenoh and the E-Stop publisher (fake session; real router covered elsewhere)."""

import asyncio
import json
import os

import pytest

from app.services.zenoh_link import LinkDown, LiveState, ZenohLink

T = "acme"
U1 = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
U2 = "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d"
TELEMETRY = {"battery_pct": 92.0, "heading_deg": 10.0, "lat": 42.0, "lon": -1.6, "lin_x": 0.3, "ang_z": 0.0,
             "speed_kmh": 1.08, "ts": 1.0}


def test_state_parses_channels():
    s = LiveState()
    s.apply(f"nkz/{T}/{U1}/telemetry", json.dumps(TELEMETRY).encode(), now=100.0)
    s.apply(f"nkz/{T}/{U1}/heartbeat", b'{"ts": 1, "robot_id": "x", "vitals_age_ms": 250}', now=101.0)
    s.apply(f"nkz/{T}/{U1}/mode", b'{"value": "AUTO"}', now=101.0)
    r = s.get(T, U1)
    assert r.telemetry["lat"] == 42.0 and r.mode == "AUTO" and r.vitals_age_ms == 250
    snap = s.snapshot(r, now=103.0)
    assert snap["online"] is True and snap["heartbeat_age_s"] == 2.0 and snap["mode"] == "AUTO"
    assert s.snapshot(r, now=120.0)["online"] is False


def test_state_ignores_garbage_and_foreign_tenant_lookup():
    s = LiveState()
    for key, payload in [("nkz/acme/not-a-uuid/telemetry", b"{}"), (f"nkz/{T}/{U1}/cmd_vel", b"{}"),
                         (f"nkz/{T}/{U1}/telemetry", b"not json"), ("other/x", b"{}"),
                         (f"nkz/{T}/{U1}/mode", b'{"value": "FLYING"}')]:
        s.apply(key, payload, now=1.0)
    assert s.get(T, U1) is None or (s.get(T, U1).telemetry is None and s.get(T, U1).mode is None)
    s.apply(f"nkz/{T}/{U1}/telemetry", json.dumps(TELEMETRY).encode(), now=1.0)
    assert s.get("tenant-b", U1) is None


async def test_listeners_only_get_their_robot():
    s = LiveState()
    q1, q2 = s.subscribe(T, U1), s.subscribe(T, U2)
    s.apply(f"nkz/{T}/{U1}/telemetry", json.dumps(TELEMETRY).encode(), now=1.0)
    assert q1.qsize() == 1 and q2.qsize() == 0
    s.unsubscribe(T, U1, q1)
    s.apply(f"nkz/{T}/{U1}/telemetry", json.dumps(TELEMETRY).encode(), now=2.0)
    assert q1.qsize() == 1


class FakePub:
    def __init__(self, matching):
        self.matching_status = type("M", (), {"matching": matching})()
        self.puts = []

    def put(self, payload):
        self.puts.append(payload)


class FakeSession:
    def __init__(self, routers=("r",), matching=True):
        self.subs, self.pubs = {}, {}
        self.info = type("I", (), {"routers_zid": lambda _self: list(routers)})()
        self._matching = matching
        self.closed = False

    def declare_subscriber(self, key, cb):
        self.subs[key] = cb

    def declare_publisher(self, key):
        self.pubs[key] = FakePub(self._matching)
        return self.pubs[key]

    def close(self):
        self.closed = True


async def start_link(session):
    link = ZenohLink("tcp/router:7447", "robotics-api", "ps", LiveState(), session_factory=lambda: session,
                     poll_interval=0.05)
    await link.start()
    for _ in range(50):
        if link.connected:
            break
        await asyncio.sleep(0.02)
    return link


async def test_subscribes_to_state_channels():
    sess = FakeSession()
    link = await start_link(sess)
    assert set(sess.subs) == {"nkz/*/*/telemetry", "nkz/*/*/heartbeat", "nkz/*/*/mode"}
    await link.close()
    assert sess.closed


async def test_estop_publishes_exact_payload():
    sess = FakeSession(matching=True)
    link = await start_link(sess)
    result = await link.estop(T, U1)
    pub = sess.pubs[f"nkz/{T}/{U1}/safety/estop"]
    assert [json.loads(p) for p in pub.puts] == [{"data": True}]
    assert (result.published, result.robot_connected) == (True, True)
    await link.close()


async def test_estop_reports_robot_not_connected():
    link = await start_link(FakeSession(matching=False))
    result = await link.estop(T, U1)
    assert (result.published, result.robot_connected) == (True, False)
    await link.close()


async def test_estop_without_router_raises_link_down():
    link = await start_link(FakeSession(routers=()))
    assert link.connected is False
    with pytest.raises(LinkDown):
        await link.estop(T, U1)
    await link.close()


async def test_estop_rejects_bad_ids():
    link = await start_link(FakeSession())
    with pytest.raises(ValueError):
        await link.estop(T, "nkz/**")
    await link.close()


@pytest.mark.skipif(not os.environ.get("ZENOH_TEST_ROUTER"), reason="needs docker and ZENOH_TEST_ROUTER=1")
async def test_link_against_real_router():
    import subprocess
    import tempfile
    from pathlib import Path

    import zenoh

    from app.services.zenoh_acl import RobotCred, render

    bundle = render([RobotCred(U1, T, "p1")], "robotics-api", "ps")
    d = tempfile.mkdtemp()
    Path(d, "credentials.txt").write_text(bundle.credentials_txt)
    Path(d, "zenoh.json5").write_text(
        '{ mode: "router", listen: { endpoints: ["tcp/0.0.0.0:7447"] }, scouting: { multicast: { enabled: false } }, '
        'transport: { auth: { usrpwd: { dictionary_file: "/cfg/credentials.txt" } } }, '
        'access_control: ' + bundle.access_control_json5 + ' }')
    name = "robotics-link-test"
    subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    subprocess.run(["docker", "run", "-d", "--name", name, "-p", "127.0.0.1:57449:7447", "-v", f"{d}:/cfg:ro",
                    "eclipse/zenoh:1.10.1", "-c", "/cfg/zenoh.json5"], check=True, capture_output=True)
    robot = None
    link = ZenohLink("tcp/127.0.0.1:57449", "robotics-api", "ps", LiveState(), poll_interval=0.2)
    try:
        await asyncio.sleep(3)
        await link.start()
        for _ in range(50):
            if link.connected:
                break
            await asyncio.sleep(0.1)
        assert link.connected
        cfg = zenoh.Config()
        cfg.insert_json5("mode", '"client"')
        cfg.insert_json5("connect/endpoints", '["tcp/127.0.0.1:57449"]')
        cfg.insert_json5("scouting/multicast/enabled", "false")
        cfg.insert_json5("transport/auth/usrpwd", json.dumps({"user": U1, "password": "p1"}))
        robot = zenoh.open(cfg)
        got = []
        robot.declare_subscriber(f"nkz/{T}/{U1}/safety/estop", lambda s: got.append(s.payload.to_string()))
        await asyncio.sleep(1)
        robot.put(f"nkz/{T}/{U1}/telemetry", json.dumps(TELEMETRY))
        robot.put(f"nkz/{T}/{U1}/mode", '{"value": "AUTO"}')
        await asyncio.sleep(1)
        live = link.state.get(T, U1)
        result = await link.estop(T, U1)
        await asyncio.sleep(1)
        observed = (live.telemetry["lat"] if live else None, live.mode if live else None, result, list(got))
    finally:
        if robot is not None:
            robot.close()
        await link.close()
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    lat, mode, result, got = observed
    assert (lat, mode) == (42.0, "AUTO")
    assert (result.published, result.robot_connected) == (True, True)
    assert [json.loads(g) for g in got] == [{"data": True}]
