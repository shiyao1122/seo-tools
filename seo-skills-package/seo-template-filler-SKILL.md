---
name: seo-template-filler
description: |
  SEO 落地页内容填充技能。接收填写好的 Markdown 内容模板，输出渲染后 HTML + JSON-LD + SEO Meta + FAQ JSON 四个文件。
  触发条件：用户提供了内容素材或填写好的 content_fill_template.md，需要生成可上线的落地页 HTML。
  工作目录：skills/seo-template-filler/scripts/
  依赖脚本：scripts/parse_md.py、scripts/structured_data.py、scripts/fill_final.py
---

# SEO 落地页模板填充技能

> 将填写好的 Markdown 内容模板，转换为可上线的 HTML + JSON-LD + SEO Meta + FAQ JSON。

---

## 工作流程

```
用户提供 Markdown 内容（或发送 content_fill_template.md 填写结果）
         ↓
执行 fill_final.py
         ↓
四个标准化输出文件：
  outputs/fill-output.html          — 渲染后 HTML
  outputs/fill-output.jsonld.json  — 6 个 JSON-LD Block（FAQPage / HowTo / ItemList / VideoObject / BreadcrumbList / SoftwareApplication）
  outputs/fill-output.seo-meta.json — SEO 元数据（title / description / OG / Twitter Card / canonical）
  outputs/fill-output.faq.json      — FAQ JSON（FAQPage schema 裸数据，供独立嵌入使用）
```

---

## 执行命令

```bash
cd skills/seo-template-filler/scripts
python3 fill_final.py <markdown内容文件路径> [template_id] [html_out] [jsonld_out] [meta_out]
```

> **路径自动发现，支持两种结构：**
> - **A)** `seo-toolkit/` 下直接有 `skills/`、`templates/`、`outputs/`（当前结构）
> - **B)** `skills/` 在 workspace root 下，与 `projects/` 同级，模板在 `projects/seo-toolkit/templates/`
> 
> 脚本自动识别，无需配置。

**参数说明：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `markdown内容文件路径` | ✅ | 填写好的内容模板 markdown |
| `template_id` | ❌ | 模板目录名，默认为 `online-enhance-template-id14451` |
| `html_out` | ❌ | HTML 输出路径 |
| `jsonld_out` | ❌ | JSON-LD 输出路径 |
| `meta_out` | ❌ | SEO Meta 输出路径 |

**示例（使用默认模板）：**
```bash
cd skills/seo-template-filler/scripts
python3 fill_final.py ../../templates/online-enhance-template-id14451/content_fill_template.md
```

**示例（指定模板 ID）：**
```bash
cd skills/seo-template-filler/scripts
python3 fill_final.py content.md online-enhance-template-id14451
```

**当前可用模板：**
- `online-enhance-template-id14451` — HitPaw Online Video Enhancer 落地页

**新增模板后：** 在本 SKILL.md 的「当前可用模板」列表中追加一行（template_id + 简短说明）即可，无需额外工具。

---

## 输入格式

使用 `content_fill_template.md`，关键格式规则：

| 规则 | 说明 |
|---|---|
| Section 用 `## ` 开头 | 如 `## Hero 主横幅`、`## Steps 三步使用流程` |
| Subsection 用 `### ` 开头 | 如 `### Step 1`、`### Feature 1`、`### Q1` |
| 字段用 `**字段名**：` 包裹 | 如 `- **H1 主标题**：Free AI Video Enhancer` |
| URL 用反引号包裹 | 如 `` `- **链接**：`https://example.com` `` |
| Q/Tip 标题含 `Q1:` 前缀 | 如 `- **问题（含 Q1: 前缀）**：Q1: How to use?` |

**正确的 subsection 前缀规则：**

| 类型 | 正确前缀 | 错误前缀 |
|---|---|---|
| Step | `### Step 1` | `## Step 1` |
| Feature | `### Feature 1` | `## Feature 1` |
| 场景 | `### 场景 1` | `## 场景 1` |
| 工具 | `### 工具 1` | `## 工具 1` |
| FAQ | `### Q1` | `## Q1` |
| Tip | `### Tip 1` | `## Tip 1` |

---

## 输出说明

### fill-output.html（渲染后 HTML）
直接上线的落地页。所有 `{{section_field_subfield}}` 占位符已替换为实际内容。

**剩余占位符说明：**
- `{{section_field_subfield}}` — HTML 注释说明文字，无需处理
- `{{use_cases_use_case_6_image_url}}` — 源 markdown 中该字段格式错误，需重新填写

### fill-output.jsonld.json（JSON-LD Block）
6 个 Schema Block，每个单独用 `<script type="application/ld+json">` 注入 HTML `<head>`：

| Schema | Google Rich Result |
|---|---|
| FAQPage | ✅ FAQ 展开摘要 |
| HowTo | ✅ How-To Rich Result |
| ItemList | ❌ 搜索索引 |
| VideoObject | ✅ Video 索引 |
| BreadcrumbList | ✅ 面包屑显示 |
| SoftwareApplication | ❌ SGE 参考 |

### fill-output.seo-meta.json（SEO Meta）
直接取字段值填入 HTML `<head>` 对应标签。

### fill-output.faq.json（FAQ JSON）
纯 JSON 格式的 FAQPage schema，供独立嵌入到其他页面或 CMS 使用（不包含 `<script>` 标签）。

---

## 已知限制

1. **场景 6 配图 URL 字段格式错误**：`{{use_cases_use_case_6_image_url}}` 未填充时，检查源 markdown 中该字段格式是否正确（应为 `- **配图 URL**：` 而非 `- **配图 URL** software：`）
2. **Feature CTA 默认值**：若 markdown 中 Feature 没有 `CTA 文案` 字段，脚本回退到 "Make Video Clearer"
3. **FAQ `### Q1` 格式**：`question` 字段须包含 `Q1:` / `Q2:` 等前缀，与 HTML 结构对应

---

## 依赖文件

所有脚本位于 `skills/seo-template-filler/scripts/`：

```
skills/seo-template-filler/
└── scripts/
    ├── parse_md.py          # markdown → 结构化 dict
    ├── structured_data.py   # dict → SEO Meta + JSON-LD
    └── fill_final.py         # 主入口
```
