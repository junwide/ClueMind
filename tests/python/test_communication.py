# tests/python/test_communication.py
import json
import pytest
from sidecar.communication import StdioCommunication

def test_send_ready(capsys):
    """测试发送就绪信号"""
    comm = StdioCommunication()
    comm.send_ready()

    captured = capsys.readouterr()
    result = json.loads(captured.out)

    assert result == {"type": "ready", "status": "ok"}

def test_send_error(capsys):
    """测试发送错误消息"""
    comm = StdioCommunication()
    comm.send_error("测试错误")

    captured = capsys.readouterr()
    result = json.loads(captured.out)

    assert result["type"] == "error"
    assert "测试错误" in result["message"]

def test_send_message(capsys):
    """测试发送自定义消息"""
    comm = StdioCommunication()
    comm.send_message({"type": "custom", "data": "test"})

    captured = capsys.readouterr()
    result = json.loads(captured.out)

    assert result == {"type": "custom", "data": "test"}
