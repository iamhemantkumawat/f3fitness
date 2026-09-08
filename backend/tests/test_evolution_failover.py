import pytest

import server


class FakeResponse:
    status_code = 201
    text = ""

    def json(self):
        return {"key": {"id": "message-1"}}


@pytest.mark.asyncio
async def test_evolution_send_skips_disconnected_instance(monkeypatch):
    requests = []
    logs = []
    settings = {
        "evolution_api_base_url": "https://example.test",
        "evolution_api_key": "key",
        "evolution_instance_name": "F3number, f3gym",
    }

    async def fake_state(_settings, instance_name=None):
        connected = instance_name == "F3number"
        return {
            "instance_name": instance_name,
            "exists": True,
            "connected": connected,
            "state": "open" if connected else "close",
        }

    async def fake_request(_settings, _method, path, **_kwargs):
        requests.append(path)
        return FakeResponse()

    async def fake_log(log_data, _enabled=True):
        logs.append(log_data.copy())

    server._evolution_connection_cache.update({"key": None, "expires_at": 0, "connected": []})
    monkeypatch.setattr(server, "_get_evolution_connection_state", fake_state)
    monkeypatch.setattr(server, "_evolution_request", fake_request)
    monkeypatch.setattr(server, "_log_whatsapp", fake_log)

    sent = await server._send_whatsapp_evolution(
        settings,
        "+919999999999",
        "Test message",
        {},
    )

    assert sent is True
    assert requests == ["/message/sendText/F3number"]
    assert logs[0]["evolution_instance_name"] == "F3number"
    assert logs[0]["provider_attempts"] == [
        {"instance_name": "F3number", "status_code": 201, "result": "sent"}
    ]


def test_evolution_instance_names_are_unique_and_ordered():
    settings = {"evolution_instance_name": "F3number, f3gym, F3number"}

    assert server._evolution_instance_names(settings) == ["F3number", "f3gym"]
