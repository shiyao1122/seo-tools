---
name: seo-image-prompt-generator
description: |
  SEO 落地页图片提示词生成器。读取 seo-content-generator 输出的 markdown，
  从中提取图片槽位的 alt text 和上下文描述，生成 AI 生图提示词，
  并将 markdown 中的占位图片 URL 替换为最终 URL 格式。
  触发条件：用户说"生成图片提示词"、"给图片生成提示词"、或"跑一下 image prompt"。
  工作目录：projects/seo-toolkit/skills/seo-image-prompt-generator/
  产出目录：projects/seo-toolkit/skills/seo-image-prompt-generator/outputs/
---

# SEO 图片提示词生成技能

> content markdown → 图片提示词 + 最终 URL → review 包

---

## 定位

介于 seo-content-generator 和 seo-image-generator 之间的中间层。
不生成图片，不上传图片，只从文字内容中**提取图片语义**并**生成提示词**。

---

## 核心变化：工具图标不再 AI 生成

**More Tools 卡片图**使用 `tool_icons.json`（从 `online-tools.html` 预提取的 CDN 图标 URL），
不再通过 AI 生成提示词，也不再走 `seo-image-generator` 的生图流程。

---

## 工作流程

```
seo-content-generator 输出
    ↓ content-{slug}.md（占位图 URL + alt text）

本工具：seo-image-prompt-generator
    ↓ 解析 markdown，提取所有图片条目（alt + 描述 + 当前 URL）
    ↓ [关键] tool_icon 类型 → 查 tool_icons.json，取 CDN URL，不生成 prompt
    ↓ [关键] 其他类型 → 调用 LLM 生成 AI 生图提示词
    ↓ 将 markdown 中占位 URL 替换为最终 URL
    ↓ 输出 review 包：
        ├── content-{slug}-final.md   ← URL 已替换为最终格式
        └── image_prompts.json         ← 提示词列表（含 alt → prompt 映射，
                                         tool_icon 条目仅含 URL，无 prompt 字段）

人工 review 提示词（可编辑 image_prompts.json）

确认后 → seo-image-generator（仅处理 non-tool_icon 条目）
确认后 → seo-template-filler（填模板）
```

---

## tool_icons.json

从 `https://online.hitpaw.com/online-tools.html` 预提取的工具图标映射：

```json
{
  "online-volume-changer": {
    "tool_name": "Online Volume Changer",
    "icon_url": "https://online.hitpaw.com/images/online-tools-land/online-volume-changer.webp",
    "slug": "online-volume-changer"
  },
  "online-face-animator": {
    "tool_name": "Online Face Animator",
    "icon_url": "https://online.hitpaw.com/images/online-tools-land/online-face-animator.webp",
    "slug": "online-face-animator"
  }
}
```

生成 `tool_icons.json`：
```bash
python3 scripts/extract_tool_icons.py
```

---

## 图片类型与槽位处理

| 类型 | 处理方式 | 是否生成 prompt |
|---|---|---|
| Hero 图片 | 生成提示词 → 生图 | ✅ |
| Step 截图 | 生成提示词 → 生图 | ✅ |
| Feature 配图 | 生成提示词 → 生图 | ✅ |
| UseCase 配图 | 生成提示词 → 生图 | ✅ |
| More Tools 卡片图 | **查 tool_icons.json，取 CDN URL，不生图** | ❌ |
| Bottom CTA 背景图 | 生成提示词 → 生图 | ✅ |

---

## URL 格式规范

**AI 生图图片最终 URL**：
```
https://online.hitpaw.com/images/online-tools-land/{alt-slug}.webp
```

**工具图标 URL**（来自 tool_icons.json）：
```
https://online.hitpaw.com/images/online-tools-land/{tool-slug}.webp
```

**alt slugify 规则**：
- 全部小写
- 空格/特殊字符 → 连字符 `-`
- 只保留字母、数字、连字符
- 扩展名：`.webp`

---

## image_prompts.json 结构

```json
{
  "meta": {
    "source": "content-{slug}.md",
    "generated_at": "2026-04-28 15:54",
    "total_images": 21,
    "ai_generated": 15,
    "tool_icon_from_cdn": 6
  },
  "images": [
    {
      "index": 1,
      "type": "feature",
      "alt": "AI Magic Transformation",
      "alt_slug": "ai-magic-transformation",
      "url": "https://online.hitpaw.com/images/online-tools-land/ai-magic-transformation.webp",
      "context": "Leverage cutting-edge AI to effortlessly...",
      "prompt": "A breathtaking before-and-after comparison..."
    },
    {
      "index": 2,
      "type": "tool_icon",
      "alt": "Online Volume Changer",
      "alt_slug": "online-volume-changer",
      "url": "https://online.hitpaw.com/images/online-tools-land/online-volume-changer.webp",
      "context": "Create stunning AI-powered content...",
      "prompt": null,
      "source": "tool_icons.json"
    }
  ]
}
```

**注意：** `type: "tool_icon"` 的条目 `prompt` 字段为 `null`，不进入 `seo-image-generator` 生图流程。

---

## 提示词生成策略

每个提示词的生成综合以下信息：
1. **alt 标题**：图片主题
2. **描述文字**：配图位置的功能/场景描述
3. **产品上下文**：落地页核心关键词

**生成原则**：
- 偏向视觉对比/场景化，不只描述功能
- 如果描述强调 transformation（转变/变化），prompt 应包含 before/after 概念
- 如果描述强调 elegance/beauty，prompt 应强调视觉美学
- 始终附加风格和质量后缀：`cinematic, photorealistic, 4K` 或 `bright, clean, modern product shot`
- 避免纯文字图，多用场景/对比/效果图形式
- **tool_icon 类型不生成提示词**

---

## 执行命令

**生成提示词：**
```bash
cd projects/seo-toolkit/skills/seo-image-prompt-generator/scripts
python3 generate_prompts.py "../../../outputs/content-{slug}.md"
# 依赖：tool_icons.json 存在于 outputs/ 目录
# 依赖：config.json 配置了 LLM API Key
```

**重新生成提示词（已截断/不完整时）：**
```bash
python3 regenerate_prompts.py
```

**提取工具图标（首次需运行）：**
```bash
python3 extract_tool_icons.py
```

---

## 目录结构

```
seo-image-prompt-generator/
├── SKILL.md
├── config.json              ← LLM API 配置
├── scripts/
│   ├── generate_prompts.py   ← 主脚本
│   ├── regenerate_prompts.py ← 重新生成已截断提示词
│   └── extract_tool_icons.py ← 从 online-tools.html 提取工具图标
└── outputs/
    ├── tool_icons.json              ← 工具图标 CDN URL 映射
    ├── content-{slug}-final.md      ← URL 替换后的内容 markdown
    └── content-{slug}-image-prompts.json  ← 提示词列表
```
