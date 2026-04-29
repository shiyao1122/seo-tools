#!/usr/bin/env python3
"""
fill_final.py — 模板填充脚本
用法: python3 fill_final.py <markdown> [template_id] [html_out] [jsonld_out] [meta_out]
依赖: parse_md.py、structured_data.py (同目录)
"""
import json, os, re, sys

DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR)
from parse_md import parse_md

# -- 路径配置（自动发现，无需手动修改）--
# 模板和输出都放在 skill 目录下，路径相对于脚本自身
# scripts/ → ../ → seo-template-filler/ → templates/ 和 outputs/
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_SKILL_DIR = os.path.dirname(_SCRIPT_DIR)  # seo-template-filler/
TEMPLATES_DIR = os.path.join(_SKILL_DIR, 'templates')
OUT_BASE = os.path.join(_SKILL_DIR, 'outputs')

DEFAULT_TEMPLATE_ID = 'online-enhance-template-id14451'


def v(val, default=''):
    if isinstance(val, str): return val
    if isinstance(val, dict): return str(val.get('value', default) or default)
    return str(val or default)


def rep(placeholder, value):
    global html
    if value:
        html = html.replace('{{%s}}' % placeholder, str(value))


# -- 命令行参数 --
# fill_final.py <markdown> [template_id] [html_out] [jsonld_out] [meta_out]
md_path = sys.argv[1]
template_id = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_TEMPLATE_ID
html_out_path = sys.argv[3] if len(sys.argv) > 3 else (OUT_BASE + '/fill-output.html')
jsonld_out_path = sys.argv[4] if len(sys.argv) > 4 else (OUT_BASE + '/fill-output.jsonld.json')
meta_out_path = sys.argv[5] if len(sys.argv) > 5 else (OUT_BASE + '/fill-output.seo-meta.json')

TEMPLATE_HTML = TEMPLATES_DIR + '/' + template_id + '/structure.html'
if not os.path.exists(TEMPLATE_HTML):
    available = [d for d in os.listdir(TEMPLATES_DIR) if os.path.isdir(TEMPLATES_DIR + '/' + d)]
    print('错误: 模板目录不存在 -> ' + TEMPLATE_HTML)
    print('可用模板: ' + str(available))
    sys.exit(1)

print('使用模板: ' + template_id)

# -- 加载 & 解析 --
with open(md_path, encoding='utf-8') as f:
    text = f.read()
data = parse_md(text)

with open(TEMPLATE_HTML, encoding='utf-8') as f:
    html = f.read()

# -- 填充 --
hero = data.get('hero', {})
steps = data.get('steps', {})
feat = data.get('features', {})
uc = data.get('use_cases', {})
mt = data.get('more_tools', {})
faq = data.get('faq', {})
tips = data.get('tips', {})
bcta = data.get('bottom_cta', {})

rep('hero_headline', v(hero.get('headline')))
rep('hero_subtitle', v(hero.get('subtitle')))
rep('hero_cta_primary_href', v(hero.get('cta_primary_href')))
rep('hero_cta_primary_text', v(hero.get('cta_primary_text')))
rep('hero_cta_primary_sub', v(hero.get('cta_primary_sub')))
rep('hero_cta_secondary_href', v(hero.get('cta_secondary_href')))
rep('hero_cta_secondary_text', v(hero.get('cta_secondary_text')))
rep('hero_cta_mobile_href', v(hero.get('cta_mobile_href')))
rep('hero_cta_mobile_text', v(hero.get('cta_mobile_text')))
rep('hero_image_url', v(hero.get('image_url')))
rep('hero_image_alt', v(hero.get('image_alt')))

rep('steps_title', v(steps.get('title')))
rep('steps_cta_href', v(steps.get('cta_href')))
rep('steps_cta_text', v(steps.get('cta_text')))
for i in range(1, 4):
    si = steps.get('step_%d' % i, {})
    rep('steps_step_%d_title' % i, v(si.get('title')))
    rep('steps_step_%d_desc' % i, v(si.get('desc')))
    rep('steps_step_%d_image_url' % i, v(si.get('image_url')))
    rep('steps_step_%d_image_alt' % i, v(si.get('image_alt')))

rep('features_title', v(feat.get('title')))
for i in range(1, 5):
    fi = feat.get('feature_%d' % i, {})
    rep('features_feature_%d_title' % i, v(fi.get('title')))
    rep('features_feature_%d_desc' % i, v(fi.get('desc')))
    rep('features_feature_%d_image_url' % i, v(fi.get('image_url')))
    rep('features_feature_%d_image_alt' % i, v(fi.get('image_alt')))
    rep('features_feature_%d_link' % i, v(fi.get('link')))
    cta_text = v(fi.get('cta_text')) or 'Make Video Clearer'
    rep('features_feature_%d_cta_text' % i, cta_text)

rep('use_cases_title', v(uc.get('title')))
rep('use_cases_desc', v(uc.get('desc')))
for i in range(1, 7):
    ui = uc.get('use_case_%d' % i, {})
    rep('use_cases_use_case_%d_title' % i, v(ui.get('title')))
    rep('use_cases_use_case_%d_desc' % i, v(ui.get('desc')))
    rep('use_cases_use_case_%d_image_url' % i, v(ui.get('image_url')))
    rep('use_cases_use_case_%d_image_alt' % i, v(ui.get('image_alt')))

