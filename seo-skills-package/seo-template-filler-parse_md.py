#!/usr/bin/env python3
"""
parse_md.py — 从 markdown 内容填充模板提取结构化数据
用法: python3 parse_md.py <markdown文件路径>
输出: JSON (print 到 stdout)
"""
import json, re, sys

def get_section(block_text):
    """解析 - **字段名**：值 这类行，支持有无 ** 包裹两种格式"""
    result = {}
    # 优先匹配有 ** 的（避免 `- 标题` 被 `- 场景 5` 误匹配）
    for m in re.finditer(r'^- \*\*([^*\n]+)\*\*：(.+)$', block_text, re.MULTILINE):
        key = m.group(1).strip()
        val = m.group(2).strip().strip('`').strip()
        result[key] = val
    # 备用：无 ** 的纯文本行
    for m in re.finditer(r'^- (?! \*\*)([^：\n]+)：(.+)$', block_text, re.MULTILINE):
        key = m.group(1).strip()
        val = m.group(2).strip().strip('`').strip()
        if key not in result:
            result[key] = val
    return result

def find_headers(text):
    result = []
    for m in re.finditer(r'^## [^\n]+', text, re.MULTILINE):
        line = m.group().lstrip('#').strip()
        result.append((m.start(), line))
    return result

def get_block(text, name):
    idx = next((i for i,(pos,h) in enumerate(find_headers(text))
               if name.lower() in h.lower()), None)
    if idx is None: return ''
    start = find_headers(text)[idx][0]
    end = find_headers(text)[idx+1][0] if idx+1 < len(find_headers(text)) else len(text)
    return text[start:end]

