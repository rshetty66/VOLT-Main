"""Structured, design-only provider adapters. Never send source rows or authorize a run."""
import json
import os
import httpx
from pydantic import BaseModel, ConfigDict
from typing import Literal


class Selection(BaseModel):
    model_config=ConfigDict(extra="forbid")
    template:Literal["close","variance","match"]
    rationale:str


def propose(brief,client=None):
    provider=os.getenv("GYAN_PLANNER","rules")
    if provider=="rules":
        import re
        choices=[k for k,p in {"close":r"\breconcil|\bbank statement|\bclose\b","variance":r"\bvariance|\bbudget",
                  "match":r"\binvoice|\bthree.way|\b3.way"}.items() if re.search(p,brief,re.I)]
        if len(choices)!=1:raise ValueError("Brief is ambiguous or unsupported; select a template or use the blank canvas")
        return Selection(template=choices[0],rationale="Matched a supported simulation contract."),{"provider":"rules","usage":None}
    if provider not in ("claude","openai","local"):raise ValueError("Unknown planning adapter")
    model=os.environ["GYAN_PLANNER_MODEL"]
    system="Design only. Select one supported simulation: close (bank/GL), variance (actual/budget), match (invoice/PO/receipt). Return only JSON with keys template and rationale. Do not perform financial calculations."
    call=client or httpx
    if provider=="claude":
        response=call.post("https://api.anthropic.com/v1/messages",timeout=25,headers={"x-api-key":os.environ["GYAN_PLANNER_KEY"],"anthropic-version":"2023-06-01"},
            json={"model":model,"max_tokens":300,"system":system,"messages":[{"role":"user","content":brief}]})
        response.raise_for_status();body=response.json();text=body["content"][0]["text"]
    else:
        base="https://api.openai.com/v1" if provider=="openai" else os.environ["GYAN_LOCAL_BASE_URL"].rstrip("/")
        headers={"Authorization":"Bearer "+os.environ["GYAN_PLANNER_KEY"]} if os.getenv("GYAN_PLANNER_KEY") else {}
        response=call.post(base+"/chat/completions",timeout=25,headers=headers,json={"model":model,
            "response_format":{"type":"json_object"},"messages":[{"role":"system","content":system},{"role":"user","content":brief}]})
        response.raise_for_status();body=response.json();text=body["choices"][0]["message"]["content"]
    return Selection.model_validate(json.loads(text)),{"provider":provider,"model":model,"usage":body.get("usage")}
