# sidecar/prompts/framework_prompt.py
"""Framework generation prompts."""

FRAMEWORK_SYSTEM_PROMPT = """你是一个知识框架设计师。根据用户输入和相关素材，生成结构化的知识框架。

输出要求：
1. 生成 3 个不同结构的框架方案（金字塔结构、支柱结构、自定义结构）
2. 每个框架包含 5-15 个节点
3. 节点间关系使用以下类型：supports（支持）、extends（扩展）、contradicts（对比）
4. 必须输出有效的 JSON 格式

输出格式示例：
{
  "frameworks": [
    {
      "id": "fw-1",
      "title": "框架标题",
      "structure_type": "pyramid",
      "nodes": [
        {"id": "n1", "label": "节点标签", "content": "节点内容", "level": 0, "state": "virtual"}
      ],
      "edges": [
        {"id": "e1", "source": "n1", "target": "n2", "relationship": "supports"}
      ]
    }
  ],
  "recommended_drops": ["drop-id-1"]
}"""

FRAMEWORK_USER_PROMPT = """用户需求：
{user_input}

相关素材：
{drops}

请生成 3 个框架方案，输出 JSON 格式。"""

FRAMEWORK_REFINE_PROMPT = """当前框架：
{framework}

用户修改指令：
{instruction}

请根据指令优化框架，输出更新后的完整框架 JSON。"""
