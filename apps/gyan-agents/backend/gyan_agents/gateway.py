"""Operator-configured MCP read gateway; clients cannot supply a host, command or token."""
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client


class MCPGateway:
    def __init__(self, project):
        p=os.getenv("GYAN_MCP_CONFIG")
        self.servers=json.loads(Path(p).read_text()).get(project,{}) if p else {}

    @asynccontextmanager
    async def session(self, server):
        if server not in self.servers: raise ValueError("Source not authorized for this project")
        cfg=self.servers[server]
        if cfg["transport"]=="stdio":
            pipe=stdio_client(StdioServerParameters(command=cfg["command"],args=cfg.get("args",[]),
                env={k:os.environ[k] for k in cfg.get("env_allowlist",[])}))
        elif cfg["transport"]=="sse" and cfg["url"].startswith("https://"):
            pipe=sse_client(cfg["url"],headers={"Authorization":"Bearer "+os.environ[cfg["token_env"]]},timeout=8,sse_read_timeout=15)
        else: raise ValueError("Unsupported operator configuration")
        async with pipe as streams, ClientSession(streams[0],streams[1]) as session:
            await session.initialize()
            discovered={t.name for t in (await session.list_tools()).tools}
            yield session, discovered.intersection(cfg["read_allowlist"])

    async def discover(self,server):
        async with self.session(server) as (_,allowed): return sorted(allowed)

    async def read(self,server,tool):
        async with self.session(server) as (session,allowed):
            if tool not in allowed: raise ValueError("Tool not on project read allowlist")
            # Query and resource constraints are operator settings, not user SQL.
            args=self.servers[server].get("queries",{}).get(tool,{})
            result=await session.call_tool(tool,args)
            if result.isError: raise ValueError("Upstream read failed")
            text="".join(c.text for c in result.content if c.type=="text")
            if len(text.encode())>2_000_000: raise ValueError("Upstream source too large")
            return text
