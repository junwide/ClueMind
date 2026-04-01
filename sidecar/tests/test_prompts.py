# tests/test_prompts.py
"""Tests for prompt templates."""
from sidecar.prompts import (
    FRAMEWORK_SYSTEM_PROMPT,
    FRAMEWORK_USER_PROMPT,
    FRAMEWORK_REFINE_PROMPT,
    NODE_SYSTEM_PROMPT,
    NODE_USER_PROMPT,
)


def test_framework_system_prompt_content():
    """Test framework system prompt contains required elements."""
    assert "知识框架设计师" in FRAMEWORK_SYSTEM_PROMPT
    assert "3 个不同结构的框架方案" in FRAMEWORK_SYSTEM_PROMPT
    assert "金字塔结构" in FRAMEWORK_SYSTEM_PROMPT
    assert "支柱结构" in FRAMEWORK_SYSTEM_PROMPT
    assert "JSON" in FRAMEWORK_SYSTEM_PROMPT
    assert "supports" in FRAMEWORK_SYSTEM_PROMPT
    assert "extends" in FRAMEWORK_SYSTEM_PROMPT


def test_prompt_placeholders():
    """Test prompts have correct placeholders."""
    assert "{user_input}" in FRAMEWORK_USER_PROMPT
    assert "{drops}" in FRAMEWORK_USER_PROMPT
    assert "{framework}" in FRAMEWORK_REFINE_PROMPT
    assert "{instruction}" in FRAMEWORK_REFINE_PROMPT
    assert "{node}" in NODE_USER_PROMPT
    assert "{framework_context}" in NODE_USER_PROMPT
    assert "{instruction}" in NODE_USER_PROMPT


def test_prompts_are_strings():
    """Test all prompts are non-empty strings."""
    assert isinstance(FRAMEWORK_SYSTEM_PROMPT, str)
    assert len(FRAMEWORK_SYSTEM_PROMPT) > 100
    assert isinstance(FRAMEWORK_USER_PROMPT, str)
    assert len(FRAMEWORK_USER_PROMPT) > 50
    assert isinstance(NODE_SYSTEM_PROMPT, str)
    assert len(NODE_SYSTEM_PROMPT) > 100
    assert isinstance(NODE_USER_PROMPT, str)
    assert len(NODE_USER_PROMPT) > 50