rep('more_tools_title', v(mt.get('title')))
for i in range(1, 7):
    ti = mt.get('tool_%d' % i, {})
    rep('more_tools_tool_%d_title' % i, v(ti.get('title')))
    rep('more_tools_tool_%d_desc' % i, v(ti.get('desc')))
    rep('more_tools_tool_%d_image_url' % i, v(ti.get('image_url')))
    rep('more_tools_tool_%d_image_alt' % i, v(ti.get('image_alt')))
    rep('more_tools_tool_%d_link_href' % i, v(ti.get('link_href')))

rep('faq_title', v(faq.get('title')))
for i in range(1, 5):
    qi = faq.get('faq_%d' % i, {})
    rep('faq_faq_%d_question' % i, v(qi.get('question')))
    rep('faq_faq_%d_answer' % i, v(qi.get('answer')))

rep('tips_title', v(tips.get('title')))
for i in range(1, 9):
    ti = tips.get('tip_%d' % i, {})
    rep('tips_tip_%d_link_href' % i, v(ti.get('link_href')))
    rep('tips_tip_%d_link_text' % i, v(ti.get('link_text')))

rep('bottom_cta_title', v(bcta.get('title')))
rep('bottom_cta_desc', v(bcta.get('desc')))
rep('bottom_cta_image_url', v(bcta.get('image_url')))
rep('bottom_cta_image_alt', v(bcta.get('image_alt')))
rep('bottom_cta_cta_desktop_href', v(bcta.get('cta_desktop_href')))
rep('bottom_cta_cta_desktop_text', v(bcta.get('cta_desktop_text')))
rep('bottom_cta_cta_desktop_sub', v(bcta.get('cta_desktop_sub')))
rep('bottom_cta_cta_ios_href', v(bcta.get('cta_ios_href')))
rep('bottom_cta_cta_ios_text', v(bcta.get('cta_ios_text')))
rep('bottom_cta_cta_android_href', v(bcta.get('cta_android_href')))
rep('bottom_cta_cta_android_text', v(bcta.get('cta_android_text')))

# -- 输出 HTML --
os.makedirs(os.path.dirname(html_out_path), exist_ok=True)
with open(html_out_path, 'w', encoding='utf-8') as f:
    f.write(html)

# -- 生成 JSON-LD + SEO Meta --
from structured_data import build_structured_data
result = build_structured_data(md_path)

jld_data = result['json_ld']
os.makedirs(os.path.dirname(jsonld_out_path), exist_ok=True)
with open(jsonld_out_path, 'w', encoding='utf-8') as f:
    json.dump(jld_data, f, ensure_ascii=False, indent=2)

# -- FAQ 单独 JSON 文件（标准化输出第4个文件）--
faq_block = jld_data.get('FAQPage')
faq_json_path = jsonld_out_path.replace('.jsonld.json', '.faq.json')
os.makedirs(os.path.dirname(faq_json_path), exist_ok=True)
if faq_block:
    with open(faq_json_path, 'w', encoding='utf-8') as f:
        json.dump(faq_block, f, ensure_ascii=False, indent=2)
    print('FAQ JSON:    %d chars  -> %s' % (len(json.dumps(faq_block)), faq_json_path))
else:
    # 无 FAQ 时写空对象占位
    with open(faq_json_path, 'w', encoding='utf-8') as f:
        json.dump({}, f)
    print('FAQ JSON:    (无 FAQ 内容) -> %s' % faq_json_path)

seo_data = result['seo']
os.makedirs(os.path.dirname(meta_out_path), exist_ok=True)
with open(meta_out_path, 'w', encoding='utf-8') as f:
    json.dump(seo_data, f, ensure_ascii=False, indent=2)

print('HTML:    %d chars  -> %s' % (len(html), html_out_path))
print('JSON-LD: %d chars  -> %s' % (len(json.dumps(jld_data)), jsonld_out_path))
print('SEO Meta:%d chars  -> %s' % (len(json.dumps(seo_data)), meta_out_path))

# -- 自检报告 --
remaining = re.findall(r'\{\{([^}]+)\}\}', html)
print('=== 自检 ===')
print('剩余 {{}} 占位符: %d' % len(remaining))
if remaining:
    for ph in remaining[:10]:
        print('  {{%s}}' % ph)

checks = [
    ('hero_cta_primary_text', 'Enhance Video Quality Now'),
    ('hero_cta_secondary_text', 'Check Pricing'),
    ('hero_cta_mobile_text', 'Start Free Trial'),
    ('steps_step_1_title', 'Upload Your Video'),
    ('faq_faq_2_question', 'Q2: How can I fix a blurry video'),
    ('bottom_cta_cta_ios_text', 'Try on iPhone'),
    ('bottom_cta_cta_android_text', 'Try on Android'),
]
for label, expected in checks:
    found = expected in html
    print('%s [%s]: %s' % (label, expected, 'OK' if found else 'MISSING'))

print('生成完毕')
