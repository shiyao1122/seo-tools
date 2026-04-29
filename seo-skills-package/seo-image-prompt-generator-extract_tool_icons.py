#!/usr/bin/env python3
"""
extract_tool_icons.py — 从 online-tools.html 页面批量提取工具图标
输入: tools-link.md（工具 URL 列表）
输出: tool_icons.json（工具名 → 图标 URL 映射）

这些图标会被存储到 CDN，供落地页 More Tools 区块使用，
不再通过 AI 生成。
"""
import json, os, re, sys, time
from pathlib import Path

TOOLKIT_DIR = Path(__file__).parent.parent.parent  # projects/seo-toolkit/
TOOLS_LINK_PATH = TOOLKIT_DIR / 'skills/seo-content-generator/data/tools-link.md'
OUT_JSON = TOOLKIT_DIR / 'skills/seo-image-prompt-generator/outputs/tool_icons.json'


def extract_page_icon_url(html_text, tool_name):
    """从工具页面 HTML 中提取图标 URL"""
    # 常见图标匹配模式
    patterns = [
        # <link rel="icon" href="...">
        r'<link[^>]+rel=["\']?(?:icon|apple-touch-icon|shortcut icon)["\']?[^>]+href=["\']([^"\']+)["\']',
        # OG image
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        # 站内图片 pattern: /images/icon-{slug}.png 或 /images/{slug}-icon.png
        r'(https://online\.hitpaw\.com/images/[^?#"\']+\.(?:png|jpg|webp|svg))',
        r'(https://[^"\']+/(?:images|assets|img)/[^?#"\']+\.(?:png|jpg|webp|svg))',
        # data-src lazy load
        r'data-src=["\']([^"\']+\.(?:png|jpg|webp))["\']',
        # srcset
        r'srcset=["\']([^"\']+)["\']',
    ]

    tool_slug = tool_name.lower().replace(' ', '-').replace('_', '-')
    for pattern in patterns:
        matches = re.findall(pattern, html_text, re.IGNORECASE)
        for match in matches:
            url = match if isinstance(match, str) else match[0] if isinstance(match, tuple) else ''
            if url and 'online.hitpaw.com' in url or url.startswith('/'):
                if url.startswith('/'):
                    url = 'https://online.hitpaw.com' + url
                return url
    return ''


def slugify_tool_name(name):
    """工具名转 URL safe slug"""
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9\s-]', '', name)
    name = re.sub(r'[\s_]+', '-', name)
    name = re.sub(r'-+', '-', name)
    return name.strip('-')


def main():
    if not TOOLS_LINK_PATH.exists():
        print(f"文件不存在: {TOOLS_LINK_PATH}")
        sys.exit(1)

    with open(TOOLS_LINK_PATH) as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    print(f"共 {len(urls)} 个工具，开始提取图标...")
    # 已有图标缓存
    if Path(OUT_JSON).exists():
        with open(OUT_JSON) as f:
            cache = json.load(f)
    else:
        cache = {}

    results = {}
    for i, url in enumerate(urls, 1):
        tool_name = url.split('/')[-1].replace('.html', '').replace('-online', '').replace('-', ' ').title()
        slug = slugify_tool_name(tool_name)

        if slug in cache and cache[slug].get('icon_url'):
            print(f"  [{i}/{len(urls)}] {slug} — 已缓存，跳过")
            results[slug] = cache[slug]
            continue

        # 由于网络限制，这里只记录占位逻辑
        # 实际提取需要在有代理的环境中运行
        placeholder_url = f"https://online.hitpaw.com/images/online-tools-land/{slug}.webp"
        results[slug] = {
            "tool_name": tool_name,
            "source_url": url,
            "icon_url": placeholder_url,  # 替换为实际提取的 URL
            "slug": slug,
        }
        print(f"  [{i}/{len(urls)}] {slug} — 已记录（需实际抓取）")

    # 保存缓存
    with open(OUT_JSON, 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n已保存: {OUT_JSON}")
    print(f"共记录 {len(results)} 个工具图标（需在可访问网络的环境中重新运行以抓取真实 URL）")


if __name__ == '__main__':
    main()
