---
name: seo-image-generator
description: |
  SEO 落地页图片生成器。读取 seo-image-prompt-generator 输出的 image_prompts.json，
  调用 AI 生图 API 生成图片文件，输出 .webp 命名的图片文件到指定目录。
  触发条件：用户说"生成图片"、"生成落地页图片"、"跑一下 image generator"。
  工作目录：projects/seo-toolkit/skills/seo-image-generator/
  产出目录：projects/seo-toolkit/skills/seo-image-generator/outputs/
---

# SEO 图片生成技能

> image_prompts.json → AI 生图 API → .webp 图片文件

---

## 定位

seo-content-generator 和 seo-image-prompt-generator 的下游。
读取提示词 JSON，调用生图 API，输出标准化命名的 .webp 图片。

---

## 目录结构

```
seo-image-generator/
├── SKILL.md
├── config.json              ← API Keys 和 provider 优先级配置
├── scripts/
│   └── generate_images.py  ← 主脚本
└── outputs/                 ← 图片产出目录
    └── {alt-slug}.webp
```

---

## config.json 配置

```json
{
  "providers": {
    "primary": "openai",
    "fallbacks": ["minimax", "google"],
    "openai": {
      "model": "gpt-image-1",
      "api_key": "${OPENAI_API_KEY}"
    },
    "minimax": {
      "model": "image-01",
      "api_key": "${MINIMAX_API_KEY}"
    },
    "google": {
      "model": "gemini-3.1-flash-image-preview",
      "api_key": "${GEMINI_API_KEY}"
    }
  },
  "output_dir": "../outputs",
  "format": "webp"
}
```

**Provider 优先级策略**：
1. 按 `providers.primary` 指定顺序尝试
2. 如果失败，按 `providers.fallbacks` 顺序 fallback
3. 每个 provider 失败后自动切换下一个，直到成功
4. 全部失败则抛出错误

---

## 输入文件格式

image_prompts.json 结构：
```json
{
  "meta": { "source": "...", "generated_at": "...", "total_images": 16 },
  "images": [
    {
      "index": 1,
      "type": "hero",
      "alt": "AI Magic Transformation",
      "alt_slug": "ai-magic-transformation",
      "url": "https://online.hitpaw.com/images/online-tools-land/ai-magic-transformation.webp",
      "context": "Leverage cutting-edge AI...",
      "prompt": "A breathtaking before-and-after comparison..."
    }
  ]
}
```

关键字段：
- `alt_slug`：用于文件命名
- `prompt`：AI 生图提示词
- `url`：图片最终 URL（用于 reference，不一定直接下载）

---

## 执行命令

```bash
cd projects/seo-toolkit/skills/seo-image-generator/scripts
python3 generate_images.py "../../../skills/seo-image-prompt-generator/outputs/image_prompts.json"

# 或用绝对路径
python3 generate_images.py "/home/shiyao/clawd/projects/seo-toolkit/skills/seo-image-prompt-generator/outputs/image_prompts.json"
```

---

## 输出

每个提示词生成一张 `.webp` 图片，保存到 `outputs/` 目录：
```
outputs/ai-magic-transformation.webp
outputs/upload-your-images.webp
outputs/feature-ai-portrait-studio.webp
...
```

日志示例：
```
[1/16] Generating: ai-magic-transformation.webp
  Provider: openai (gpt-image-1) ... OK
[2/16] Generating: upload-your-images.webp
  Provider: openai (gpt-image-1) ... FAIL (rate limit)
  Provider: minimax (image-01) ... OK
...
Total: 16 | Success: 16 | Failed: 0
```

---

## API Provider 映射

| Provider | Model | Image Tool Call |
|---|---|---|
| `openai` | gpt-image-1 | `image_generate(model="openai/gpt-image-1")` |
| `minimax` | image-01 | `image_generate(model="minimax/image-01")` |
| `google` | gemini-3.1-flash-image-preview | `image_generate(model="google/gemini-3.1-flash-image-preview")` |

工具调用通过 OpenClaw image_generate 工具实现。

---

## 错误处理

- **网络错误 / API 错误**：记录后尝试下一个 provider
- **全部 provider 失败**：输出失败条目列表，退出码 1
- **无效 JSON 输入**：抛出明确错误信息
- **缺失字段**：跳过该项并 warning，记录 alt_slug
