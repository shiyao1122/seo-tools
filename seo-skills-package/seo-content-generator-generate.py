#!/usr/bin/env python3
"""
generate.py — SEO 落地页内容生成器 v3
输入: 核心关键词 + 产品功能描述
输出（2个文件）:
  1. research-{slug}.md    → 调研URL清单 + 深度分析 + 关键词提炼 + 场景提炼
  2. content-{slug}.md       → 最终填充内容 Markdown

流程：
  Step 1: SerpAPI 搜索，翻页补齐10个URL
  Step 2: 每个页面深度分析（meta/h1-h3/关键词/分屏内容）
  Step 3: 关键词提炼（频次≥80%核心词 + H1-H3高频词）
  Step 4: 场景提炼（FAQ/Use Cases挖用户场景）
  Step 5: MiniMax生成内容简报
  Step 6: 生成Markdown落地页内容
"""
import json, os, random, re, subprocess, sys, time, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter

# ===================== 配置 =====================
SKILL_DIR = Path(__file__).parent.resolve()
TOOLKIT_DIR = SKILL_DIR.parent.parent.parent
TOOLS_LINK_PATH = SKILL_DIR.parent / 'data' / 'tools-link.md'
TEMPLATE_DEFAULT = 'online-enhance-template-id14451'
OUT_DIR = TOOLKIT_DIR / 'outputs'
OUT_DIR.mkdir(exist_ok=True)

SERPAPI_KEY = 'c72079d91f90afca9e8e4c72c19a98dbaaab83c8cc96b56b62cfc624762b54f3'
MINIMAX_API_KEY = 'sk-cp-zsgH-s30SG1FPwDapF6gc2ncfM5NXPz3geRqO5bJOOpKBJgus1WLGjV43hNnWE20dWd9vkOzt_ORAdUWKsgEWFCd3_fRX8gKlJ7nsBCvguOCDYMdGj4cF68'
SITEMAP_URL = 'https://online.hitpaw.com/sitemap.xml'

VERTICAL_COMPETITORS = {
    'zmo.ai', 'fotor.com', 'lightxeditor.com', 'seaart.ai',
    'remaker.ai', 'canva.com', 'pixai.art', 'artguru.ai',
    'nightcafe.studio', 'starryai.com', 'wombo.art', 'baseten.co',
}
EXCLUDE_DOMAINS = {
    'apps.apple.com', 'play.google.com', 'github.com',
    'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
    'youtube.com', 'youtu.be', 'pinterest.com', 'reddit.com', 'wikipedia.org',
}
EXCLUDE_PATTERNS = ['upload', 'convert', 'compress', 'tools.apple', 'login', 'signup', 'signin', 'price', 'pricing']


# ===================== 工具函数 =====================

def fetch_url(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception:
        return ''


def fetch_url_title(url):
    raw = fetch_url(url, timeout=10)
    if not raw:
        return url.split('/')[-1].replace('.html', '').replace('-', ' ').title()
    m = re.search(r'<title[^>]*>(.*?)</title>', raw, re.IGNORECASE | re.DOTALL)
    if m:
        return re.sub(r'<[^>]+>', '', m.group(1)).strip()
    return raw.split('\n')[0][:80] if raw else url


def extract_text_from_html(html):
    if not html:
        return ''
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<[^>]+>', ' ', html)
    html = re.sub(r'\s+', ' ', html).strip()
    return html


def get_domain(url):
    m = re.search(r'https?://([^/]+)', url)
    return m.group(1).lower() if m else ''


def is_seo_page(url, text):
    domain = get_domain(url)
    if any(d in domain for d in EXCLUDE_DOMAINS):
        return False
    if any(p in url.lower() for p in EXCLUDE_PATTERNS):
        return False
    # 必须有实质内容（snippet足够长或者URL不是导航页）
    if len(text) < 100:
        return False
    return True


def get_vertical_weight(url):
    for vc in VERTICAL_COMPETITORS:
        if vc in get_domain(url).lower():
            return 1
    return 0


def title_case(s):
    words = s.split()
    result = []
    for w in words:
        if w.upper() in ('AI', 'VA', 'ML', 'NLP', 'CV', 'SaaS', 'API', 'SEO', 'SEM', 'PPC', 'CTR', 'ROI'):
            result.append(w.upper())
        else:
            result.append(w.title())
    return ' '.join(result)


def count_words(text):
    """统计英文单词（去停用词后）"""
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'if', 'because', 'while', 'about', 'your', 'our', 'their'}
    words = re.findall(r'[a-zA-Z]+', text.lower())
    return [w for w in words if w not in stop_words and len(w) > 2]


# ===================== MiniMax AI 调用 =====================



def load_config():
    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
    if not os.path.exists(cfg_path):
        return None
    with open(cfg_path, encoding='utf-8') as f:
        return json.load(f)

