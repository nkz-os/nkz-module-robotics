"""
Push the rendered ACL to the router: Secret `zenoh-acl` (not managed by ArgoCD)
plus a digest annotation on the router's pod template, which restarts it.
The Secret is written when its digest differs; the router is restarted when the
digest on its pod template differs — that annotation, not the Secret, says what
the router runs, so a restart missed after a write is repaired on the next apply.
Blocking Kubernetes calls run in a thread.
"""

import asyncio
import base64
import time

from kubernetes.client.rest import ApiException

from app.services.zenoh_acl import AclBundle

DIGEST_ANNOTATION = "robotics.nkz-os.org/acl-digest"


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


class AclApplier:
    def __init__(self, namespace: str, secret_name: str, deployment: str, core_api=None, apps_api=None):
        self._ns, self._secret, self._deployment = namespace, secret_name, deployment
        self._core, self._apps = core_api, apps_api

    def _clients(self):
        if self._core is None or self._apps is None:
            from kubernetes import client, config

            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()
            self._core, self._apps = client.CoreV1Api(), client.AppsV1Api()
        return self._core, self._apps

    async def apply(self, bundle: AclBundle) -> bool:
        """Write the bundle; return True when the router was asked to restart."""
        return await asyncio.to_thread(self._apply_blocking, bundle)

    def _apply_blocking(self, bundle: AclBundle) -> bool:
        core, apps = self._clients()
        digest = bundle.digest
        body = {
            "apiVersion": "v1", "kind": "Secret", "type": "Opaque",
            "metadata": {"name": self._secret, "namespace": self._ns,
                         "labels": {"app": "zenoh-router", "managed-by": "robotics-api"},
                         "annotations": {DIGEST_ANNOTATION: digest}},
            "data": {"credentials.txt": _b64(bundle.credentials_txt),
                     "access_control.json5": _b64(bundle.access_control_json5)},
        }
        try:
            current = core.read_namespaced_secret(self._secret, self._ns)
        except ApiException as exc:
            if exc.status != 404:
                raise
            core.create_namespaced_secret(self._ns, body)
        else:
            annotations = (current.metadata.annotations or {}) if current.metadata else {}
            if annotations.get(DIGEST_ANNOTATION) != digest:
                core.replace_namespaced_secret(self._secret, self._ns, body)
        deployment = apps.read_namespaced_deployment(self._deployment, self._ns)
        template_md = deployment.spec.template.metadata if deployment.spec.template else None
        if ((template_md.annotations or {}) if template_md else {}).get(DIGEST_ANNOTATION) == digest:
            return False
        apps.patch_namespaced_deployment(self._deployment, self._ns, {
            "spec": {"template": {"metadata": {"annotations": {DIGEST_ANNOTATION: digest}}}}})
        return True

    async def wait_ready(self, timeout: float = 120.0, interval: float = 2.0) -> bool:
        return await asyncio.to_thread(self._wait_blocking, timeout, interval)

    def _wait_blocking(self, timeout: float, interval: float) -> bool:
        _, apps = self._clients()
        deadline = time.monotonic() + timeout
        while True:
            d = apps.read_namespaced_deployment(self._deployment, self._ns)
            want = d.spec.replicas or 1
            st = d.status
            if ((st.observed_generation or 0) >= (d.metadata.generation or 0)
                    and (st.updated_replicas or 0) >= want and (st.available_replicas or 0) >= want
                    and (st.replicas or 0) == want):
                return True
            if time.monotonic() >= deadline:
                return False
            time.sleep(interval)
