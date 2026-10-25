"""Router ACL rendering: per-robot isolation, deterministic output."""

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import pytest

from app.services.zenoh_acl import RobotCred, json5_to_json, render

T = "acme"
U1 = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
U2 = "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d"


def acl(bundle):
    return json.loads(json5_to_json(bundle.access_control_json5))


def test_credentials_dictionary():
    b = render([RobotCred(U2, T, "p2"), RobotCred(U1, T, "p1")], "robotics-api", "ps")
    assert b.credentials_txt == f"robotics-api:ps\n{U1}:p1\n{U2}:p2\n"


def test_deterministic_regardless_of_input_order():
    a = render([RobotCred(U1, T, "p1"), RobotCred(U2, "tenant-b", "p2")], "robotics-api", "ps")
    b = render([RobotCred(U2, "tenant-b", "p2"), RobotCred(U1, T, "p1")], "robotics-api", "ps")
    assert a == b and a.digest == b.digest


def test_robot_rules_cover_only_its_prefix():
    ac = acl(render([RobotCred(U1, T, "p1"), RobotCred(U2, "tenant-b", "p2")], "robotics-api", "ps"))
    assert ac["enabled"] is True and ac["default_permission"] == "deny"
    subjects = {s["id"]: s for s in ac["subjects"]}
    rules = {r["id"]: r for r in ac["rules"]}
    for policy in ac["policies"]:
        users = [u for sid in policy["subjects"] for u in subjects[sid]["usernames"]]
        keys = [k for rid in policy["rules"] for k in rules[rid]["key_exprs"]]
        if users == ["robotics-api"]:
            assert keys == ["nkz/**"]
            continue
        (user,) = users
        tenant = T if user == U1 else "tenant-b"
        assert all(k.startswith(f"nkz/{tenant}/{user}/") for k in keys)


def test_robot_may_publish_state_and_only_subscribe_to_estop():
    ac = acl(render([RobotCred(U1, T, "p1")], "robotics-api", "ps"))
    up = next(r for r in ac["rules"] if r["id"] == f"robot-{U1}-up")
    down = next(r for r in ac["rules"] if r["id"] == f"robot-{U1}-estop")
    assert up["messages"] == ["put"] and up["flows"] == ["ingress"]
    assert sorted(up["key_exprs"]) == sorted(f"nkz/{T}/{U1}/{c}" for c in ("telemetry", "heartbeat", "mode"))
    assert down["key_exprs"] == [f"nkz/{T}/{U1}/safety/estop"]
    assert set(down["messages"]) == {"declare_subscriber", "put"} and set(down["flows"]) == {"ingress", "egress"}


def test_empty_robot_list_is_still_a_valid_config():
    ac = acl(render([], "robotics-api", "ps"))
    assert [p["subjects"] for p in ac["policies"]] == [["service"]]


def test_rejects_non_uuid_username():
    with pytest.raises(ValueError):
        render([RobotCred("robot:evil", T, "p")], "robotics-api", "ps")


@pytest.mark.skipif(not os.environ.get("ZENOH_TEST_ROUTER") or not shutil.which("docker"),
                    reason="needs docker and ZENOH_TEST_ROUTER=1")
def test_acl_isolation_real_router():
    import zenoh

    bundle = render([RobotCred(U1, T, "p1"), RobotCred(U2, T, "p2")], "robotics-api", "ps")
    d = tempfile.mkdtemp()
    Path(d, "credentials.txt").write_text(bundle.credentials_txt)
    base = ('{ mode: "router", listen: { endpoints: ["tcp/0.0.0.0:7447"] }, '
            'scouting: { multicast: { enabled: false } }, '
            'transport: { auth: { usrpwd: { dictionary_file: "/cfg/credentials.txt" } } }, '
            'access_control: ' + bundle.access_control_json5 + ' }')
    Path(d, "zenoh.json5").write_text(base)
    name = "robotics-acl-test"
    subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    subprocess.run(["docker", "run", "-d", "--name", name, "-p", "127.0.0.1:57448:7447", "-v", f"{d}:/cfg:ro",
                    "eclipse/zenoh:1.10.1", "-c", "/cfg/zenoh.json5"], check=True, capture_output=True)
    try:
        time.sleep(4)

        def session(user, pwd):
            c = zenoh.Config()
            c.insert_json5("mode", '"client"')
            c.insert_json5("connect/endpoints", '["tcp/127.0.0.1:57448"]')
            c.insert_json5("scouting/multicast/enabled", "false")
            c.insert_json5("transport/auth/usrpwd", json.dumps({"user": user, "password": pwd}))
            return zenoh.open(c)

        seen, r1_estop, r2_estop = [], [], []
        sessions = []
        svc, r1, r2 = (sessions.append(session(*c)) or sessions[-1]
                       for c in (("robotics-api", "ps"), (U1, "p1"), (U2, "p2")))
        svc.declare_subscriber("nkz/*/*/telemetry", lambda s: seen.append(str(s.key_expr)))
        r1.declare_subscriber(f"nkz/{T}/{U1}/safety/estop", lambda s: r1_estop.append(U1))
        r1.declare_subscriber(f"nkz/{T}/{U2}/safety/estop", lambda s: r1_estop.append(U2))  # not its key
        r2.declare_subscriber(f"nkz/{T}/{U2}/safety/estop", lambda s: r2_estop.append(U2))
        time.sleep(1.5)
        r1.put(f"nkz/{T}/{U1}/telemetry", "{}")
        r1.put(f"nkz/{T}/{U2}/telemetry", "{}")            # spoofing another robot's state: dropped
        r1.put(f"nkz/{T}/{U2}/safety/estop", '{"data": true}')  # robot stopping another robot: dropped
        time.sleep(1.5)
        spoofed_to_r2 = list(r2_estop)
        r1_estop.clear()  # a session also delivers its own puts to its own subscribers (local, not routed)
        svc.put(f"nkz/{T}/{U1}/safety/estop", '{"data": true}')
        svc.put(f"nkz/{T}/{U2}/safety/estop", '{"data": true}')
        time.sleep(1.5)
        observed = (seen, spoofed_to_r2, r1_estop, r2_estop)
    finally:
        for s in locals().get("sessions", []):
            s.close()
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)
    telemetry, spoofed_to_r2, r1_got, r2_got = observed
    assert telemetry == [f"nkz/{T}/{U1}/telemetry"]   # only its own state reached the platform
    assert spoofed_to_r2 == []                         # robot 1 cannot stop robot 2
    assert r1_got == [U1]                              # robot 1 does not receive robot 2's E-Stop
    assert r2_got == [U2]
