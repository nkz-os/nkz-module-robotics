"""A browser WebSocket handshake carries the page Origin; sibling subdomains are same-site."""

from app.middleware.ws_auth import allowed_origins, origin_allowed


def test_browser_origin_must_be_allowed():
    assert origin_allowed("https://ui.example", ["https://ui.example"])
    assert not origin_allowed("https://evil.example", ["https://ui.example"])


def test_null_origin_is_rejected():
    assert not origin_allowed("null", ["https://ui.example"])


def test_non_browser_client_without_origin_is_allowed():
    assert origin_allowed(None, ["https://ui.example"])


def test_allowlist_comes_from_cors_origins(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "CORS_ORIGINS", " https://a.example, https://b.example ")
    assert allowed_origins() == ["https://a.example", "https://b.example"]
    monkeypatch.setattr(settings, "CORS_ORIGINS", "")
    assert allowed_origins() == []
