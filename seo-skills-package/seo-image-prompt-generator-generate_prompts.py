#!/usr/bin/env python3
"""
generate_prompts.py — SEO 图片提示词生成器 v2
输入: seo-content-generator 输出的 content-{slug}.md
输出:
  1. content-{slug}-final.md    → URL 替换为最终格式
  2. image_prompts.json          → 提示词列表（alt → prompt）

v2 改进：Markdown 解析逻辑重构，支持多种槽位格式
"""
import json, os, re, sys, time
from pathlib import Path

# ===================== 配置 =====================
SKILL_DIR = Path(__file__).parent.parent.resolve()
TOOLKIT_DIR = SKILL_DIR.parent.parent  # projects/seo-toolkit/
OUT_DIR = SKILL_DIR / 'outputs'
OUT_DIR.mkdir(exist_ok=True)
TOOL_ICONS_PATH = OUT_DIR / 'tool_icons.json'
OUT_DIR.mkdir(exist_ok=True)

IMG_BASE_URL = 'https://online.hitpaw.com/images/online-tools-land/'


def load_tool_icons():
    """加载预提取的工具图标映射，返回 slug -> icon_url 字典"""
    if not TOOL_ICONS_PATH.exists():
        return {}
    with open(TOOL_ICONS_PATH, encoding='utf-8') as f:
        data = json.load(f)
    return {slug: info['icon_url'] for slug, info in data.items()}


# ===================== 工具函数 =====================

def slugify(text):
    """将 alt text 转为 URL-safe slug"""
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


def is_placeholder_url(url):
    if not url:
        return False
    return any(p in url for p in [
        'placeholder-', 'icon-', 'bottom-banner',
    ])


def load_config():
    cfg_path = SKILL_DIR / 'config.json'
    if not cfg_path.exists():
        return None
    with open(cfg_path, encoding='utf-8') as f:
        return json.load(f)


