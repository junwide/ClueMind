# tests/test_llm_provider.py
from sidecar.agent.llm_provider import LLMProviderFactory, PROVIDER_CONFIGS

def test_provider_configs_exist():
    """Test all required providers are configured"""
    assert "openai" in PROVIDER_CONFIGS
    assert "claude" in PROVIDER_CONFIGS
    assert "glm" in PROVIDER_CONFIGS
    assert "minimax" in PROVIDER_CONFIGS

def test_create_openai_provider():
    """Test OpenAI provider creation"""
    llm = LLMProviderFactory.create("openai", "test-key", "gpt-4")
    assert llm is not None

def test_create_glm_provider():
    """Test GLM provider with custom base_url"""
    llm = LLMProviderFactory.create("glm", "test-key", "glm-4")
    assert llm is not None

def test_create_minimax_provider():
    """Test Minimax provider with custom base_url"""
    llm = LLMProviderFactory.create("minimax", "test-key", "abab6.5-chat")
    assert llm is not None

def test_create_claude_provider():
    """Test Claude provider uses Anthropic"""
    llm = LLMProviderFactory.create("claude", "test-key", "claude-3-opus-20240229")
    assert llm is not None
    # Claude uses ChatAnthropic
    assert llm.__class__.__name__ == "ChatAnthropic"

def test_invalid_provider_raises_error():
    """Test invalid provider raises ValueError"""
    import pytest
    with pytest.raises(ValueError) as exc_info:
        LLMProviderFactory.create("unknown", "test-key", "model")
    assert "Unknown provider" in str(exc_info.value)
    assert "unknown" in str(exc_info.value)

def test_get_default_model_invalid_provider():
    """Test get_default_model raises error for invalid provider"""
    import pytest
    with pytest.raises(ValueError) as exc_info:
        LLMProviderFactory.get_default_model("unknown")
    assert "Unknown provider" in str(exc_info.value)

def test_get_default_model():
    """Test default model retrieval"""
    assert LLMProviderFactory.get_default_model("openai") == "gpt-4"
    assert LLMProviderFactory.get_default_model("claude") == "claude-3-opus-20240229"
    assert LLMProviderFactory.get_default_model("glm") == "glm-4"
    assert LLMProviderFactory.get_default_model("minimax") == "abab6.5-chat"
