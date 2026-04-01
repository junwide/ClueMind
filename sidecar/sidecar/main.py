# sidecar/sidecar/main.py
import sys
import signal
from .communication import StdioCommunication
from .agent.llm_provider import LLMProviderFactory
from .agent.framework_agent import FrameworkAgent
from .agent.node_agent import NodeAgent


from .prompts.framework_prompt import (
    FRAMEWORK_SYSTEM_PROMPT,
    FRAMEWORK_USER_PROMPT,
    FRAMEWORK_REFINE_PROMPT,
)


def signal_handler(sig, frame):
    """处理中断信号"""
    sys.exit(0)


def handle_message(message: dict, comm: StdioCommunication) -> None:
    """处理接收到的消息"""
    msg_type = message.get("type")
    request_id = message.get("request_id", "unknown")

    try:
        # 获取 Provider 配置
        provider = message.get("provider", "openai")
        model = message.get("model") or LLMProviderFactory.get_default_model(provider)
        api_key = message.get("api_key", "")

        if not api_key:
            comm.send_message({
                "type": "error",
                "error_code": "api_key_missing",
                "message": "API Key 未提供",
                "recoverable": True,
                "suggested_action": "请配置 API Key",
                "request_id": request_id,
            })
            return

        # 创建 LLM 实例
        llm = LLMProviderFactory.create(provider, api_key, model)

        if msg_type == "generate_framework":
            agent = FrameworkAgent(llm)
            result = agent.generate_frameworks(
                user_input=message.get("user_input", ""),
                drops=message.get("drops", []),
                mode=message.get("mode", "text"),
            )
            comm.send_message({
                "type": "framework_result",
                "frameworks": result.get("frameworks", []),
                "recommended_drops": result.get("recommended_drops", []),
                "request_id": request_id,
            })

        elif msg_type == "refine_framework":
            agent = FrameworkAgent(llm)
            result = agent.refine_framework(
                framework=message.get("framework", {}),
                instruction=message.get("instruction", ""),
            )
            comm.send_message({
                "type": "framework_result",
                "frameworks": [result],
                "recommended_drops": [],
                "request_id": request_id,
            })

        elif msg_type == "refine_node":
            agent = NodeAgent(llm)
            result = agent.refine_node(
                node=message.get("node", {}),
                instruction=message.get("instruction", ""),
                framework_context=message.get("framework_context", {}),
            )
            comm.send_message({
                "type": "node_result",
                "node": result,
                "request_id": request_id,
            })

        else:
            comm.send_message({
                "type": "error",
                "error_code": "unknown_message_type",
                "message": f"未知消息类型: {msg_type}",
                "recoverable": False,
                "request_id": request_id,
            })

    except Exception as e:
        comm.send_message({
            "type": "error",
            "error_code": "internal_error",
            "message": str(e),
            "recoverable": True,
            "suggested_action": "请重试",
            "request_id": request_id,
        })


def main():
    """Sidecar 主函数"""
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    comm = StdioCommunication()

    # 发送就绪信号
    comm.send_ready()

    # 主循环：接收和处理消息
    while True:
        message = comm.receive_message()
        if message is None:
            break

        handle_message(message, comm)


if __name__ == "__main__":
    main()