def setup_config_wizard():
    print('')
    print('=' * 50)
    print('Image Prompt Generator Config')
    print('=' * 50)
    providers = {
        '1': {'id': 'gemini',  'name': 'Gemini',   'default_model': 'gemini-2.5-flash'},
        '2': {'id': 'openai',  'name': 'OpenAI',   'default_model': 'gpt-4o'},
        '3': {'id': 'minimax', 'name': 'MiniMax',  'default_model': 'MiniMax-M2.7'},
    }
    print('')
    print('Select LLM Provider:')
    for k, v in providers.items():
        print('  ' + k + '. ' + v['name'])
    choice = input('Choice [1]: ').strip() or '1'
    while choice not in providers:
        choice = input('Invalid, try again: ').strip()
    p = providers[choice]
    print('Selected: ' + p['name'])
    api_key = input(p['name'] + ' API Key: ').strip()
    if not api_key:
        print('API Key required.')
        sys.exit(1)
    default_model = p['default_model']
    model = input('Model (Enter for [' + default_model + ']): ').strip() or default_model
    mt = input('Max Tokens [8192]: ').strip()
    max_tokens = int(mt) if mt else 8192
    cfg = {'provider': p['id'], 'model': model, 'api_key': api_key, 'max_tokens': max_tokens}
    with open(SKILL_DIR / 'config.json', 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print('Saved config.json')
    return cfg


def call_llm(prompt, max_tokens=None, config=None):
    if config is None:
        config = load_config()
    if config is None:
        print('config.json not found.')
        sys.exit(1)
    provider = config.get('provider', 'gemini')
    model = config.get('model', '')
    api_key = config.get('api_key', '')
    cfg_max = config.get('max_tokens', 8192)
    if max_tokens is None:
        max_tokens = cfg_max

    if provider == 'gemini':
        return _call_gemini(prompt, api_key, model, max_tokens)
    elif provider == 'openai':
        return _call_openai(prompt, api_key, model, max_tokens)
    elif provider == 'minimax':
        return _call_minimax(prompt, api_key, model, max_tokens)
    else:
        print('Unknown provider: ' + provider)
        return None


def _call_gemini(prompt, api_key, model, max_tokens):
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + api_key
    headers = {'Content-Type': 'application/json'}
    payload = {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'maxOutputTokens': max_tokens}}
    try:
        import urllib.request
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            return data['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        print('  [Gemini] Error: ' + str(e))
        return None


def _call_openai(prompt, api_key, model, max_tokens):
    url = 'https://api.openai.com/v1/chat/completions'
    headers = {'Authorization': 'Bearer ' + api_key, 'Content-Type': 'application/json'}
    payload = {'model': model, 'max_tokens': max_tokens, 'messages': [{'role': 'user', 'content': prompt}]}
    try:
        import urllib.request
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            return data['choices'][0]['message']['content']
    except Exception as e:
        print('  [OpenAI] Error: ' + str(e))
        return None


def _call_minimax(prompt, api_key, model, max_tokens):
    url = 'https://api.minimaxi.com/anthropic/v1/messages'
    headers = {
        'Authorization': 'Bearer ' + api_key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
    }
    payload = {'model': model, 'max_tokens': max_tokens, 'messages': [{'role': 'user', 'content': prompt}]}
    try:
        import urllib.request
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            for item in data.get('content', []):
                if item.get('type') == 'text':
                    return item['text']
            return None
    except Exception as e:
        print('  [MiniMax] Error: ' + str(e))
        return None


# ===================== Markdown 解析 =====================

def extract_field_value(line):
    """从 markdown 行提取字段值（去掉 - **字段名**：前缀和尾部的 `）"""
    # 格式1: - **字段**：`value` （反引号包裹）
    m = re.search(r'``([^`]+)``', line)   # 双反引号 ``value``
    if m:
        return m.group(1).strip()
    # 格式2: - **字段**：`value` （单反引号包裹）
    m = re.search(r'`([^`]+)`', line)     # 单反引号 `value`
    if m:
        return m.group(1).strip()
    # 格式3: - **字段**：value （无反引号，匹配到行尾）
    m = re.search(r'[^：]*：(.+)$', line)
    if m:
        return m.group(1).strip().rstrip('`').strip()
    return ''


def parse_markdown_entries(markdown_text):
    """
    解析 markdown，提取所有图片条目。
    支持：相邻行（URL 在前，Alt 在后）以及更远的间隔（往前最多10行找 URL）。
    同时追踪当前小标题（### Step N / ### Feature N / ### 场景 N）
    用于判断图片类型。
    """
    lines = markdown_text.split('\n')
    entries = []
    n = len(lines)

    url_lines = {}   # line_idx -> url_value
    alt_lines = []   # [(line_idx, alt_value, section_context)]

    current_section = ''  # 当前小标题上下文

    for i, line in enumerate(lines):
        stripped = line.strip()

        # 追踪当前 section 小标题
        if stripped.startswith('### '):
            current_section = stripped[4:].strip()

        if '**' not in stripped:
            continue

        # URL 行
        if any(k in stripped for k in ['配图 URL', '截图 URL', '卡片图片 URL', 'Hero 图片 URL', '背景图 URL']):
            val = extract_field_value(stripped)
            if val.startswith('http'):
                url_lines[i] = val

        # Alt 行
        elif any(k in stripped for k in ['配图 Alt', '图片 Alt', '卡片图片 Alt', 'Hero 图片 Alt', '背景图 Alt']):
            val = extract_field_value(stripped)
            if val:
                alt_lines.append((i, val, current_section))

    # 将每个 Alt 与最近的 preceding URL 关联
    img_type_keywords = {
        'Feature': 'feature',
        'Step': 'step',
        '场景': 'usecase',
        '工具': 'tool_icon',
        'Hero 图片': 'hero',
        '背景图': 'bottom_cta',
    }

    for alt_idx, alt_val, section_ctx in alt_lines:
        matched_url = ''
        for lookback in range(1, 11):  # 最多往前10行
            prev_idx = alt_idx - lookback
            if prev_idx < 0:
                break
            if prev_idx in url_lines:
                matched_url = url_lines[prev_idx]
                break

        # 从 section 上下文和 alt 行联合判断类型
        img_type = 'generic'
        for kw, t in img_type_keywords.items():
            if kw in section_ctx or kw in alt_val:
                img_type = t
                break

        entries.append({
            'type': img_type,
            'alt': alt_val,
            'current_url': matched_url,
            'alt_line': alt_idx,
            'section': section_ctx,
        })

    return entries


def get_context_for_alt(markdown_text, alt_line, img_type):
    """
    获取 alt 所在图片条目最近的描述上下文。
    往上找最近包含"描述"的行（最多往前10行）
    """
    lines = markdown_text.split('\n')
    for i in range(alt_line - 1, max(0, alt_line - 10), -1):
        line = lines[i].strip()
        if '描述' in line:
            return extract_field_value(line)
    return ''


def replace_placeholder_urls(markdown_text):
    """
    扫描 markdown 中所有占位图 URL，替换为最终 URL。
    通过正则匹配所有 hitpaw.com/images 下的 placeholder URL。
    返回替换后的 markdown 和替换列表。
    """
    result = markdown_text
    replacements = []

    # 匹配所有 placeholder URL（placeholder-* 和 icon-* 和 bottom-banner）
    # 模式：https://www.hitpaw.com/images/placeholder-XXX.png 等
    pattern = r'(https://www\.hitpaw\.com/images/)(placeholder[-\w]+\.png|icon-\d+\.png|bottom-banner\.png)'

    def replacer(m):
        prefix = m.group(1)  # https://www.hitpaw.com/images/
        filename = m.group(2)  # placeholder-feature-1.png
        # 从文件名推断 alt（不完美但可接受）
        # placeholder-feature-1.png -> feature
        # icon-1.png -> 从前后文取 alt
        return f'_PLACEHOLDER_URL_PLACEHOLDER_{filename}_END_'  # 临时占位

    # 更简单的方法：直接用正则全文替换，同时记录
    # 找到所有 placeholder URL，用 alt slugify 后的名字替换
    found_urls = re.findall(pattern, markdown_text)
    replacements = []
    for prefix, filename in found_urls:
        old_url = prefix + filename
        # 从 markdown 中找这个 URL 对应的 Alt
        # 通过文件名推断：placeholder-feature-1.png -> "Feature 1" 附近
        # icon-1.png -> "工具 1" 附近
        replacements.append((old_url, filename))

    # 实际替换逻辑：在 markdown 中直接替换
    # 更好的方式：直接返回 markdown（不替换），让后续逻辑处理
    # 这里我们只返回原文，让 image_prompts.json 里的 final_url 来处理
    return markdown_text, replacements


def build_prompt_for_entry(entry, page_keyword, context):
    """为单张图片构建提示词生成 prompt"""
    alt = entry['alt']
    img_type = entry['type']

    type_hints = {
        'hero':      'a wide-angle hero banner with a person interacting with the product, cinematic feel',
        'feature':   'a split-screen or before/after comparison showing the feature effect',
        'step':      'a clean UI screenshot showing the step in the workflow',
        'usecase':   'a lifestyle scene showing real people enjoying the use case',
        'tool_icon': 'a clean flat tool icon, simple and recognizable',
        'bottom_cta':'an inspiring, motivational background for a CTA section',
        'generic':   'a professional product screenshot or lifestyle image',
    }
    type_hint = type_hints.get(img_type, type_hints['generic'])

    prompt = f"""You are generating an AI image prompt for an SEO landing page.

Product: {page_keyword}
Image type: {img_type}
Style guidance: {type_hint}

Image title (alt): "{alt}"
Description context: "{context}"

Generate a vivid, specific image prompt that:
1. Captures the visual essence of the title and description
2. If "transform" or "before/after" is implied, show a split-screen comparison
3. If it's a feature, show the effect visually (not a diagram)
4. If it's a use case, show a realistic lifestyle scene with people
5. End with: cinematic, photorealistic, 4K (or: bright, clean product shot)
6. Do NOT include text, logos, or UI elements unless it's a step screenshot
7. Be specific about subjects, setting, mood, and lighting

Output ONLY the prompt text, nothing else."""
    return prompt


def generate_prompts_batch(entries, page_keyword, config):
    """批量调用 LLM 生成提示词"""
    prompts = []
    for i, entry in enumerate(entries):
        context = entry.get('context', '')
        print(f'  [{i+1:02d}/{len(entries)}] {entry["type"]:<12} | {entry["alt"][:35]}')
        prompt = build_prompt_for_entry(entry, page_keyword, context)
        result = call_llm(prompt, max_tokens=256, config=config)
        if result:
            result = result.strip().strip('"').strip("'").strip('```')
            print(f'       → {result[:70]}')
        else:
            result = f'{entry["alt"]}, professional image, cinematic, photorealistic, 4K'
            print(f'       → [fallback] {result}')
        prompts.append(result)
        time.sleep(0.25)
    return prompts


# ===================== 主流程 =====================

def main():
    config = load_config()
    if config is None:
        print('config.json not found. Running setup wizard...')
        config = setup_config_wizard()
    provider_name = config.get('provider', 'gemini').capitalize()
    print(f'Using provider: {provider_name}, model: {config.get("model", "")}')

    if len(sys.argv) < 2:
        print('用法: python3 generate_prompts.py "/path/to/content-{slug}.md"')
        sys.exit(1)

    md_path = Path(sys.argv[1]).resolve()
    if not md_path.exists():
        print(f'文件不存在: {md_path}')
        sys.exit(1)

    print('=' * 50)
    print(f'SEO Image Prompt Generator v2')
    print(f'输入: {md_path.name}')
    print('=' * 50)

    with open(md_path, encoding='utf-8') as f:
        md_text = f.read()

    # 提取 page keyword
    kw_match = re.search(r'核心词:\s*(.+?)\n', md_text)
    page_keyword = kw_match.group(1).strip() if kw_match else 'AI Tool'

    # 解析图片条目
    entries = parse_markdown_entries(md_text)
    print(f'\n📷 共发现 {len(entries)} 个图片槽位')

    # 为每个 entry 补充 context
    for entry in entries:
        ctx = get_context_for_alt(md_text, entry['alt_line'], entry['type'])
        entry['context'] = ctx

    # 预计算每个 entry 的 final_url（直接用 alt_slug 生成）
    for entry in entries:
        entry['final_url'] = IMG_BASE_URL + slugify(entry['alt']) + '.webp'

    # 扫描 markdown，按顺序将占位 URL 替换为对应 entry 的 final_url
    url_replacement_count = 0
    md_lines = md_text.split('\n')
    result_lines = []
    processed_alt_lines = set()

    PLACEHOLDER_RE = re.compile(
        r'https://www\.hitpaw\.com/images/(placeholder(?:[-\w]+|)\.png|icon-\d+\.png|bottom-banner\.png)'
    )

    for line_idx, line in enumerate(md_lines):
        m = PLACEHOLDER_RE.search(line)
        if m:
            old_url = m.group(0)
            # 找当前行之后最近的未处理 entry
            best_entry = None
            best_dist = 999
            for e in entries:
                el = e['alt_line']
                if el in processed_alt_lines:
                    continue
                dist = el - line_idx
                if 0 < dist < best_dist:  # alt_line 必须在 URL 行之后
                    best_dist = dist
                    best_entry = e
            # 兜底：最近未处理的 entry
            if not best_entry:
                for e in entries:
                    el = e['alt_line']
                    if el not in processed_alt_lines:
                        best_entry = e
                        break
            if best_entry:
                new_url = best_entry['final_url']
                line = line.replace(old_url, new_url, 1)
                print(f'  🔄 {best_entry["type"]:<12} | {best_entry["section"][:30]!r:<32} | {old_url}')
                print(f'         → {new_url}')
                processed_alt_lines.add(best_entry['alt_line'])
                url_replacement_count += 1
        result_lines.append(line)
    md_final = '\n'.join(result_lines)

    # 生成提示词（仅 non-tool_icon 条目）
    print(f'\n🤖 调用 {provider_name} 批量生成提示词...（tool_icon 类型从 CDN 获取，不生成）')
    tool_icons = load_tool_icons()
    non_tool_entries = [e for e in entries if e['type'] != 'tool_icon']
    generated_prompts = generate_prompts_batch(non_tool_entries, page_keyword, config)

    # 重建 prompt 列表（与 non_tool_entries 对齐）
    prompt_map = {e['alt']: p for e, p in zip(non_tool_entries, generated_prompts)}


    # 组装 image_prompts.json
    images_data = []
    ai_count, cdn_count = 0, 0
    for i, entry in enumerate(entries, 1):
        img_type = entry['type']
        alt = entry['alt']
        alt_slug = slugify(alt)
        if img_type == 'tool_icon':
            icon_url = tool_icons.get(alt_slug, entry['final_url'])
            images_data.append({
                'index': i,
                'type': img_type,
                'alt': alt,
                'alt_slug': alt_slug,
                'url': icon_url,
                'context': entry['context'],
                'prompt': None,
                'source': 'tool_icons.json',
            })
            cdn_count += 1
        else:
            images_data.append({
                'index': i,
                'type': img_type,
                'alt': alt,
                'alt_slug': alt_slug,
                'url': entry['final_url'],
                'context': entry['context'],
                'prompt': prompt_map.get(alt, ''),
            })
            ai_count += 1

    # 输出文件
    slug = md_path.stem  # content-{slug}
    ts = time.strftime('%Y-%m-%d %H:%M')

    out_md = OUT_DIR / f'{slug}-final.md'
    out_json = OUT_DIR / f'{slug}-image-prompts.json'

    with open(out_md, 'w', encoding='utf-8') as f:
        f.write(md_final)

    meta = {
        'meta': {
            'source': md_path.name,
            'generated_at': ts,
            'total_images': len(images_data),
            'ai_generated': ai_count,
            'tool_icon_from_cdn': cdn_count,
            'provider': provider_name,
            'model': config.get('model', ''),
            'url_replacements': url_replacement_count,
        },
        'images': images_data,
    }
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f'\n✅ 生成完毕！')
    print(f'  📄 最终 Markdown: {out_md}')
    print(f'  📋 提示词 JSON:   {out_json}')
    print(f'  共 {len(images_data)} 张（AI 生成: {ai_count} | CDN 工具图标: {cdn_count}），替换 {url_replacement_count} 个 URL')

    print('\n🔍 提示词 review 清单:')
    print('-' * 60)
    for img in images_data:
        print(f'  [{img["index"]:02d}] ({img["type"]}) {img["alt"][:35]}')
        print(f'       URL:   {img["url"][:70]}')
        print(f'       Prompt: {img["prompt"][:80]}')
        print()
    print('💡 如需修改提示词，请直接编辑 image_prompts.json 中的 prompt 字段。')
    return out_md, out_json


if __name__ == '__main__':
    main()
