# sidecar/agent/node_agent.py
"""Node refinement agent."""
import json
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from ..prompts.node_prompt import NODE_SYSTEM_PROMPT, NODE_USER_PROMPT


class NodeAgent:
    """节点级对话 Agent"""

    def __init__(self, llm: BaseChatModel):
        self.llm = llm

    def refine_node(
        self,
        node: dict,
        instruction: str,
        framework_context: dict,
    ) -> dict:
        """细化单个节点"""
        user_prompt = NODE_USER_PROMPT.format(
            node=json.dumps(node, ensure_ascii=False, indent=2),
            framework_context=json.dumps(framework_context, ensure_ascii=False, indent=2),
            instruction=instruction,
        )

        messages = [
            SystemMessage(content=NODE_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        response = self.llm.invoke(messages)
        content = response.content

        result = self._parse_json_response(content)
        # 确保 ID 不变
        if "id" in node:
            result["id"] = node["id"]
        return result

    def _parse_json_response(self, content: str) -> dict[str, Any]:
        """Parse JSON from LLM response, handling code blocks."""
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content.strip())
        except json.JSONDecodeError:
            # 解析失败返回空节点结构
            return {"id": "", "label": "", "content": "", "level": 0, "state": "virtual"}
