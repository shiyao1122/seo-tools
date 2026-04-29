---
name: seo-content-generator
description: |
  SEO 落地页内容生成技能。输入关键词，输出 research-{slug}.md（调研简报）+ content-{slug}.md（填充内容）。
  触发条件：用户提供产品/功能名称，要求生成落地页内容；或说"帮我生成XX的落地页"、"调研XX的落地页"。
  工作目录：projects/seo-toolkit/skills/seo-content-generator/
---

# SEO 落地页内容生成技能

> 关键词 → 竞品调研 → 内容简报 → 落地页 Markdown

---

## 工作流程（三阶段）

### Phase 1：数据收集
```
用户提供关键词（例：AI Animal Video Generator）
         ↓
SerpAPI 搜索关键词，翻页补齐到 10 个候选 URL
         ↓
过滤非 SEO 页面（排除工具页、应用商店、社交媒体）
         ↓
三级降级抓取每个页面：
  Tier 1: urllib（支持 gzip）→ 成功则获取完整 HTML
  Tier 2: SerpAPI（site: 查询还原 snippet）→ urllib 失败时降级
  Tier 3: 标记失败，继续下一个
         ↓
每个页面输出：标题 / H1-H3 / 关键词频率 / 功能句 / 场景句 / FAQ 问题
```

### Phase 2：数据提炼
```
汇总 10 个页面关键词 → 核心词（≥80%频次）/ H1-H3高频词 / Meta高频词
汇总功能句 → Feature 清单
汇总场景句 → UseCase 清单
汇总 FAQ → 问答清单
```

### Phase 3：内容生成
```
读取 config.json → 确定 LLM Provider + API Key
         ↓
多厂商 LLM（MiniMax / OpenAI / Gemini）接收：核心词 + 产品描述 + 提炼数据
         ↓
生成内容简报（h1 / steps / features / use_cases / faqs）
         ↓
输出两个文件：
  outputs/research-{slug}.md    ← 调研过程 + 提炼结果（供复盘）
  outputs/content-{slug}.md    ← 最终落地页填充内容 Markdown
```

---

## 执行命令

```bash
cd projects/seo-toolkit/skills/seo-content-generator/scripts
python3 generate.py "AI Animal Video Generator" "HitPaw AI Animal Video Generator transforms photos and text into fun animal videos"
```

**参数说明：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `关键词` | ✅ | 核心产品/功能词，如 "AI Animal Video Generator" |
| `产品描述` | ✅ | 产品能力描述，LLM 用它理解背景（建议 1-2 句话） |

---

## 输出文件

| 文件 | 内容 |
|---|---|
| `outputs/research-{slug}.md` | URL 清单 + 关键词提炼（核心词/场景词/功能词）+ 内容策略简报 |
| `outputs/content-{slug}.md` | 最终落地页填充内容（H1 / Steps / Features / UseCases / FAQ / More Tools） |

---

## LLM 配置（首次使用）

### config.json
首次使用前需配置，文件位于 `skills/seo-content-generator/config.json`：

```json
{
  "provider": "minimax",      // minimax | openai | gemini
  "model": "MiniMax-M2.7",    // 具体模型名
  "api_key": "sk-xxx",        // API Key
  "max_tokens": 8192           // 最大 token 数
}
```

### 支持的 Provider

| Provider | 模型示例 | API 端点 |
|---|---|---|
| MiniMax | MiniMax-M2.7 | `https://api.minimaxi.com/anthropic/v1/messages` |
| OpenAI | gpt-4o, gpt-4 | `https://api.openai.com/v1/chat/completions` |
| Gemini | gemini-2.5-flash | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |

### 交互配置向导
如需重新配置或首次设置，可手动编辑 `config.json`，或运行脚本后按提示操作。

---

## 抓取规则

**排除域名：**
```
apps.apple.com, play.google.com, github.com, twitter.com, x.com,
instagram.com, tiktok.com, youtube.com, youtu.be, pinterest.com,
reddit.com, wikipedia.org
```

**排除 URL 模式：**
```
/upload, /convert, /compress, /login, /signup, /signin, /price, /pricing, tools.apple
```

**SEO 页面判定：**
- 不在排除域名中
- urllib 抓取后文字内容 ≥ 100 字符

---

## 依赖环境

| 依赖 | 说明 |
|---|---|
| SerpAPI (`SERPAPI_KEY`) | Google 搜索 + 降级抓取（已有，配置在脚本常量） |
| LLM Provider | MiniMax / OpenAI / Gemini（配置在 `config.json`） |
| `urllib` | 标准库，Tier 1 抓取 |

---

## 注意事项

1. **生成内容需人工审核**，特别是 CTA 链接、FAQ 答案
2. **图片 URL 为占位符**，需后续替换为真实素材
3. **产品描述要具体**，否则 LLM 生成的简报不够贴合产品

---

## 目录结构

```
seo-content-generator/
├── SKILL.md
├── config.json                 # LLM 配置（provider / model / api_key）
├── data/
│   └── tools-link.md           # 工具推荐数据源
├── scripts/
│   └── generate.py             # 主入口（多厂商 LLM + 三级降级抓取）
└── outputs/                    # 产出目录
    ├── research-{slug}.md
    └── content-{slug}.md
```