def parse_md(text):
    data = {}

    # ===================== HERO ================================================
    d = get_section(get_block(text, 'Hero'))
    data['hero'] = {
        'headline': d.get('H1 主标题', ''),
        'subtitle': d.get('副标题', ''),
        'cta_primary_href': d.get('主 CTA 链接', ''),
        'cta_primary_text': d.get('主 CTA 第一行文案', ''),
        'cta_primary_sub': d.get('主 CTA 第二行副文案', ''),
        'cta_secondary_href': d.get('次 CTA 链接', ''),
        'cta_secondary_text': d.get('次 CTA 文案', ''),
        'cta_mobile_href': d.get('移动端 CTA 链接', ''),
        'cta_mobile_text': d.get('移动端 CTA 文案', ''),
        'image_url': d.get('Hero 图片 URL', ''),
        'image_alt': d.get('Hero 图片 Alt', '')
    }

    # ===================== STEPS =============================================
    block = get_block(text, 'Steps')
    d = get_section(block)
    steps = {
        'title': d.get('Section H2 标题', ''),
        'cta_href': d.get('Steps 底部 CTA 链接', ''),
        'cta_text': d.get('Steps 底部 CTA 文案', '')
    }
    for i, m in enumerate(re.split(r'^### Step \d', block, flags=re.MULTILINE)[1:], 1):
        sd = get_section(m)
        steps['step_%d' % i] = {
            'num': sd.get('编号', ''),
            'title': sd.get('标题', ''),
            'desc': sd.get('描述', ''),
            'image_url': sd.get('截图 URL', ''),
            'image_alt': sd.get('图片 Alt', '')
        }
    data['steps'] = steps

    # ===================== FEATURES ============================================
    block = get_block(text, 'Features')
    d = get_section(block)
    feat = {'title': d.get('Section H2 标题', '')}
    for i, m in enumerate(re.split(r'^### Feature \d', block, flags=re.MULTILINE)[1:], 1):
        sd = get_section(m)
        feat['feature_%d' % i] = {
            'title': sd.get('标题', ''),
            'desc': sd.get('描述', ''),
            'image_url': sd.get('配图 URL', ''),
            'image_alt': sd.get('配图 Alt', ''),
            'link': sd.get('跳转链接', ''),
            'cta_text': sd.get('CTA 文案', '') or sd.get('跳转链接 CTA 文案', '')
        }
    data['features'] = feat

    # ===================== USE CASES =========================================
    block = get_block(text, 'Use Cases')
    d = get_section(block)
    uc = {
        'title': d.get('Section H2 标题', ''),
        'desc': d.get('引导段落', '')
    }
    for i, m in enumerate(re.split(r'^### 场景 \d', block, flags=re.MULTILINE)[1:], 1):
        sd = get_section(m)
        uc['use_case_%d' % i] = {
            'title': sd.get('标题', ''),
            'desc': sd.get('描述', ''),
            'image_url': sd.get('配图 URL', ''),
            'image_alt': sd.get('配图 Alt', '')
        }
    data['use_cases'] = uc

    # ===================== MORE TOOLS =========================================
    block = get_block(text, 'More Tools')
    d = get_section(block)
    mt = {'title': d.get('Section H2 标题', '')}
    for i, m in enumerate(re.split(r'^### 工具 \d', block, flags=re.MULTILINE)[1:], 1):
        sd = get_section(m)
        mt['tool_%d' % i] = {
            'title': sd.get('名称', ''),
            'desc': sd.get('简短描述', ''),
            'image_url': sd.get('卡片图片 URL', ''),
            'image_alt': sd.get('卡片图片 Alt', ''),
            'link_href': sd.get('跳转链接', '')
        }
    data['more_tools'] = mt

    # ===================== FAQ ==================================================
    block = get_block(text, 'FAQ')
    d = get_section(block)
    faq = {'title': d.get('Section H2 标题', '')}
    for i, m in enumerate(re.split(r'^### Q\d', block, flags=re.MULTILINE)[1:], 1):
        sd = get_section(m)
        # 支持新版 "问题（含 Qx: 前缀）" 和旧版 "问题"
        question = (sd.get('问题（含 Q%d: 前缀）' % i) or sd.get('问题', '')).strip()
        # 支持 "回答（可用 `<a href="链接">文字</a>` 加内链）" 和 "回答"
        answer = (sd.get('回答（可用 `<a href="链接">文字</a>` 加内链）') or sd.get('回答', '')).strip()
        faq['faq_%d' % i] = {'question': question, 'answer': answer}
    data['faq'] = faq

    # ===================== TIPS ================================================
    block = get_block(text, 'Tips')
    d = get_section(block)
    tips = {'title': d.get('Section H2 标题', '')}
    for i, m in enumerate(re.split(r'^### Tip \d', block, flags=re.MULTILINE)[1:], 1):
        sd = get_section(m)
        tips['tip_%d' % i] = {
            'link_href': sd.get('文章链接', ''),
            'link_text': sd.get('文章标题（带 · 前缀）', '')
        }
    data['tips'] = tips

    # ===================== BOTTOM CTA ==========================================
    block = get_block(text, 'Bottom CTA')
    d = get_section(block)
    bcta = {
        'title': d.get('H2 标题', ''),
        'desc': d.get('描述文字', ''),
        'image_url': d.get('背景图 URL', ''),
        'image_alt': d.get('背景图 Alt', '')
    }

    def extract_cta_sub(block_text, section_name):
        """Extract href/text/sub from a CTA subsection using find_headers."""
        lines = block_text.split('\n')
        result = {}
        for line in lines:
            m = re.match(r'^#{1,3} ' + re.escape(section_name) + r'\b', line)
            if m:
                break
            # Parse - **field**：value lines
            fm = re.match(r'^- \*\*([^\*\n]+)\*\*：(.+)$', line)
            if fm:
                key = fm.group(1).strip()
                val = fm.group(2).strip().strip('`').strip()
                result[key] = val
        # Now resolve to href/text/sub
        href = result.get('链接', '')
        # Check which text field exists
        text = result.get('第一行文案') or result.get('文案', '')
        sub = result.get('第二行副文案', '')
        return href, text, sub

    # Get Bottom CTA block via get_block helper
    bcta_block = get_block(text, 'Bottom CTA')
    bcta_d = get_section(bcta_block)
    bcta = {
        'title': bcta_d.get('H2 标题', ''),
        'desc': bcta_d.get('描述文字', ''),
        'image_url': bcta_d.get('背景图 URL', ''),
        'image_alt': bcta_d.get('背景图 Alt', '')
    }

    # Extract bottom CTA data - parse block directly without find_headers dependency
    bcta_block = get_block(text, 'Bottom CTA')
    bcta_d = get_section(bcta_block)
    bcta = {
        'title': bcta_d.get('H2 标题', ''),
        'desc': bcta_d.get('描述文字', ''),
        'image_url': bcta_d.get('背景图 URL', ''),
        'image_alt': bcta_d.get('背景图 Alt', '')
    }

    # Parse subsections directly from the block using ### header positions
    subsection_map = [
        ('desktop', '桌面端 CTA'),
        ('ios', 'iOS 移动端 CTA'),
        ('android', 'Android 移动端 CTA'),
    ]
    for sub_key, sub_label in subsection_map:
        # Find the ### subsection header
        pattern = re.compile(r'^#{1,3} ' + re.escape(sub_label) + r'\b', re.MULTILINE)
        m = pattern.search(bcta_block)
        if not m:
            continue
        sub_start = m.start()
        # Find next top-level section header (## + letter, not ### or ####)
        # Use \n anchor: stop before a line that starts with ### (subsections)
        next_pattern = re.compile(r'(?=^#{3} )', re.MULTILINE)
        next_m = next_pattern.search(bcta_block, sub_start + 1)
        sub_end = next_m.start() if next_m else len(bcta_block)
        sub_block = bcta_block[sub_start:sub_end]
        sd = get_section(sub_block)
        href = sd.get('链接', '')
        txt = sd.get('第一行文案') or sd.get('文案', '')
        sub = sd.get('第二行副文案', '')
        bcta['cta_%s_href' % sub_key] = href
        bcta['cta_%s_text' % sub_key] = txt
        bcta['cta_%s_sub' % sub_key] = sub

    data['bottom_cta'] = bcta
    return data

if __name__ == '__main__':
    path = sys.argv[1]
    with open(path, encoding='utf-8') as f:
        text = f.read()
    result = parse_md(text)
    print(json.dumps(result, ensure_ascii=False, indent=2))
