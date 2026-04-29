# SEO 落地页批量生成工具 — PRD v1.1

---

## 1. 产品目标

帮助 SEO 运营团队快速生成 HitPaw 各站点落地页：将「关键词」输入，自动化完成**内容生成 → 图片生成 → HTML 输出」全流程，最终交付可直接上线的落地页包（HTML + 图片 + JSON-LD）。

---

## 2. 背景与现状

HitPaw 站点落地页靠人工编写，存在以下痛点：
- 内容生产慢，人力瓶颈明显
- 图片不统一，风格参差
- 多站点同步成本高

已有 4 个 SKILL（seo-content-generator / seo-image-prompt-generator / seo-image-generator / seo-template-filler）已验证流程可行，已在本地跑通完整链路（AI Photo Enhancer 落地页）。

---

## 3. 用户角色

**SEO 运营同学** — 不需要写代码，通过可视化界面操作全流程。

---

## 4. 功能范围

### 4.1 整体流程

```
输入：关键词（如 "AI Photo Enhancer"）
    ↓
Step 1 · 内容生成
    输出：content-{slug}.md（落地页文字内容）
    ↓
Step 2 · 图片提示词生成
    输入：content-{slug}.md
    输出：
      - content-{slug}-final.md（URL 已替换）
      - image_prompts.json（N 条，含 alt/prompt/URL/type，tool_icon 条目 prompt=null）
    ↓
Step 3 · 图片生成
    输入：image_prompts.json
    输出：N 张 .webp 图片（约 12~25 张，取决于内容）
         ⚠️ tool_icon 类型直接使用 CDN URL，不生图
    ↓
Step 4 · HTML 模板填充
    输入：content-final.md + structure.html
    输出：fill-{slug}.html + .jsonld.json + .seo-meta.json + .faq.json
    ↓
下载交付包
```

---

### 4.2 重要变化：图片数量不固定，工具图标来自 CDN

**图片数量说明：** 不再固定 21 张，由落地页内容决定。

典型范围：

| 类型 | 数量 | 处理方式 |
|---|---|---|
| Hero 图片 | 1 张 | AI 生图 |
| Step 截图 | N 张 | AI 生图 |
| Feature 配图 | N 张 | AI 生图 |
| UseCase 配图 | N 张 | AI 生图 |
| More Tools 卡片图 | N 张 | **来自 CDN**，不 AI 生成 |
| Bottom CTA 背景图 | 1 张 | AI 生图 |

**典型数量范围：12~25 张**（取决于落地页复杂度）

**工具图标来自预提取的 CDN：**
- 从 `https://online.hitpaw.com/online-tools.html` 预提取工具图标 URL，存储到 `tool_icons.json`
- More Tools 区块的工具图标直接使用 CDN URL
- 不走 AI 生图流程，不消耗 API 配额

---

### 4.3 Step 1 — 内容生成

**输入：** 关键词（产品名称/核心词）

**输出：**
- `content-{slug}.md` — 落地页完整文字内容（Hero / Steps / Features / UseCases / More Tools / FAQs）
- Markdown 内含占位图片 URL（placeholder-*）

**可重试：** 支持重新输入关键词重新生成，产出覆盖旧文件

**人工 gate：** 生成后展示 Markdown 内容，确认无误后进入下一步

---

### 4.4 Step 2 — 图片提示词生成

**输入：** `content-{slug}.md`

**输出：**
- `content-{slug}-final.md` — URL 已替换为最终 CDN 格式
- `content-{slug}-image-prompts.json` — N 条记录，含每张图的 alt / prompt / URL / type
  - `type: "tool_icon"` 条目：`prompt: null`，`source: "tool_icons.json"`

**可重试：** 支持重新生成全部提示词，或单独编辑某条提示词后单独生成本张图

**人工 gate：** 展示提示词列表，确认无误后进入生图

---

### 4.5 Step 3 — 图片生成

**输入：** `image_prompts.json`

**输出：** N 张 `.webp` 图片文件，命名 `{alt_slug}.webp`

