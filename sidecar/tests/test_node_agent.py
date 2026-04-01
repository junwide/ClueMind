# tests/test_node_agent.py
"""Tests for Node Agent."""
from unittest.mock import Mock
from sidecar.agent.node_agent import NodeAgent


def test_node_agent_initialization():
    """Test agent initialization."""
    mock_llm = Mock()
    agent = NodeAgent(mock_llm)
    assert agent.llm == mock_llm


def test_refine_node_returns_dict():
    """Test refine_node returns node dict."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='{"id": "n1", "label": "更新", "content": "内容", "level": 0, "state": "virtual"}')

    agent = NodeAgent(mock_llm)
    result = agent.refine_node(
        node={"id": "n1", "label": "原始", "content": ""},
        instruction="细化这个节点",
        framework_context={"title": "测试框架"},
    )

    assert result["id"] == "n1"
    assert result["label"] == "更新"


def test_refine_node_preserves_id():
    """Test that refine_node preserves original node ID."""
    mock_llm = Mock()
    # LLM returns different ID, but we should preserve original
    mock_llm.invoke.return_value = Mock(content='{"id": "wrong-id", "label": "更新", "content": "内容", "level": 0, "state": "virtual"}')

    agent = NodeAgent(mock_llm)
    result = agent.refine_node(
        node={"id": "correct-id", "label": "原始", "content": ""},
        instruction="细化",
        framework_context={},
    )

    assert result["id"] == "correct-id"


def test_refine_node_with_code_block():
    """Test refine_node handles markdown code blocks."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='```json\n{"id": "n1", "label": "更新", "content": "内容"}\n```')

    agent = NodeAgent(mock_llm)
    result = agent.refine_node(
        node={"id": "n1", "label": "原始", "content": ""},
        instruction="细化",
        framework_context={},
    )

    assert result["label"] == "更新"


def test_refine_node_error_handling():
    """Test refine_node handles JSON parse errors."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='invalid json')

    agent = NodeAgent(mock_llm)
    result = agent.refine_node(
        node={"id": "n1", "label": "原始", "content": ""},
        instruction="细化",
        framework_context={},
    )

    # Should return empty structure on error
    assert "id" in result
