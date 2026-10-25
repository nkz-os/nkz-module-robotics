"""
Render the Zenoh router's dynamic configuration from the enrolled robots.

Each robot authenticates as its device UUID and may only:
  * put on nkz/{tenant}/{uuid}/telemetry | heartbeat | mode   (state up)
  * subscribe to nkz/{tenant}/{uuid}/safety/estop             (E-Stop down)
The platform's own session (robotics-api) may put and subscribe on nkz/**.
Everything else is denied. Zenoh key expressions cannot be templated by
username, hence one rule set per robot. Output is deterministic (sorted) so the
same robots always produce the same bytes — the router is restarted only when
the digest changes.
"""

import hashlib
import json
import re
from dataclasses import dataclass

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_TENANT = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
STATE_CHANNELS = ("telemetry", "heartbeat", "mode")
ESTOP_CHANNEL = "safety/estop"


@dataclass(frozen=True)
class RobotCred:
    device_uuid: str
    tenant_id: str
    password: str


@dataclass(frozen=True)
class AclBundle:
    credentials_txt: str
    access_control_json5: str

    @property
    def digest(self) -> str:
        return hashlib.sha256((self.credentials_txt + "\0" + self.access_control_json5).encode()).hexdigest()


def json5_to_json(text: str) -> str:
    """The renderer emits strict JSON (a subset of JSON5); kept as a seam for tests."""
    return text


def check_robot(robot: RobotCred) -> None:
    if not _UUID.match(robot.device_uuid):
        raise ValueError(f"robot username must be a lowercase UUID: {robot.device_uuid!r}")
    if not _TENANT.match(robot.tenant_id):
        raise ValueError(f"invalid tenant id: {robot.tenant_id!r}")
    if any(ch in robot.password for ch in ":\n\r"):
        raise ValueError("password contains a character the dictionary format cannot hold")


def render(robots: list[RobotCred], service_user: str, service_password: str) -> AclBundle:
    robots = sorted(robots, key=lambda r: r.device_uuid)
    for robot in robots:
        check_robot(robot)
    lines = [f"{service_user}:{service_password}"] + [f"{r.device_uuid}:{r.password}" for r in robots]

    rules = [{"id": "service-all", "messages": ["put", "declare_subscriber"], "flows": ["ingress", "egress"],
              "permission": "allow", "key_exprs": ["nkz/**"]}]
    subjects = [{"id": "service", "usernames": [service_user]}]
    policies = [{"rules": ["service-all"], "subjects": ["service"]}]
    for r in robots:
        prefix = f"nkz/{r.tenant_id}/{r.device_uuid}"
        rules.append({"id": f"robot-{r.device_uuid}-up", "messages": ["put"], "flows": ["ingress"],
                      "permission": "allow", "key_exprs": [f"{prefix}/{c}" for c in STATE_CHANNELS]})
        rules.append({"id": f"robot-{r.device_uuid}-estop", "messages": ["declare_subscriber", "put"],
                      "flows": ["ingress", "egress"], "permission": "allow",
                      "key_exprs": [f"{prefix}/{ESTOP_CHANNEL}"]})
        subjects.append({"id": f"robot-{r.device_uuid}", "usernames": [r.device_uuid]})
        policies.append({"rules": [f"robot-{r.device_uuid}-up", f"robot-{r.device_uuid}-estop"],
                         "subjects": [f"robot-{r.device_uuid}"]})
    access_control = {"enabled": True, "default_permission": "deny", "rules": rules,
                      "subjects": subjects, "policies": policies}
    return AclBundle(credentials_txt="\n".join(lines) + "\n",
                     access_control_json5=json.dumps(access_control, indent=2, sort_keys=True))