**处理规则：**
- `type != "tool_icon"`：调用 AI 生图 API（走 provider 优先级）
- `type == "tool_icon"`：**跳过生图**，直接使用 `image_prompts.json` 中的 `url`（来自 CDN）

**图片粒度管理：**
- 每张图独立状态：`pending / generating / success / failed`
- `tool_icon` 类型状态直接为 `success`（来自 CDN，无失败可能）
- 失败的单张可单独重试
- 用户可选择「跳过某张」继续后续
- 全部成功或明确跳过所有失败项后才算 Step 3 完成

**Provider 支持：** OpenAI gpt-image-1（优先）/ MiniMax image-01 / Google gemini-3.1-flash-image-preview（fallback）

**生图失败处理：**
- 自动按优先级切换 provider 重试
- 3 个 provider 全部失败，记录错误信息，标记为 failed
- 用户可手动重试（选择不同 provider 或调整 prompt）

**人工 gate：** 全部图片（AI 生图类型）生成完成 / 确认跳过失败项后，进入下一步

---

### 4.6 Step 4 — HTML 模板填充

**输入：**
- `content-{slug}-final.md`
- `structure.html`（模板，提前配置好）
- `content_schema.json`（模板配套 schema，提前配置好）

**输出：**
- `fill-{slug}.html` — 可上线的完整 HTML 落地页
- `fill-{slug}.jsonld.json` — 结构化数据
- `fill-{slug}.seo-meta.json` — SEO Meta
- `fill-{slug}.faq.json` — FAQ JSON

**可重试：** 模板填充失败可重新运行，修改 content 后可重新填充

---

### 4.7 下载交付包

**内容：** 所有图片 + fill-{slug}.html + .jsonld.json + .seo-meta.json + .faq.json

**格式：** 打包为 .zip 供下载

---

## 5. 非功能要求

### 5.1 进度可见性
- 每 Step 有明确状态标识
- Step 3 显示「AI 生图 N 张 / CDN 图标 M 张」分类计数
- 失败项有明确错误提示

### 5.2 中间文件保留
- 每个 Step 的产出文件保留在项目目录，不自动删除
- 支持「从 Step N 重新开始」（复用 Step N 之前的结果）

### 5.3 错误处理
- 每步失败给出具体错误原因（API 错误 / 网络超时 / 内容解析失败）
- 不因单步失败阻塞整条链路

### 5.4 环境配置
- API Keys 配置在平台环境变量，不硬编码

---

## 6. 技术方案（参考）

**SKILL 代码包路径：** `projects/seo-toolkit/skills/`

| Skill | 职责 |
|---|---|
| seo-content-generator | 输入关键词，输出 content-{slug}.md |
| seo-image-prompt-generator | 生成提示词；tool_icon 查 tool_icons.json |
| seo-image-generator | 仅处理 non-tool_icon 条目生图 |
| seo-template-filler | 填模板输出 HTML |

**Provider 优先级：** openai (gpt-image-1) > minimax (image-01) > google (gemini-3.1-flash-image-preview)

**tool_icons.json 提取脚本：** `scripts/extract_tool_icons.py`（从 online-tools.html 抓取工具图标 URL）

---

## 7. 附录：image_prompts.json 结构

```json
{
  "meta": {
    "total_images": 21,
    "ai_generated": 15,
    "tool_icon_from_cdn": 6
  },
  "images": [
    {
      "index": 1,
      "type": "feature",
      "alt": "AI Image Quality Enhancement",
      "alt_slug": "ai-image-quality-enhancement",
      "url": "https://online.hitpaw.com/images/online-tools-land/ai-image-quality-enhancement.webp",
      "context": "Our powerful AI Photo Enhancer automatically improves...",
      "prompt": "A split-screen comparison showing the drastic improvement..."
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

**注意：** `type: "tool_icon"` 的条目 `prompt` 为 `null`，不进入生图队列。

---

## 8. 成功标准

- 运营同学输入关键词，可在 30 分钟内完成从内容到打包交付的全部流程
- 每一步骤可独立重试，不因单点失败需要重头开始
- 最终交付包可直接上传至 HitPaw 各站点落地页