def save_config(cfg):
    cfg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
    with open(cfg_path, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

def setup_config_wizard():
    print('')
    print('=' * 50)
    print('LLM Configuration Wizard')
    print('=' * 50)
    providers = {
        '1': {'id': 'minimax', 'name': 'MiniMax', 'default_model': 'MiniMax-M2.7'},
        '2': {'id': 'openai',  'name': 'OpenAI',  'default_model': 'gpt-4o'},
        '3': {'id': 'gemini',  'name': 'Gemini',   'default_model': 'gemini-2.5-flash'},
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
    save_config(cfg)
    print('Saved config.json (provider=' + p['name'] + ', model=' + model + ')')
    return cfg

def call_llm(prompt, max_tokens=None, config=None):
    if config is None:
        config = load_config()
    if config is None:
        print('config.json not found. Run setup wizard first.')
        sys.exit(1)
    provider = config.get('provider', 'minimax')
    model = config.get('model', '')
    api_key = config.get('api_key', '')
    cfg_max = config.get('max_tokens', 8192)
    if max_tokens is None:
        max_tokens = cfg_max
    if provider == 'minimax':
        return _call_minimax(prompt, api_key, model, max_tokens)
    elif provider == 'openai':
        return _call_openai(prompt, api_key, model, max_tokens)
    elif provider == 'gemini':
        return _call_gemini(prompt, api_key, model, max_tokens)
    else:
        print('Unknown provider: ' + provider)
        return None

def _call_minimax(prompt, api_key, model, max_tokens):
    import json as _json
    url = "https://api.minimaxi.com/anthropic/v1/messages"
    headers = {
        "Authorization": "Bearer " + api_key,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    payload = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
    try:
        req = urllib.request.Request(url, data=_json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = _json.loads(resp.read().decode())
            # Handle MiniMax M2.7 response format (may contain thinking items)
            for item in data.get("content", []):
                if item.get("type") == "text":
                    return item["text"]
            return None
    except Exception as e:
        print('  [MiniMax] Error: ' + str(e))
        return None

def _call_openai(prompt, api_key, model, max_tokens):
    import json as _json
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": "Bearer " + api_key, "Content-Type": "application/json"}
    payload = {"model": model, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
    try:
        req = urllib.request.Request(url, data=_json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = _json.loads(resp.read().decode())
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print('  [OpenAI] Error: ' + str(e))
        return None

def _call_gemini(prompt, api_key, model, max_tokens):
    import json as _json
    url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + api_key
    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"maxOutputTokens": max_tokens}}
    try:
        req = urllib.request.Request(url, data=_json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = _json.loads(resp.read().decode())
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print('  [Gemini] Error: ' + str(e))
        return None


def search_competitors(keyword, target=10):
    """用 SerpAPI 搜索 Google，翻页补齐至少 target 个候选页面"""
    import requests
    results = []
    page = 0
    seen_urls = set()

    while len(results) < target:
        start = page * 10
        print(f'\n🔍 搜索（SerpAPI 第{page+1}页）: "{keyword}"')
        try:
            resp = requests.get('https://serpapi.com/search.json', params={
                'q': keyword,
                'api_key': SERPAPI_KEY,
                'num': 10,
                'start': start,
                'engine': 'google',
            }, timeout=30)
            data = resp.json()
        except Exception as e:
            print(f'  请求失败: {e}')
            break

        organic = data.get('organic_results', [])
        if not organic:
            print(f'  第{page+1}页无结果')
            break

        for item in organic:
            url = item.get('link', '')
            if url in seen_urls or not url:
                continue
            seen_urls.add(url)
            domain = get_domain(url)
            weight = get_vertical_weight(url)
            snippet = item.get('snippet', '')
            is_seo = is_seo_page(url, snippet)

            results.append({
                'url': url,
                'title': item.get('title', ''),
                'content': snippet,
                'domain': domain,
                'weight': weight,
                'is_seo_candidate': is_seo,
                'position': item.get('position', 0),
            })

        print(f'  本页获取 {len(organic)} 个，累计 {len(results)} 个')
        page += 1
        if page > 5:
            break

    print(f'\n  搜索完成，共 {len(results)} 个候选')
    for i, r in enumerate(results[:5]):
        print(f'    [{i+1}] {r["domain"]} (权重+{r["weight"]}) {"✅" if r["is_seo_candidate"] else "❌"} {r["title"][:60]}')
    return results


# ===================== 第二步：深度分析页面 =====================

def fetch_url_v2(url, timeout=15):
    """增强版 fetch_url，支持 gzip，User-Agent 更完善"""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        })
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception:
        return ''


def fetch_via_serpapi(url, keyword):
    """通过 SerpAPI 用 site: 查询还原页面摘要（Tier 2 降级）"""
    import requests
    domain = get_domain(url)
    try:
        resp = requests.get('https://serpapi.com/search.json', params={
            'q': keyword + ' site:' + domain,
            'api_key': SERPAPI_KEY,
            'num': 1,
            'engine': 'google',
        }, timeout=20)
        data = resp.json()
        organic = data.get('organic_results', [])
        if organic:
            item = organic[0]
            return {
                'title': item.get('title', ''),
                'meta_description': item.get('snippet', ''),
            }
    except Exception:
        pass
    return None



def analyze_page(url, depth=0, keyword=''):
    print(f'  {"  " * depth} analyzing: {url}')

    raw_source = 'none'
    page_title = ''
    meta_desc = ''
    h1s = []
    h2s = []
    h3s = []
    top_keywords = {}
    feature_sentences = []
    use_case_sentences = []
    faq_qs = []
    screen_sections = []
    word_count = 0

    # Tier 1: urllib enhanced
    raw = ''
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='ignore')
        if raw and len(raw) > 500 and '<title' in raw:
            raw_source = 'urllib'
    except Exception:
        raw = ''

    # Tier 2: SerpAPI
    if raw_source == 'none':
        try:
            import requests
            domain = get_domain(url)
            q = keyword + ' site:' + domain if keyword else domain
            resp = requests.get('https://serpapi.com/search.json', params={
                'q': q,
                'api_key': SERPAPI_KEY,
                'num': 1,
                'engine': 'google',
            }, timeout=20)
            data2 = resp.json()
            organic = data2.get('organic_results', [])
            if organic:
                item = organic[0]
                raw_source = 'serpapi'
                page_title = item.get('title', '')
                meta_desc = item.get('snippet', '')
                h1s = [page_title]
                words = count_words(meta_desc)
                word_freq = Counter(words)
                top_keywords = {w: c for w, c in word_freq.most_common(20)}
                word_count = len(words)
                print(f'    [SerpAPI] title: {page_title[:60]}')
        except Exception:
            pass

    if raw_source == 'none':
        print(f'    failed: urllib and SerpAPI both unavailable')
        return None

    # Parse from raw HTML (urllib path only)
    if raw_source == 'urllib':
        text2 = extract_text_from_html(raw)

        m = re.search(r'<title[^>]*>(.*?)</title>', raw, re.IGNORECASE | re.DOTALL)
        if m:
            page_title = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        m = re.search(r'<meta name="description" content="([^"]+)"', raw, re.IGNORECASE)
        if not m:
            m = re.search(r'<meta content="([^"]+)" name="description"', raw, re.IGNORECASE)
        if m:
            meta_desc = m.group(1).strip()

        h1s = [re.sub(r'<[^>]+>', '', h).strip() for h in re.findall(r'<h1[^>]*>(.*?)</h1>', raw, re.IGNORECASE | re.DOTALL)]
        h1s += [re.sub(r'<[^>]+>', '', h).strip() for h in re.findall(r'^#\s+(.+)$', raw, re.MULTILINE)]
        h2s = [re.sub(r'<[^>]+>', '', h).strip() for h in re.findall(r'<h2[^>]*>(.*?)</h2>', raw, re.IGNORECASE | re.DOTALL)]
        h2s += [re.sub(r'<[^>]+>', '', h).strip() for h in re.findall(r'^##\s+(.+)$', raw, re.MULTILINE)]
        h3s = [re.sub(r'<[^>]+>', '', h).strip() for h in re.findall(r'<h3[^>]*>(.*?)</h3>', raw, re.IGNORECASE | re.DOTALL)]
        h1s = list(dict.fromkeys(h1s))
        h2s = list(dict.fromkeys(h2s))

        words = count_words(text2)
        word_freq = Counter(words)
        top_keywords = {w: c for w, c in word_freq.most_common(30)}

        feature_kw = ['feature', 'key feature', 'capability', 'function', 'benefit', 'advantage']
        feature_sentences = []
        for kw in feature_kw:
            pattern = r'[^.!?]*' + re.escape(kw) + r'[^.!?]*[.!?]'
            matches = re.findall(pattern, text2, re.IGNORECASE)
            feature_sentences.extend([m.strip() for m in matches[:3]])

        use_case_kw = ['use case', 'scenario', 'perfect for', 'great for', 'ideal for', 'application']
        use_case_sentences = []
        for kw in use_case_kw:
            pattern = r'[^.!?]*' + re.escape(kw) + r'[^.!?]*[.!?]'
            matches = re.findall(pattern, text2, re.IGNORECASE)
            use_case_sentences.extend([m.strip() for m in matches[:3]])

        faq_qs = [re.sub(r'<[^>]+>', '', q).strip() for q in re.findall(r'<h3[^>]*>(.*?)</h3>', raw, re.IGNORECASE | re.DOTALL) if 'faq' in q.lower() or 'question' in q.lower()]

        screen_sections = []
        for h2 in h2s[:8]:
            idx3 = text2.find(h2) if h2 in text2 else 0
            section_text = text2[idx3:idx3+500]
            section_words = count_words(section_text)
            section_freq = Counter(section_words)
            screen_sections.append({'heading': h2, 'keywords': {w: c for w, c in section_freq.most_common(10)}})

        word_count = len(words)

    analysis = {
        'url': url,
        'title': page_title,
        'meta_description': meta_desc,
        'h1s': h1s,
        'h2s': h2s,
        'h3s': h3s[:6],
        'top_keywords': top_keywords,
        'features': list(set(feature_sentences))[:5],
        'use_cases': list(set(use_case_sentences))[:5],
        'faq_questions': faq_qs[:6],
        'screen_sections': screen_sections,
        'word_count': word_count,
        'source': raw_source,
    }
    print(f'    [{raw_source}] title: {page_title[:50]}')
    print(f'    H1: {h1s[:2]}, H2: {len(h2s)} pcs, top keywords: {list(top_keywords.keys())[:5]}')
    return analysis


def research_competitors(keyword, target=10):
    """完整调研：搜索→翻页→分析10个页面"""
    competitors = search_competitors(keyword, target=target)

    seo_pages = [c for c in competitors if c['is_seo_candidate']]
    if not seo_pages:
        print('  ⚠️ 无SEO候选页，用全量结果')
        seo_pages = competitors[:target]
    else:
        seo_pages.sort(key=lambda x: x['weight'], reverse=True)

    seo_pages = seo_pages[:target]

    analyses = []
    for c in seo_pages:
        a = analyze_page(c['url'], keyword=keyword)
        if a:
            a['weight'] = c['weight']
            analyses.append(a)
        time.sleep(0.3)

    print(f'\n✅ 完成分析 {len(analyses)} 个页面')
    return analyses


# ===================== 第三步：关键词提炼 =====================

def extract_keywords(analyses, min_freq_pct=80):
    """从10个页面提炼核心关键词和H1-H3高频词"""
    all_words = Counter()
    h1_h3_words = Counter()
    meta_words = Counter()

    for a in analyses:
        # Top keywords from each page
        for w, c in a.get('top_keywords', {}).items():
            all_words[w] = all_words[w] + c

        # H1-H3 words (weighted)
        for h_list in [a.get('h1s', []), a.get('h2s', []), a.get('h3s', [])]:
            for h in h_list:
                hw = count_words(' '.join(h_list) if isinstance(h_list[0], str) else h)
                for w in hw:
                    h1_h3_words[w] += 1

        # Meta description words
        meta_text = a.get('meta_description', '')
        for w in count_words(meta_text):
            meta_words[w] += 1

    n = len(analyses)
    threshold = max(1, int(n * min_freq_pct / 100))

    # Core keywords: frequency >= threshold in overall word count
    core_words = {w: c for w, c in all_words.items() if c >= threshold}

    # H1-H3 high frequency words
    h1_h3_high = {w: c for w, c in h1_h3_words.items() if c >= threshold}

    # Top 20 meta words
    meta_top = dict(meta_words.most_common(20))

    return {
        'core_words': core_words,
        'h1_h3_high': h1_h3_high,
        'meta_top': meta_top,
        'total_pages': n,
        'threshold': threshold,
    }


# ===================== 第四步：场景提炼 =====================

def extract_scenes(analyses):
    """从FAQ和Use Cases挖用户场景"""
    all_faqs = []
    all_uc = []
    all_features = []

    for a in analyses:
        all_faqs.extend(a.get('faq_questions', []))
        all_uc.extend(a.get('use_cases', []))
        all_features.extend(a.get('features', []))

    # Deduplicate and combine
    scene_summary = {
        'faqs': list(set(all_faqs))[:12],
        'use_cases': list(set(all_uc))[:18],
        'features': list(set(all_features))[:12],
    }
    return scene_summary


# ===================== 第五步：MiniMax 生成内容简报 =====================

def build_brief_prompt(keyword, analyses, tools, sitemap_urls, scene_data, keyword_data, product_desc=''):
    """构建发给 MiniMax 的内容简报 prompt（v2：含提炼后的关键词和场景）"""

    tools_json = json.dumps([{'name': t['name'], 'url': t['url']} for t in tools], ensure_ascii=False)
    sitemap_json = json.dumps(sitemap_urls[:6], ensure_ascii=False)

    # 核心词
    core_words = keyword_data.get('core_words', {})
    h1_h3_words = keyword_data.get('h1_h3_high', {})
    meta_top = keyword_data.get('meta_top', {})

    kw_lower = keyword.lower()
    is_princess = 'princess' in kw_lower or 'disney' in kw_lower
    is_animal = 'animal' in kw_lower

    theme_hint = ''
    if is_princess:
        theme_hint = '主题风格：Disney 公主风，梦幻、优雅、故事感强'
    elif is_animal:
        theme_hint = '主题风格：动物/萌宠，有趣、活泼、自然'
    else:
        theme_hint = '主题风格：通用 AI 视频生成工具'

    prompt = f"""你现在是 HitPaw Online 网站的 SEO 运营专家。

## 任务
为「{keyword}」创建一个用于谷歌搜索引擎排名的落地页面内容方案。

## 产品信息
核心关键词：{keyword}
{theme_hint}
产品功能描述：{product_desc or 'AI-powered video generation tool'}
产品落地页示例：https://online.hitpaw.com/online-video-effects.html

## 竞品关键词分析结果
已从10个竞品页面提炼出以下关键词：

【核心高频词】（≥80%竞品页面出现）:
{json.dumps(core_words, ensure_ascii=False, indent=2)}

【H1-H3标题高频词】:
{json.dumps(h1_h3_words, ensure_ascii=False, indent=2)}

【Meta描述高频词】:
{json.dumps(meta_top, ensure_ascii=False, indent=2)}

## 用户场景（从FAQ和Use Cases提炼）
{json.dumps(scene_data, ensure_ascii=False, indent=2)}

## 可用工具推荐
{tools_json}

## 相关文章
{sitemap_json}

## 输出要求
直接输出 JSON，不要 markdown 代码块，不要解释：
{{
  "h1": "H1主标题（英文，含关键词，≤60字符）",
  "subtitle": "副标题（英文，20-30词，突出核心价值和用户收益）",
  "steps": [
    {{"title": "步骤标题（英文，≤5词）", "description": "步骤描述（英文，20-40词，说明用户操作和AI响应）"}},
    ...（3个步骤）
  ],
  "features": [
    {{"title": "功能标题（英文，≤5词）", "description": "功能描述（英文，25-50词，说明原理、优势和效果，融入核心关键词）"}},
    ...（4个功能）
  ],
  "use_cases": [
    {{"title": "场景标题（英文，3-5词）", "description": "场景描述（英文，20-35词，说明场景、用户目标、达成效果）"}},
    ...（6个场景）
  ],
  "faqs": [
    {{"question": "常见问题（英文，疑问句，15-30词）", "answer": "回答（英文，25-40词，专业具体）"}},
    ...（4个FAQ）
  ],
  "bottom_cta": {{
    "h2": "底部CTA标题（英文，含情感词，5-8词）",
    "description": "底部CTA描述（英文，20-30词）",
    "button_text": "CTA按钮文案（英文，3-6词，动词开头）"
  }}
}}

严格输出纯 JSON，不要其他内容。"""

    return prompt


def generate_content_brief(keyword, analyses, tools, sitemap_urls, scene_data, keyword_data, product_desc=''):
    cfg = load_config()
    provider_name = cfg.get('provider', 'MiniMax').capitalize() if cfg else 'MiniMax'
    print(f'\n🤖 调用 {provider_name} 生成内容简报...')
    prompt = build_brief_prompt(keyword, analyses, tools, sitemap_urls, scene_data, keyword_data, product_desc)
    raw = call_llm(prompt)
    print(f'  简报原始长度: {len(raw)} 字符')
    try:
        return json.loads(raw.strip())
    except (json.JSONDecodeError, AttributeError) as e:
        print(f'  ⚠️ JSON 解析失败: {e}，降级处理')
        return raw


# ===================== 第六步：生成 Markdown =====================

def parse_brief_for_markdown(brief_data):
    if isinstance(brief_data, dict):
        return {
            'h1': brief_data.get('h1', ''),
            'subtitle': brief_data.get('subtitle', ''),
            'steps': [(s.get('title', ''), s.get('description', '')) for s in brief_data.get('steps', []) if s.get('title')],
            'features': [(f.get('title', ''), f.get('description', '')) for f in brief_data.get('features', []) if f.get('title')],
            'use_cases': [(u.get('title', ''), u.get('description', '')) for u in brief_data.get('use_cases', []) if u.get('title')],
            'faqs': [(q.get('question', ''), q.get('answer', '')) for q in brief_data.get('faqs', []) if q.get('question')],
            'cta_h2': (brief_data.get('bottom_cta') or {}).get('h2', ''),
            'cta_desc': (brief_data.get('bottom_cta') or {}).get('description', ''),
            'cta_btn': (brief_data.get('bottom_cta') or {}).get('button_text', ''),
        }
    return {'h1': '', 'subtitle': '', 'steps': [], 'features': [], 'use_cases': [], 'faqs': [], 'cta_h2': '', 'cta_desc': '', 'cta_btn': ''}


def generate_markdown(keyword, analyses, tools, sitemap_urls, brief, template_id):
    print(f'\n✍️ 生成 Markdown...')

    kw_lower = keyword.lower()
    is_princess = 'princess' in kw_lower or 'disney' in kw_lower
    primary_cta = 'https://online.hitpaw.com/online-video-effects.html'

    brief_data = parse_brief_for_markdown(brief)
    print(f'  [brief] h1={repr(brief_data.get("h1", "")[:50])}')
    print(f'  [brief] steps={len(brief_data.get("steps", []))} features={len(brief_data.get("features", []))} use_cases={len(brief_data.get("use_cases", []))} faqs={len(brief_data.get("faqs", []))}')

    tips = []
    for url in sitemap_urls[:8]:
        title = fetch_url_title(url)
        tips.append((url, f'· {title}'))
    while len(tips) < 3:
        tips.append(('https://online.hitpaw.com/video-tips/', '· AI Video Tips'))

    lines = []
    lines.append(f'# 落地页内容填充模板\n')
    lines.append(f'> 自动生成 | 核心词: {keyword} | 分析页面: {len(analyses)} 个\n')

    h1 = brief_data.get('h1') or title_case(keyword)
    lines.append('## Hero 主横幅\n')
    lines.append(f'- **H1 主标题**：{h1}\n')
    subtitle = brief_data.get('subtitle') or f'Create stunning {keyword.replace("-", " ")} content in seconds — no design skills needed.'
    lines.append(f'- **副标题**：{subtitle}\n')
    lines.append(f'- **主 CTA 链接**：`{primary_cta}`\n')
    lines.append(f'- **主 CTA 第一行文案**：Generate for Free\n')
    lines.append(f'- **主 CTA 第二行副文案**：No Installation Required\n')
    lines.append(f'- **次 CTA 链接**：`https://online.hitpaw.com/pricing/`\n')
    lines.append(f'- **次 CTA 文案**：See Pricing Plans\n')
    lines.append(f'- **移动端 CTA 链接**：`{primary_cta}`\n')
    lines.append(f'- **移动端 CTA 文案**：Try It Free\n')
    lines.append(f'- **Hero 图片 URL**：`https://www.hitpaw.com/images/placeholder-hero.png`\n')
    lines.append(f'- **Hero 图片 Alt**：{h1}\n')

    # Steps
    lines.append('## Steps 三步使用流程\n')
    steps_h2 = title_case(keyword) + ': How It Works'
    if is_princess:
        steps_h2 = 'How to Create an AI Disney Princess Video'
    lines.append(f'- **Section H2 标题**：{steps_h2}\n')
    lines.append(f'- **Steps 底部 CTA 链接**：`{primary_cta}`\n')
    lines.append(f'- **Steps 底部 CTA 文案**：Create Video Now\n')
    for i, (title, desc) in enumerate(brief_data.get('steps', []), 1):
        lines.append(f'### Step {i}\n')
        lines.append(f'- **标题**：{title}\n')
        lines.append(f'- **描述**：{desc}\n')
        lines.append(f'- **截图 URL**：`https://www.hitpaw.com/images/placeholder-step-{i}.png`\n')
        lines.append(f'- **图片 Alt**：{title}\n')

    # Features
    lines.append('## Features 核心功能\n')
    lines.append(f'- **Section H2 标题**：Key Features of {title_case(keyword)}\n')
    for i, (ftitle, fdesc) in enumerate(brief_data.get('features', []), 1):
        lines.append(f'### Feature {i}\n')
        lines.append(f'- **标题**：{ftitle}\n')
        lines.append(f'- **描述**：{fdesc}\n')
        lines.append(f'- **配图 URL**：`https://www.hitpaw.com/images/placeholder-feature-{i}.png`\n')
        lines.append(f'- **配图 Alt**：{ftitle}\n')
        lines.append(f'- **跳转链接**：`{primary_cta}`\n')
        lines.append(f'- **CTA 文案**：Generate Now\n')

    # Use Cases
    lines.append('## Use Cases 适用场景\n')
    lines.append(f'- **Section H2 标题**：Transform Your Content into Magic\n')
    lines.append(f'- **引导段落**：Whether for personal fun or social engagement, our AI generator fits perfectly into these scenarios:\n')
    for i, (uctitle, ucdesc) in enumerate(brief_data.get('use_cases', []), 1):
        lines.append(f'### 场景 {i}\n')
        lines.append(f'- **标题**：{uctitle}\n')
        lines.append(f'- **描述**：{ucdesc}\n')
        lines.append(f'- **配图 URL**：`https://www.hitpaw.com/images/placeholder-uc-{i}.png`\n')
        lines.append(f'- **配图 Alt**：{uctitle}\n')

    # More Tools
    lines.append('## More Tools 更多工具推荐\n')
    lines.append('- **Section H2 标题**：Explore More AI Video Effects\n')
    tool_defaults = [
        ('AI Video Enhancer', 'Upscale and enhance video quality with AI.', 'https://online.hitpaw.com/online-video-enhancer.html'),
        ('AI Cartoon Video', 'Turn any video into a stunning cartoon style.', 'https://online.hitpaw.com/ai-cartoon-video.html'),
        ('AI Photo Enhancer', 'Upscale and fix blurry photos with one click.', 'https://online.hitpaw.com/ai-photo-enhancer.html'),
    ]
    display_tools = tools if len(tools) >= 6 else tools + tool_defaults
    for i, tool in enumerate(display_tools[:6], 1):
        name = tool.get('name', f'AI Tool {i}') if isinstance(tool, dict) else tool
        url = tool.get('url', '#') if isinstance(tool, dict) else '#'
        lines.append(f'### 工具 {i}\n')
        lines.append(f'- **名称**：{name}\n')
        lines.append(f'- **简短描述**：Create stunning AI-powered content with this easy-to-use tool.\n')
        lines.append(f'- **卡片图片 URL**：`https://www.hitpaw.com/images/icon-{i}.png`\n')
        lines.append(f'- **卡片图片 Alt**：{name}\n')
        lines.append(f'- **跳转链接**：`{url}`\n')

    # FAQ
    lines.append('## FAQ 常见问题\n')
    lines.append(f'- **Section H2 标题**：FAQs About {title_case(keyword)}\n')
    for i, (q, a) in enumerate(brief_data.get('faqs', []), 1):
        lines.append(f'### Q{i}\n')
        lines.append(f'- **问题（含 Q{i}: 前缀）**：Q{i}: {q}\n')
        lines.append(f'- **回答**：{a}\n')

    # Tips
    lines.append('## Tips 使用技巧 / 推荐文章\n')
    lines.append('- **Section H2 标题**：Learn More About AI Video Generation\n')
    for i, (turl, ttext) in enumerate(tips, 1):
        lines.append(f'### Tip {i}\n')
        lines.append(f'- **文章链接**：`{turl}`\n')
        lines.append(f'- **文章标题（带 · 前缀）**：{ttext}\n')

    # Bottom CTA
    bcta_h2 = brief_data.get('cta_h2') or 'Bring Your Vision to Life'
    bcta_desc = brief_data.get('cta_desc') or f'Create stunning {keyword.replace("-", " ")} content fast and easily.'
    lines.append('## Bottom CTA 底部 CTA\n')
    lines.append(f'- **H2 标题**：{bcta_h2}\n')
    lines.append(f'- **描述文字**：{bcta_desc}\n')
    lines.append(f'- **背景图 URL**：`https://www.hitpaw.com/images/bottom-banner.png`\n')
    lines.append(f'- **背景图 Alt**：{bcta_h2}\n')
    lines.append('### 桌面端 CTA\n')
    lines.append(f'- **链接**：`{primary_cta}`\n')
    lines.append(f'- **第一行文案**：Generate for Free\n')
    lines.append(f'- **第二行副文案**：No Installation Required\n')
    lines.append('### iOS 移动端 CTA\n')
    lines.append(f'- **链接**：`{primary_cta}`\n')
    lines.append(f'- **文案**：Try It Free\n')
    lines.append('### Android 移动端 CTA\n')
    lines.append(f'- **链接**：`{primary_cta}`\n')
    lines.append(f'- **文案**：Try It Free\n')

    return '\n'.join(lines)


# ===================== 主流程 =====================

def main():
    config = load_config()
    if config is None:
        print('LLM config not found. Running wizard...')
        config = setup_config_wizard()
    print('Using provider: ' + config.get('provider','') + ', model: ' + config.get('model',''))

    if len(sys.argv) < 2:
        print('用法: python3 generate.py "keyword" [product_desc]')
        sys.exit(1)

    keyword = sys.argv[1].strip()
    product_desc = sys.argv[2].strip() if len(sys.argv) > 2 else ''

    print('=' * 50)
    print(f'SEO Content Generator v3')
    print(f'关键词: {keyword}')
    print(f'产品描述: {product_desc or "(未提供)"}')
    print('=' * 50)

    # Step 1-2: 调研（搜索+分析）
    analyses = research_competitors(keyword, target=10)

    # Step 3: 动态素材
    tools = load_tools_link()
    sitemap_urls = fetch_sitemap_articles(keyword, n=6)

    # Step 4: 关键词提炼
    keyword_data = extract_keywords(analyses, min_freq_pct=80)
    core_count = len(keyword_data.get('core_words', {}))
    h1h3_count = len(keyword_data.get('h1_h3_high', {}))
    print(f'\n📊 关键词提炼结果（≥80%频次）')
    print(f'  核心词: {core_count} 个')
    print(f'  H1-H3高频词: {h1h3_count} 个')
    print(f'  Meta高频词: {len(keyword_data.get("meta_top", {}))} 个')

    # Step 5: 场景提炼
    scene_data = extract_scenes(analyses)
    print(f'\n🎯 场景提炼结果')
    print(f'  FAQ: {len(scene_data["faqs"])} 条')
    print(f'  UseCases: {len(scene_data["use_cases"])} 条')
    print(f'  Features: {len(scene_data["features"])} 条')

    # Step 6: 生成内容简报
    brief = generate_content_brief(keyword, analyses, tools, sitemap_urls, scene_data, keyword_data, product_desc)

    # Step 7: 生成 Markdown
    markdown = generate_markdown(keyword, analyses, tools, sitemap_urls, brief, TEMPLATE_DEFAULT)

    # Step 8: 输出文件
    slug = re.sub(r'[^a-z0-9]+', '-', keyword.lower()).strip('-')
    ts = time.strftime('%Y-%m-%d %H:%M')

    # ===== 文件一：调研文档 =====
    research_lines = []
    research_lines.append(f"# SEO 调研文档\n")
    research_lines.append(f"> 核心词: {keyword} | 生成时间: {ts} | 分析页面: {len(analyses)} 个\n")

    # ① 调研 URL 清单
    research_lines.append(f'## ① 调研 URL 清单\n')
    research_lines.append(f'共分析 {len(analyses)} 个页面：\n\n')
    for i, a in enumerate(analyses, 1):
        research_lines.append(f'{i}. **{a["title"]}**\n')
        research_lines.append(f'   URL: {a["url"]}\n')
        research_lines.append(f'   权重: +{a.get("weight", 0)}\n')
        research_lines.append(f'   H1: {", ".join(a.get("h1s", [])[:2])}\n')
        research_lines.append(f'   Meta描述: {a.get("meta_description", "")[:80]}\n\n')

    # ② 关键词提炼结果
    research_lines.append(f'## ② 关键词提炼\n')
    research_lines.append(f'> 数据来源: {len(analyses)}个竞品页面 | 频次阈值: ≥80%\n\n')
    research_lines.append(f'### 核心高频词（≥80%竞品出现）\n')
    for w, c in sorted(keyword_data.get('core_words', {}).items(), key=lambda x: x[1], reverse=True)[:20]:
        research_lines.append(f'- {w}: {c}\n')
    research_lines.append(f'\n### H1-H3 高频词\n')
    for w, c in sorted(keyword_data.get('h1_h3_high', {}).items(), key=lambda x: x[1], reverse=True)[:20]:
        research_lines.append(f'- {w}: {c}\n')
    research_lines.append(f'\n### Meta描述高频词\n')
    for w, c in sorted(keyword_data.get('meta_top', {}).items(), key=lambda x: x[1], reverse=True)[:20]:
        research_lines.append(f'- {w}: {c}\n')

    # ③ 场景提炼结果
    research_lines.append(f'\n## ③ 场景提炼\n')
    research_lines.append(f'### FAQ 问题清单\n')
    for q in scene_data.get('faqs', [])[:10]:
        research_lines.append(f'- {q}\n')
    research_lines.append(f'\n### Use Cases 清单\n')
    for uc in scene_data.get('use_cases', [])[:12]:
        research_lines.append(f'- {uc}\n')
    research_lines.append(f'\n### Features 清单\n')
    for f in scene_data.get('features', [])[:10]:
        research_lines.append(f'- {f}\n')

    # ④ 内容策略简报（解析后格式）
    research_lines.append(f'\n## ④ 内容策略简报\n')
    brief_parsed = parse_brief_for_markdown(brief)
    if isinstance(brief_parsed, dict) and brief_parsed.get('h1'):
        research_lines.append(f'### 关键词与定位\n')
        research_lines.append(f'- **H1**: {brief_parsed.get("h1", "")}\n')
        research_lines.append(f'- **副标题**: {brief_parsed.get("subtitle", "")}\n\n')
        research_lines.append(f'### 用户场景\n')
        for i, (t, d) in enumerate(brief_parsed.get('use_cases', []), 1):
            research_lines.append(f'{i}. **{t}** — {d}\n')
        research_lines.append(f'\n### 功能特点\n')
        for i, (t, d) in enumerate(brief_parsed.get('features', []), 1):
            research_lines.append(f'{i}. **{t}** — {d}\n')
        research_lines.append(f'\n### 使用步骤\n')
        for i, (t, d) in enumerate(brief_parsed.get('steps', []), 1):
            research_lines.append(f'{i}. **{t}** — {d}\n')
        research_lines.append(f'\n### 常见问题\n')
        for q, a in brief_parsed.get('faqs', []):
            research_lines.append(f'- **{q}**\n  {a}\n')
        research_lines.append(f'\n### 底部 CTA\n')
        research_lines.append(f'- **H2**: {brief_parsed.get("cta_h2", "")}\n')
        research_lines.append(f'- **描述**: {brief_parsed.get("cta_desc", "")}\n')
        research_lines.append(f'- **按钮**: {brief_parsed.get("cta_btn", "")}\n')
    else:
        research_lines.append(f'（无法解析简报）\n')

    out1 = OUT_DIR / f'research-{slug}.md'
    out2 = OUT_DIR / f'content-{slug}.md'

    with open(out1, 'w', encoding='utf-8') as f:
        f.write(''.join(research_lines))
    with open(out2, 'w', encoding='utf-8') as f:
        f.write(markdown)

    print(f'\n✅ 生成完毕！')
    print(f'  📋 调研文档: {out1}')
    print(f'  📄 最终 Markdown: {out2}')
    print(f'  字符数: {len(markdown)}')
    return out1, out2


# ===================== 辅助函数 =====================

def load_tools_link():
    if not TOOLS_LINK_PATH.exists():
        return []
    with open(TOOLS_LINK_PATH, encoding='utf-8') as f:
        content = f.read()
    tools = []
    for line in content.split('\n'):
        line_stripped = line.strip()
        if not line_stripped:
            continue
        m = re.search(r'\[(.+?)\]\(([^)]+)\)', line_stripped)
        if m:
            tools.append({'name': m.group(1).strip(), 'url': m.group(2).strip()})
        elif re.match(r'https?://', line_stripped):
            name = re.sub(r'https?://', '', line_stripped).split('/')[-1]
            name = name.replace('.html', '').replace('-', ' ').title()
            tools.append({'name': name, 'url': line_stripped})
    if not tools:
        return []
    return random.sample(tools, min(6, len(tools)))


def fetch_sitemap_articles(keyword, n=6):
    xml = fetch_url(SITEMAP_URL)
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
        ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        urls = [loc.text for loc in root.findall('.//sm:loc', ns)
                if loc.text and loc.text.startswith('https://online.hitpaw.com/learn/')]
    except ET.ParseError:
        urls = re.findall(r'<loc>(https://online.hitpaw.com/learn/[^<]+)</loc>', xml)
    if not urls:
        return []
    kw_words = re.findall(r'\w+', keyword.lower())
    scored = [(sum(1 for w in kw_words if w in u.lower()), u) for u in urls]
    scored.sort(reverse=True)
    top = [u for _, u in scored[:n]]
    return top


if __name__ == '__main__':
    main()
