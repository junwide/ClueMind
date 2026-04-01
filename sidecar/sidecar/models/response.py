# sidecar/models/response.py
from pydantic import BaseModel
from typing import Literal, Optional


class FrameworkProposal(BaseModel):
    id: str
    title: str
    structure_type: str
    nodes: list[dict]
    edges: list[dict]


class FrameworkResult(BaseModel):
    type: Literal["framework_result"] = "framework_result"
    frameworks: list[FrameworkProposal]
    recommended_drops: list[str] = []
    request_id: str


class NodeResult(BaseModel):
    type: Literal["node_result"] = "node_result"
    node: dict
    request_id: str


class ErrorResponse(BaseModel):
    type: Literal["error"] = "error"
    error_code: str
    message: str
    recoverable: bool
    suggested_action: Optional[str] = None
    request_id: str
