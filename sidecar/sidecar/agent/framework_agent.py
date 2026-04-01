# sidecar/agent/framework_agent.py
"""Framework generation and refinement agent."""
import json
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from ..prompts.framework_prompt import (
    FRAMEWORK_SYSTEM_PROMPT,
    FRAMEWORK_USER_PROMPT,
    FRAMEWORK_REFINE_PROMPT,
)


class FrameworkAgent:
    """框架生成 Agent"""

    def __init__(self, llm: BaseChatModel):
        self.llm = llm

    def generate_frameworks(
        self,
        user_input: str,
        drops: list[dict],
        mode: str = "text",
    ) -> dict:
        """生成 3 个框架方案"""
        drops_text = "\n".join([
            f"- [{d['id']}] {d['content']}"
            for d in drops
        ]) if drops else "无相关素材"

        user_prompt = FRAMEWORK_USER_PROMPT.format(
            user_input=user_input,
            drops=drops_text,
        )

        messages = [
            SystemMessage(content=FRAMEWORK_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        response = self.llm.invoke(messages)

        # 解析 JSON 响应
        return self._parse_json_response(response.content)

    def refine_framework(
        self,
        framework: dict,
        instruction: str,
    ) -> dict:
        """迭代优化框架"""
        user_prompt = FRAMEWORK_REFINE_PROMPT.format(
            framework=json.dumps(framework, ensure_ascii=False, indent=2),
            instruction=instruction,
        )

        messages = [
            SystemMessage(content=FRAMEWORK_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        response = self.llm.invoke(messages)
        content = response.content

        parsed = self._parse_json_response(content)
        # If parsing succeeded and we got a frameworks list, return the first one
        if "frameworks" in parsed and parsed["frameworks"]:
            return parsed["frameworks"][0]
        return parsed

    def _parse_json_response(self, content: str) -> dict[str, Any]:
        """Parse JSON from LLM response, handling code blocks."""
        try:
            # 尝试提取 JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            result = json.loads(content.strip())
            return result
        except json.JSONDecodeError:
            return {
                "frameworks": [],
                "recommended_drops": [],
                "error": "Failed to parse response",
            }
