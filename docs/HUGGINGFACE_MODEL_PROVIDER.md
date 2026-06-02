# ArchIToken Hugging Face Model Provider

本文记录 ArchIToken/ArchIToken 代码库中 Hugging Face 大模型的接入边界。目标是让聊天、代码、OCR、图像、视频和 3D 生成能力进入统一 Router，而不是让业务模块直连 Hugging Face API。

## 路由边界

标准调用链：

```text
业务模块 / Agent
  -> Gateway /v1/harness/invoke
  -> InferenceRouter
  -> OpenAiCompatibleChatAdapter(engine = hugging_face)
  -> 06-workers/engine_server.py 或 Hugging Face/TGI/vLLM OpenAI-compatible endpoint
```

媒体生成调用链：

```text
业务模块 / GenerationRouter
  -> Gateway generation engine
  -> 06-workers/engine_server.py
  -> 本地 Hugging Face media HTTP/command adapter 或 ArchIToken ComfyUI workflow adapter
  -> 可选远端 Hugging Face Inference API, 必须显式开启
```

业务模块不得直接读取 `HF_TOKEN`，也不得直接调用 `https://router.huggingface.co`、`https://api-inference.huggingface.co` 或模型供应商端点。

## 本地聊天大模型

本地优先方案是让 vLLM、TGI、llama.cpp 或自定义 worker 暴露 OpenAI-compatible `/v1/chat/completions` 和 `/v1/models`。Hugging Face TGI 的 Messages API 与 OpenAI Chat Completion schema 兼容；Inference Endpoints 使用 TGI 时也可按 `/v1` 作为 base URL 接入。

本地 worker 示例：

```bash
ARCHITOKEN_HF_LOCAL_CHAT_URL=http://127.0.0.1:8000/v1/chat/completions \
ARCHITOKEN_HF_MODEL_REPOSITORY_DIR=/var/lib/architoken/models/huggingface \
python3 06-workers/engine_server.py
```

Gateway 默认本地配置：

```toml
[inference]
default_engine = "hugging_face"

[[inference.engines]]
engine = "hugging_face"
base_url = "http://127.0.0.1:7071/v1"
api_key_env = ""
timeout_secs = 120
```

此配置让 Gateway 先进入 ArchIToken worker/provider boundary，再由 worker 根据 `ARCHITOKEN_HF_LOCAL_CHAT_URL` 调用真实本地模型运行时。

## 聊天运行时 fallback

Hugging Face 仍是首选模型资产和路由来源；但本地缓存里的 NVFP4/GGUF/量化模型只有在被真实 runtime 加载后才能聊天。若暂时没有 `ARCHITOKEN_HF_LOCAL_CHAT_URL` 或 `ARCHITOKEN_VLLM_BASE_URL`，可显式开启 fallback，让 ArchIToken 将已知 Hugging Face chat/code 模型映射到本机 Ollama、LM Studio、OpenRouter 或其他 OpenAI-compatible 服务：

```bash
ARCHITOKEN_ENABLE_CHAT_FALLBACK=1
ARCHITOKEN_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
```

Ollama 分支使用原生 `/api/chat` 并关闭 thinking 输出，以避免 OpenAI-compatible `/v1/chat/completions` 对部分 thinking 模型返回空 `content`。响应 metadata 会保留 `requestedProvider=huggingface`、`requestedModel=<HF 模型>` 和 `servedModel=<实际运行模型>`，不得把 fallback 模型伪装成原 Hugging Face 权重。

默认 Ollama fallback 会把上下文限制为 `8192`，并把 `keep_alive` 设为 `30s`。这不是降低硬件能力，而是避免部分 GGUF/量化模型按 128K/256K 默认上下文加载 KV cache，导致大模型在高配机器上仍然断连或报资源不足。需要长上下文时再按任务显式调高：

```bash
ARCHITOKEN_OLLAMA_NUM_CTX=32768
ARCHITOKEN_OLLAMA_KEEP_ALIVE=5m
```

可用 JSON 覆盖默认映射：

```bash
ARCHITOKEN_CHAT_MODEL_FALLBACKS='{"RedHatAI/Qwen3.6-35B-A3B-NVFP4":{"provider":"ollama","model":"qwen3.6:35b-a3b"},"*":{"provider":"ollama","model":"Insome:12B"}}'
```

## Hugging Face 远端端点

远端聊天可以走两种方式：

1. 推荐：Gateway 指向 `06-workers/engine_server.py`，worker 读取 `ARCHITOKEN_HF_CHAT_URL` 和 `HF_TOKEN`。
2. 特殊部署：Gateway 的 `[[inference.engines]]` 直接指向 Hugging Face Inference Providers 或 Inference Endpoint 的 `/v1` base URL，并设置 `api_key_env = "HF_TOKEN"`。

示例：

```bash
HF_TOKEN=hf_xxx
ARCHITOKEN_HF_CHAT_URL=https://router.huggingface.co/v1
ARCHITOKEN_HF_CHAT_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct
```

如果使用远端媒体生成，还必须显式设置：

```bash
ARCHITOKEN_HF_REMOTE_ENABLED=1
```

默认不自动调用远端媒体 API，避免在未审查数据边界、费用和模型许可时上传工程资料。

## 模型仓库与缓存

使用 `hf` CLI 登录和下载模型：

```bash
hf auth login --token "$HF_TOKEN"
hf download Qwen/Qwen2.5-Coder-32B-Instruct \
  --local-dir /var/lib/architoken/models/huggingface/Qwen/Qwen2.5-Coder-32B-Instruct
```

