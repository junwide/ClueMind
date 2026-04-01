# tests/test_models.py
from sidecar.models.request import GenerateFrameworkRequest, RefineFrameworkRequest
from sidecar.models.response import FrameworkResult, NodeResult, ErrorResponse


def test_generate_framework_request():
    request = GenerateFrameworkRequest(
        type="generate_framework",
        user_input="我想整理产品设计想法",
        drops=[{"id": "d1", "content": "笔记1"}],
        provider="openai",
        model="gpt-4",
        mode="text",
        request_id="req-1",
        conversation_id="conv-1"
    )
    assert request.type == "generate_framework"
    assert request.provider == "openai"
    assert len(request.drops) == 1


def test_refine_framework_request():
    request = RefineFrameworkRequest(
        type="refine_framework",
        framework={"nodes": [], "edges": []},
        instruction="Add more detail",
        provider="openai",
        model="gpt-4",
        request_id="req-2"
    )
    assert request.type == "refine_framework"
    assert request.instruction == "Add more detail"


def test_framework_result():
    result = FrameworkResult(
        type="framework_result",
        frameworks=[{
            "id": "f1",
            "title": "Test Framework",
            "structure_type": "hierarchy",
            "nodes": [],
            "edges": []
        }],
        recommended_drops=["d1"],
        request_id="req-1"
    )
    assert result.type == "framework_result"
    assert len(result.frameworks) == 1


def test_error_response():
    error = ErrorResponse(
        type="error",
        error_code="INVALID_REQUEST",
        message="Invalid request format",
        recoverable=True,
        suggested_action="Check request format",
        request_id="req-1"
    )
    assert error.type == "error"
    assert error.recoverable is True
