import asyncio
import json
import sys
from pathlib import Path
import httpx
import pytest
from gyan_agents.gateway import MCPGateway
from gyan_agents.planner import propose


def test_stdio_mcp_real_server(tmp_path,monkeypatch):
    cfg={"alpha":{"ledger":{"transport":"stdio","command":sys.executable,
        "args":[str(Path(__file__).with_name("mcp_fixture_server.py"))],"read_allowlist":["read_trial_balance"]}}}
    p=tmp_path/"config.json";p.write_text(json.dumps(cfg));monkeypatch.setenv("GYAN_MCP_CONFIG",str(p))
    gateway=MCPGateway("alpha")
    assert asyncio.run(gateway.discover("ledger"))==["read_trial_balance"]
    assert "TB-02" in asyncio.run(gateway.read("ledger","read_trial_balance"))
    with pytest.raises(ValueError):asyncio.run(MCPGateway("beta").discover("ledger"))


@pytest.mark.parametrize("provider",["claude","openai","local"])
def test_provider_structure(provider,monkeypatch):
    monkeypatch.setenv("GYAN_PLANNER",provider);monkeypatch.setenv("GYAN_PLANNER_MODEL","fixture")
    monkeypatch.setenv("GYAN_PLANNER_KEY","fixture-only");monkeypatch.setenv("GYAN_LOCAL_BASE_URL","http://localhost:9912/v1")
    def handler(request):
        value=json.dumps({"template":"match","rationale":"Invoice matching"})
        return httpx.Response(200,json={"usage":{"input_tokens":10},"content":[{"text":value}],"choices":[{"message":{"content":value}}]})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        choice,audit=propose("Three-way invoice matching",client)
    assert choice.template=="match" and audit["provider"]==provider and audit["usage"]
