# sidecar/sidecar/communication.py
import sys
import json
from typing import Dict, Any, Optional

class StdioCommunication:
    """通过 stdio 进行进程间通信"""

    def send_message(self, message: Dict[str, Any]) -> None:
        """发送 JSON 消息到 stdout"""
        json_str = json.dumps(message)
        print(json_str, flush=True)

    def receive_message(self) -> Optional[Dict[str, Any]]:
        """从 stdin 接收 JSON 消息"""
        try:
            line = sys.stdin.readline()
            if not line:
                return None
            return json.loads(line.strip())
        except json.JSONDecodeError as e:
            self.send_error(f"JSON 解析错误: {e}")
            return None

    def send_ready(self) -> None:
        """发送就绪信号"""
        self.send_message({"type": "ready", "status": "ok"})

    def send_error(self, error_message: str) -> None:
        """发送错误消息"""
        self.send_message({"type": "error", "message": error_message})
