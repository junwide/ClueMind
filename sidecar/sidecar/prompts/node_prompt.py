# sidecar/prompts/node_prompt.py
"""Node refinement prompts."""

NODE_SYSTEM_PROMPT = """你是一个知识节点细化助手。根据用户指令细化单个知识节点的内容。

输出要求：
1. 保持节点 ID 不变
2. 更新节点的 label 和 content
3. 可以调整 level 但不能改变节点在框架中的位置
4. 必须输出有效的 JSON 格式

输出格式：
{
  "id": "原节点ID",
  "label": "更新后的标签",
  "content": "更新后的内容",
  "level": 0,
  "state": "virtual"
}"""

NODE_USER_PROMPT = """当前节点：
{node}

框架上下文：
{framework_context}

用户细化指令：
{instruction}

请细化节点，输出 JSON 格式。"""
