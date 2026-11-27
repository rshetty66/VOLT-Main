"""Local fixture for real stdio MCP discovery; never connects to an ERP."""
from mcp.server.fastmcp import FastMCP
s=FastMCP("fixture")


@s.tool()
def read_trial_balance()->str:
    return "reference,amount,currency\nTB-01,125.00,CAD\nTB-02,-125.00,CAD"


@s.tool()
def forbidden_operation()->str:
    return "not exposed by gateway"


if __name__=="__main__":s.run("stdio")