worker 会扫描：

- `ARCHITOKEN_HF_MODEL_REPOSITORY_DIR`
- `ARCHITOKEN_MODEL_REPOSITORY_DIR/huggingface`
- `06-workers/data/model-repository/huggingface`
- Hugging Face cache, 除非 `ARCHITOKEN_HF_CACHE_MODELS_ENABLED=0`

缓存或下载到本地只代表模型资产存在，不代表模型已被加载为可执行 runtime。聊天/代码模型仍需 `/v1/models` 广告相同 model id；图像、视频、OCR、3D 和视觉 embedding 模型仍需本地 HTTP/command adapter 或经过验证的 ComfyUI workflow。

## ComfyUI 工作流适配

ComfyUI 是 ArchIToken 的多模态工作流执行层，不替代 ModelRouter / InferenceRouter。当前仓库提供：

- `06-workers/comfyui_custom_nodes/architoken_hf_runtime/`：安装到 ComfyUI 后，可在 ComfyUI 内加载本地 Hugging Face Diffusers 仓库。
- `06-workers/architoken_workers/comfyui_media_command.py`：供 `engine_server.py` 通过 command adapter 排队执行 ComfyUI API workflow。
- 本地模型资产链接到 ComfyUI `models/` 目录后，仍必须通过一次真实生成或 workflow smoke test 后，才能在 `/v1/models` 标记为 `runtimeConfigured=true`。

通用 workflow 文件可用占位符注入：

```json
{
  "1": {
    "class_type": "SomeComfyNode",
    "inputs": {
      "prompt": "{{prompt}}",
      "model": "{{model}}",
      "model_repository": "{{model_repository}}",
      "width": "{{width}}",
      "height": "{{height}}",
      "seed": "{{seed}}"
    }
  }
}
```

对应环境变量按任务配置，例如：

```bash
COMFYUI_URL=http://127.0.0.1:8188
ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_COMMAND="/home/insome/ComfyUI/venv/bin/python /home/insome/dev/insomeos/06-workers/architoken_workers/comfyui_media_command.py"
ARCHITOKEN_COMFYUI_WORKFLOW_IMAGE_TO_VIDEO=/var/lib/architoken/workflows/ltx-image-to-video.json
ARCHITOKEN_COMFYUI_WORKFLOW_OCR=/var/lib/architoken/workflows/paddleocr-vl.json
```

不要默认开启 `ARCHITOKEN_HF_LOCAL_MEDIA_COMMAND` 覆盖所有任务；不同任务的输出类型、输入 artifact 和许可边界不同，必须分别配置。

## 推荐环境变量

```bash
HF_TOKEN=hf_xxx
ARCHITOKEN_HF_MODEL_REPOSITORY_DIR=/var/lib/architoken/models/huggingface
ARCHITOKEN_HF_LOCAL_CHAT_URL=http://127.0.0.1:8000/v1/chat/completions
ARCHITOKEN_HF_CHAT_MODEL=nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4
ARCHITOKEN_HF_CODE_MODEL=Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8
ARCHITOKEN_ENABLE_CHAT_FALLBACK=1
ARCHITOKEN_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
ARCHITOKEN_OLLAMA_NUM_CTX=8192
ARCHITOKEN_OLLAMA_KEEP_ALIVE=30s

ARCHITOKEN_TEXT_TO_IMAGE_PROVIDER=huggingface
ARCHITOKEN_IMAGE_TO_VIDEO_PROVIDER=huggingface
ARCHITOKEN_HF_LOCAL_TEXT_TO_IMAGE_URL=http://127.0.0.1:7860/v1/generate/text-to-image
ARCHITOKEN_HF_LOCAL_IMAGE_TO_VIDEO_URL=http://127.0.0.1:7861/v1/generate/image-to-video
COMFYUI_URL=http://127.0.0.1:8188
ARCHITOKEN_DISABLE_HF_AUTO_LOCAL_MEDIA_COMMAND=1
ARCHITOKEN_HF_REMOTE_ENABLED=0
```

`ARCHITOKEN_HF_MODEL_ROUTES` 可一次性覆盖能力路由：

```bash
ARCHITOKEN_HF_MODEL_ROUTES='{"chat":"nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4","code":"Multilingual-Multimodal-NLP/IndustrialCoder-Thinking-32B-FP8","ocr":"PaddlePaddle/PaddleOCR-VL-1.5","text_to_image":"baidu/ERNIE-Image","image_to_video":"Lightricks/LTX-2.3-nvfp4"}'
```

## 许可与合规

Hugging Face 平台、模型权重、数据集和 endpoint provider 是不同许可对象。每个模型进入生产白名单前必须记录：

- 模型仓库 URL、revision 或 digest
- license / gated terms / commercial-use boundary
- 运行位置：本地、私有 endpoint、Hugging Face Inference Provider
- 数据是否离开租户边界
- 可用于哪些模块和哪些输出等级

缺少许可或专业规则证据时，系统只能输出启发式建议，不能标记为合规、送审就绪、施工就绪或验收就绪。

## 官方参考

- Hugging Face TGI Messages API: https://huggingface.co/docs/text-generation-inference/messages_api
- Hugging Face Inference Providers Chat Completion: https://huggingface.co/docs/inference-providers/en/tasks/chat-completion
- Hugging Face CLI: https://huggingface.co/docs/huggingface_hub/en/package_reference/cli
