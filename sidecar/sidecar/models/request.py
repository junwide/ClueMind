# sidecar/models/request.py
from pydantic import BaseModel
from typing import Literal, Optional


class DropData(BaseModel):
    id: str
    content: str


class BaseRequest(BaseModel):
    type: str
    request_id: str
    conversation_id: Optional[str] = None


class GenerateFrameworkRequest(BaseRequest):
    type: Literal["generate_framework"] = "generate_framework"
    user_input: str
    drops: list[DropData]
    provider: str
    model: str
    mode: Literal["text", "guided"] = "text"


class RefineFrameworkRequest(BaseRequest):
    type: Literal["refine_framework"] = "refine_framework"
    framework: dict
    instruction: str
    provider: str
    model: str


class RefineNodeRequest(BaseRequest):
    type: Literal["refine_node"] = "refine_node"
    node: dict
    instruction: str
    framework_context: dict
    provider: str
    model: str
