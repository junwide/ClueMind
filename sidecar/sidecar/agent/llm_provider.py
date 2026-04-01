from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel

PROVIDER_CONFIGS = {
    "openai": {
        "use_anthropic": False,
        "base_url": None,
        "default_model": "gpt-4",
    },
    "claude": {
        "use_anthropic": True,
        "base_url": None,
        "default_model": "claude-3-opus-20240229",
    },
    "glm": {
        "use_anthropic": False,
        "base_url": "https://open.bigmodel.cn/api/paas/v4/",
        "default_model": "glm-4",
    },
    "minimax": {
        "use_anthropic": False,
        "base_url": "https://api.minimax.chat/v1/",
        "default_model": "abab6.5-chat",
    },
}

class LLMProviderFactory:
    """多 Provider 工厂"""

    @staticmethod
    def create(provider: str, api_key: str, model: str) -> BaseChatModel:
        if provider not in PROVIDER_CONFIGS:
            raise ValueError(f"Unknown provider: {provider}. Supported: {list(PROVIDER_CONFIGS.keys())}")

        config = PROVIDER_CONFIGS[provider]

        if config.get("use_anthropic"):
            return ChatAnthropic(
                api_key=api_key,
                model=model,
            )

        return ChatOpenAI(
            api_key=api_key,
            model=model,
            base_url=config.get("base_url"),
        )

    @staticmethod
    def get_default_model(provider: str) -> str:
        if provider not in PROVIDER_CONFIGS:
            raise ValueError(f"Unknown provider: {provider}. Supported: {list(PROVIDER_CONFIGS.keys())}")

        return PROVIDER_CONFIGS[provider]["default_model"]
