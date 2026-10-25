"""Writing the router's dynamic config: Secret + restart only when it changed."""

import base64

from kubernetes.client.rest import ApiException

from app.services.acl_apply import DIGEST_ANNOTATION, AclApplier
from app.services.zenoh_acl import AclBundle


class FakeSecret:
    def __init__(self, data, annotations):
        self.data, self.metadata = data, type("M", (), {"annotations": annotations})()


class FakeCore:
    def __init__(self, existing=None):
        self.secret, self.calls = existing, []

    def read_namespaced_secret(self, name, namespace):
        if self.secret is None:
            raise ApiException(status=404)
        return self.secret

    def create_namespaced_secret(self, namespace, body):
        self.calls.append("create")
        self.secret = FakeSecret(body["data"], body["metadata"]["annotations"])

    def replace_namespaced_secret(self, name, namespace, body):
        self.calls.append("replace")
        self.secret = FakeSecret(body["data"], body["metadata"]["annotations"])


class FakeApps:
    def __init__(self, ready=True, template_digest=None):
        self.patches, self.ready, self.template_digest = [], ready, template_digest

    def patch_namespaced_deployment(self, name, namespace, body):
        self.patches.append(body)
        self.template_digest = body["spec"]["template"]["metadata"]["annotations"][DIGEST_ANNOTATION]

    def read_namespaced_deployment(self, name, namespace):
        ann = {DIGEST_ANNOTATION: self.template_digest} if self.template_digest else {}
        tmpl = type("T", (), {"metadata": type("TM", (), {"annotations": ann})()})()
        spec = type("S", (), {"replicas": 1, "template": tmpl})()
        st = type("St", (), {"observed_generation": 2, "updated_replicas": 1 if self.ready else 0,
                             "available_replicas": 1 if self.ready else 0, "replicas": 1})()
        md = type("M", (), {"generation": 2})()
        return type("D", (), {"spec": spec, "status": st, "metadata": md})()


BUNDLE = AclBundle(credentials_txt="robotics-api:ps\n", access_control_json5="{}")


def applier(core, apps):
    return AclApplier(namespace="ns", secret_name="zenoh-acl", deployment="zenoh-router", core_api=core, apps_api=apps)


async def test_creates_secret_and_restarts_router():
    core, apps = FakeCore(), FakeApps()
    assert await applier(core, apps).apply(BUNDLE) is True
    assert core.calls == ["create"]
    assert base64.b64decode(core.secret.data["credentials.txt"]).decode() == "robotics-api:ps\n"
    assert core.secret.metadata.annotations[DIGEST_ANNOTATION] == BUNDLE.digest
    ann = apps.patches[0]["spec"]["template"]["metadata"]["annotations"]
    assert ann[DIGEST_ANNOTATION] == BUNDLE.digest


async def test_same_bundle_is_a_noop():
    core = FakeCore(FakeSecret({}, {DIGEST_ANNOTATION: BUNDLE.digest}))
    apps = FakeApps(template_digest=BUNDLE.digest)
    assert await applier(core, apps).apply(BUNDLE) is False
    assert core.calls == [] and apps.patches == []


async def test_changed_bundle_replaces_and_restarts():
    core = FakeCore(FakeSecret({}, {DIGEST_ANNOTATION: "old"}))
    apps = FakeApps()
    assert await applier(core, apps).apply(BUNDLE) is True
    assert core.calls == ["replace"] and len(apps.patches) == 1


async def test_wait_ready():
    assert await applier(FakeCore(), FakeApps(ready=True)).wait_ready(timeout=1) is True
    assert await applier(FakeCore(), FakeApps(ready=False)).wait_ready(timeout=1, interval=0.2) is False


async def test_secret_written_but_restart_missed_is_repaired():
    # A previous apply wrote the Secret, then failed before restarting the router:
    # the router still runs the old config, so the restart must happen now.
    core = FakeCore(FakeSecret({}, {DIGEST_ANNOTATION: BUNDLE.digest}))
    apps = FakeApps(template_digest="old")
    assert await applier(core, apps).apply(BUNDLE) is True
    assert core.calls == [] and len(apps.patches) == 1
