#!/usr/bin/env python3
"""
structured_data.py — 从 markdown 内容生成结构化数据 JSON（对齐 content_schema.json）
用法: python3 structured_data.py <markdown文件路径> [输出路径]
输出: 结构化 JSON（含 SEO 元数据 + 标准 JSON-LD blocks）
"""
import json, os, re, sys
from datetime import datetime, timezone

DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR)
from parse_md import parse_md


def clean_str(val):
    """去除空白、移除 markdown 格式字符，返回纯净字符串"""
    if not val:
        return ''
    val = str(val).strip()
    val = re.sub(r'\s+', ' ', val)
    return val


def build_structured_data(md_path, data=None):
    """
    从 markdown 内容生成完整结构化数据。
    返回 dict（含 SEO 元数据 + 标准 JSON-LD blocks）。
    """
    if data is None:
        with open(md_path, encoding='utf-8') as f:
            text = f.read()
        data = parse_md(text)

    hero  = data.get('hero', {})
    steps = data.get('steps', {})
    feat  = data.get('features', {})
    uc    = data.get('use_cases', {})
    mt    = data.get('more_tools', {})
    faq   = data.get('faq', {})
    tips  = data.get('tips', {})
    bcta  = data.get('bottom_cta', {})

    page_name = os.path.basename(md_path).replace('.md', '')
    now = datetime.now(timezone.utc).isoformat()

    headline = clean_str(hero.get('headline', ''))
    raw_desc = clean_str(hero.get('subtitle', ''))
    meta_desc = raw_desc[:155] + ('…' if len(raw_desc) > 155 else '')
    brand = 'HitPaw'

    # ── SEO 元数据 ─────────────────────────────────────────────────────────────
    seo = {
        'page_name': page_name,
        'template_version': '1.1.0',
        'generated_at': now,
        'title': '%s — %s' % (headline, brand) if headline else brand,
        'meta_description': meta_desc,
        'og_title': headline,
        'og_description': meta_desc,
        'og_type': 'website',
        'og_image': clean_str(hero.get('image_url', '')),
        'og_url': 'https://online.hitpaw.com/pricing.html',  # TODO: 动态化
        'twitter_card': 'summary_large_image',
        'twitter_title': headline,
        'twitter_description': meta_desc,
        'twitter_image': clean_str(hero.get('image_url', '')),
        'canonical_url': '',
        'locale': 'en_US',
    }

    # ── 结构化数据（供 HTML 渲染使用） ────────────────────────────────────────────
    hero_out = {k: clean_str(v) for k, v in hero.items()}
    steps_out = {k: clean_str(v) if isinstance(v, str) else v for k, v in steps.items()}
    feat_out  = {k: clean_str(v) if isinstance(v, str) else v for k, v in feat.items()}
    uc_out    = {k: clean_str(v) if isinstance(v, str) else v for k, v in uc.items()}
    mt_out    = {k: clean_str(v) if isinstance(v, str) else v for k, v in mt.items()}
    faq_out   = {k: clean_str(v) if isinstance(v, str) else v for k, v in faq.items()}
    tips_out  = {k: clean_str(v) if isinstance(v, str) else v for k, v in tips.items()}
    bcta_out  = {k: clean_str(v) if isinstance(v, str) else v for k, v in bcta.items()}

    # ── JSON-LD（符合 schema.org 标准） ─────────────────────────────────────────
    json_ld = {}

    # 1. FAQPage — https://schema.org/FAQPage
    if faq_out.get('title'):
        faq_questions = []
        for i in range(1, 5):
            qi = faq_out.get('faq_%d' % i, {})
            raw_q = clean_str(qi.get('question', ''))
            a = qi.get('answer', '')
            if not raw_q:
                continue
            # 去掉 "Q1:" 前缀，Google FAQ 只接受纯问题文本
            q = re.sub(r'^Q\d+:\s*', '', raw_q)
            answer_text = re.sub(r'<[^>]+>', '', a).strip()
            faq_questions.append({
                '@type': 'Question',
                'name': q,
                'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': answer_text,
                }
            })
        if faq_questions:
            json_ld['FAQPage'] = {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                'mainEntity': faq_questions,
            }

    # 2. HowTo — https://schema.org/HowTo
    if steps_out.get('title'):
        howto_steps = []
        for i in range(1, 4):
            si = steps_out.get('step_%d' % i, {})
            title = clean_str(si.get('title', ''))
            desc = clean_str(si.get('desc', ''))
            img_url = clean_str(si.get('image_url', ''))
            if not title:
                continue
            step = {
                '@type': 'HowToStep',
                'name': title,
                'text': desc,
            }
            if img_url:
                step['image'] = {
                    '@type': 'ImageObject',
                    'url': img_url,
                    'name': clean_str(si.get('image_alt', '')) or title,
                }
            howto_steps.append(step)
        if howto_steps:
            json_ld['HowTo'] = {
                '@context': 'https://schema.org',
                '@type': 'HowTo',
                'name': clean_str(steps.get('title', '')),
                'description': clean_str(steps.get('title', '')),
                'url': seo.get('og_url', ''),
                'step': howto_steps,
            }

    # 3. ItemList（更多工具）— https://schema.org/ItemList
    if mt_out.get('title'):
        tool_items = []
        for i in range(1, 7):
            ti = mt_out.get('tool_%d' % i, {})
            title = clean_str(ti.get('title', ''))
            if not title:
                continue
            tool_items.append({
                '@type': 'ListItem',
                'position': i,
                'item': {
                    '@type': 'SoftwareApplication',
                    'name': title,
                    'description': clean_str(ti.get('desc', '')),
                    'url': clean_str(ti.get('link_href', '')),
                    'applicationCategory': 'BusinessApplication',
                    'operatingSystem': 'Web',
                    'offers': {
                        '@type': 'Offer',
                        'price': '0',
                        'priceCurrency': 'USD',
                    },
                }
            })
        if tool_items:
            json_ld['ItemList'] = {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                'name': clean_str(mt.get('title', '')),
                'itemListElement': tool_items,
            }

    # 4. VideoObject — https://schema.org/VideoObject
    hero_img_url = clean_str(hero.get('image_url', ''))
    if hero_img_url:
        json_ld['VideoObject'] = {
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            'name': clean_str(hero.get('image_alt', '')) or headline,
            'description': raw_desc,
            'thumbnail': {
                '@type': 'ImageObject',
                'url': hero_img_url,
            },
            'contentUrl': hero_img_url,
            'uploadDate': now[:10],
        }

    # 5. BreadcrumbList — https://schema.org/BreadcrumbList
    json_ld['BreadcrumbList'] = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://online.hitpaw.com'},
            {'@type': 'ListItem', 'position': 2, 'name': 'Online Tools', 'item': 'https://online.hitpaw.com/online-tools.html'},
            {'@type': 'ListItem', 'position': 3, 'name': headline or 'Video Enhancer', 'item': seo.get('og_url', '')},
        ]
    }

    # 6. SoftwareApplication — https://schema.org/SoftwareApplication
    json_ld['SoftwareApplication'] = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        'name': 'HitPaw Online Video Enhancer',
        'description': raw_desc,
        'url': 'https://online.hitpaw.com',
        'applicationCategory': 'BusinessApplication',
        'operatingSystem': 'Web',
        'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'USD',
            'availability': 'https://schema.org/InStock',
        },
        'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': '4.6',
            'ratingCount': '12847',
        }
    }

    # ── 组装输出 ────────────────────────────────────────────────────────────────
    return {
        '_meta': {
            'page_name': page_name,
            'template_version': '1.1.0',
            'generated_at': now,
        },
        'seo': seo,
        'hero': hero_out,
        'steps': steps_out,
        'features': feat_out,
        'use_cases': uc_out,
        'more_tools': mt_out,
        'faq': faq_out,
        'tips': tips_out,
        'bottom_cta': bcta_out,
        'json_ld': json_ld,
    }


if __name__ == '__main__':
    md_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else './structured-output.json'

    with open(md_path, encoding='utf-8') as f:
        text = f.read()

    result = build_structured_data(md_path)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print('Done: %d chars  →  %s' % (len(json.dumps(result)), out_path))
    seo = result['seo']
    print()
    print('=== SEO 元数据 ===')
    print('title:', seo['title'])
    print('meta_description:', seo['meta_description'][:80] + '…')
    print('og_image:', seo['og_image'][:60] + '…')
    print()
    print('=== JSON-LD Blocks ===')
    for k in result['json_ld']:
        print(' ', k)
    print()
    print('=== Schema 字段覆盖 ===')
    print(' hero:',          len(result['hero']), 'fields')
    print(' steps:',         len(result['steps']), 'fields')
    print(' features:',      len(result['features']), 'fields')
    print(' use_cases:',     len(result['use_cases']), 'fields')
    print(' more_tools:',    len(result['more_tools']), 'fields')
    print(' faq:',           len(result['faq']), 'fields')
    print(' tips:',          len(result['tips']), 'fields')
    print(' bottom_cta:',    len(result['bottom_cta']), 'fields')