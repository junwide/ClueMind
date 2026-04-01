# tests/test_framework_agent.py
"""Tests for Framework Agent."""
from unittest.mock import Mock, patch
from sidecar.agent.framework_agent import FrameworkAgent


def test_framework_agent_initialization():
    """Test agent initialization."""
    mock_llm = Mock()
    agent = FrameworkAgent(mock_llm)
    assert agent.llm == mock_llm


def test_generate_frameworks_returns_dict():
    """Test generate_frameworks returns parsed dict."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='{"frameworks": [], "recommended_drops": []}')

    agent = FrameworkAgent(mock_llm)
    result = agent.generate_frameworks(
        user_input="测试输入",
        drops=[],
        mode="text"
    )

    assert "frameworks" in result
    assert "recommended_drops" in result


def test_generate_frameworks_with_drops():
    """Test generate_frameworks with drops."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='{"frameworks": [{"id": "fw-1"}], "recommended_drops": []}')

    agent = FrameworkAgent(mock_llm)
    result = agent.generate_frameworks(
        user_input="测试输入",
        drops=[{"id": "d1", "content": "素材内容"}],
        mode="text"
    )

    assert "frameworks" in result


def test_refine_framework_returns_dict():
    """Test refine_framework returns framework dict."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='{"frameworks": [{"id": "fw-1", "title": "优化后"}], "recommended_drops": []}')

    agent = FrameworkAgent(mock_llm)
    result = agent.refine_framework(
        framework={"id": "fw-1", "title": "原始框架"},
        instruction="添加更多细节"
    )

    assert "id" in result


def test_parse_json_with_code_block():
    """Test JSON parsing handles markdown code blocks."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='```json\n{"frameworks": [], "recommended_drops": []}\n```')

    agent = FrameworkAgent(mock_llm)
    result = agent.generate_frameworks("test", [])

    assert result == {"frameworks": [], "recommended_drops": []}


def test_parse_json_error_handling():
    """Test JSON parsing error returns error dict."""
    mock_llm = Mock()
    mock_llm.invoke.return_value = Mock(content='invalid json')

    agent = FrameworkAgent(mock_llm)
    result = agent.generate_frameworks("test", [])

    assert "error" in result
