import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadToolsDb } from './toolsDbService.js';

export const DEFAULT_TEMPLATE_ID = 'online-enhance-template-id14451';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.resolve(__dirname, '../../templates/seo-landing');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function templateDir(templateId) {
    return path.join(TEMPLATES_ROOT, templateId || DEFAULT_TEMPLATE_ID);
}

function resolveTemplate(templateId = DEFAULT_TEMPLATE_ID) {
    const dir = templateDir(templateId);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`SEO landing template not found: ${templateId}`);
    }

    const manifest = readJson(manifestPath);
    const files = manifest.files || {};
    return {
        ...manifest,
        dir,
        contentTemplatePath: path.join(dir, files.contentTemplate || 'content-template.md'),
        htmlTemplatePath: path.join(dir, files.htmlTemplate || 'structure.html'),
        fieldMapPath: path.join(dir, files.fieldMap || 'field-map.json'),
        partialsDir: path.join(dir, files.partialsDir || 'partials')
    };
}

export function listTemplates() {
    if (!fs.existsSync(TEMPLATES_ROOT)) return [];
    return fs.readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
            const template = resolveTemplate(entry.name);
            return {
                id: template.id,
                name: template.name,
                version: template.version,
                description: template.description || ''
            };
        });
}

export function getTemplate(templateId = DEFAULT_TEMPLATE_ID) {
    return resolveTemplate(templateId || DEFAULT_TEMPLATE_ID);
}

function replaceVars(templateText, vars) {
    return templateText.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (match, key) => {
        const value = vars[key];
        return value === undefined || value === null ? '' : String(value);
    });
}

function pickItems(items, count, fallbackFactory) {
    const source = Array.isArray(items) ? items : [];
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(source[i] || fallbackFactory(i));
    }
    return result;
}

function getPartialPath(template, partialKey) {
    const partialFile = template.partials?.[partialKey];
    if (!partialFile) {
        throw new Error(`Template ${template.id} missing partial mapping: ${partialKey}`);
    }

    const partialPath = path.join(template.partialsDir, partialFile);
    if (!fs.existsSync(partialPath)) {
        throw new Error(`Template ${template.id} partial file not found: ${partialFile}`);
    }

    return partialPath;
}

function renderPartial(template, partialKey, vars) {
    return replaceVars(readText(getPartialPath(template, partialKey)), vars).trim();
}

function renderPartialCollection(template, partialKey, items, mapItem) {
    return items.map((item, index) => renderPartial(template, partialKey, mapItem(item, index))).join('\n\n');
}

export function renderMarkdown(templateId, brief = {}, context = {}) {
    const template = getTemplate(templateId);
    const templateText = readText(template.contentTemplatePath);
    const defaults = template.defaults || {};
    const limits = template.limits || {};
    const keyword = context.keyword || '';
    const ctaPrimary = context.ctaPrimaryHref || defaults.ctaPrimaryHref || '#';

    const tools = context.tools || loadToolsDb();

    const vars = {
        keyword,
        hero_h1: brief.h1 || keyword,
        hero_subtitle: brief.subtitle || '',
        cta_primary_href: ctaPrimary,
        cta_primary_text: defaults.ctaPrimaryText || 'Generate for Free',
        cta_primary_sub: defaults.ctaPrimarySub || '',
        cta_secondary_href: defaults.ctaSecondaryHref || '#',
        cta_secondary_text: defaults.ctaSecondaryText || 'See Pricing Plans',
        cta_mobile_href: ctaPrimary,
        cta_mobile_text: defaults.ctaMobileText || 'Try It Free',
        hero_image_url: 'https://www.hitpaw.com/images/placeholder-hero.png',
        hero_image_alt: brief.h1 || keyword,
        steps_title: `${keyword}: How It Works`,
        features_title: `Key Features of ${keyword}`,
        use_cases_title: 'Transform Your Content into Magic',
        use_cases_desc: 'Whether for personal fun or social engagement, our AI generator fits perfectly into these scenarios:',
        faq_title: `FAQs About ${keyword}`,
        bottom_cta_title: brief.bottom_cta?.h2 || `Create ${keyword} Online`,
        bottom_cta_desc: brief.bottom_cta?.description || 'Start creating high-quality content online in seconds.',
        steps_markdown: renderPartialCollection(
            template,
            'steps',
            pickItems(brief.steps, limits.steps || 3, i => ({ title: `Step ${i + 1}`, description: '' })),
            (step, index) => ({
                index: index + 1,
                title: step.title || `Step ${index + 1}`,
                description: step.description || step.desc || '',
                image_url: `https://www.hitpaw.com/images/placeholder-step-${index + 1}.png`,
                image_alt: step.title || `Step ${index + 1}`
            })
        ),
        features_markdown: renderPartialCollection(
            template,
            'features',
            pickItems(brief.features, limits.features || 4, i => ({ title: `Feature ${i + 1}`, description: '' })),
            (feature, index) => ({
                index: index + 1,
                title: feature.title || `Feature ${index + 1}`,
                description: feature.description || feature.desc || '',
                image_url: `https://www.hitpaw.com/images/placeholder-feature-${index + 1}.png`,
                image_alt: feature.title || `Feature ${index + 1}`,
                link: ctaPrimary,
                cta_text: feature.cta_text || 'Generate Now'
            })
        ),
        use_cases_markdown: renderPartialCollection(
            template,
            'useCases',
            pickItems(brief.use_cases, limits.useCases || 6, i => ({ title: `Use Case ${i + 1}`, description: '' })),
            (useCase, index) => ({
                index: index + 1,
                title: useCase.title || `Use Case ${index + 1}`,
                description: useCase.description || useCase.desc || '',
                image_url: `https://www.hitpaw.com/images/placeholder-uc-${index + 1}.png`,
                image_alt: useCase.title || `Use Case ${index + 1}`
            })
        ),
        more_tools_markdown: renderPartialCollection(
            template,
            'moreTools',
            pickItems(tools, limits.moreTools || 4, i => ({ name: `Tool ${i + 1}`, url: '#' })),
            (tool, index) => ({
                index: index + 1,
                title: tool.name || tool.title || `Tool ${index + 1}`,
                description: tool.description || tool.desc || 'Create stunning AI-powered content.',
                image_url: tool.imgUrl || tool.image_url || `https://www.hitpaw.com/images/icon-${index + 1}.png`,
                image_alt: tool.imgAlt || tool.image_alt || tool.name || tool.title || `Tool ${index + 1}`,
                link_href: tool.url || tool.link_href || '#'
            })
        ),
        faq_markdown: renderPartialCollection(
            template,
            'faqs',
            pickItems(brief.faqs, limits.faqs || 4, () => ({ question: '', answer: '' })),
            (faq, index) => ({
                index: index + 1,
                question: faq.question || '',
                answer: faq.answer || ''
            })
        ),
        tips_markdown: renderPartialCollection(
            template,
            'tips',
            pickItems(context.tips, limits.tips || 8, i => ({ title: `Helpful guide ${i + 1}`, url: '#' })),
            (tip, index) => ({
                index: index + 1,
                link_href: tip.url || tip.link_href || '#',
                link_text: tip.title || tip.link_text || `Helpful guide ${index + 1}`
            })
        )
    };

    return replaceVars(templateText, vars).trim() + '\n';
}

function findHeaders(text, level = 2) {
    const marker = '#'.repeat(level);
    const rx = new RegExp(`^${marker} [^\\n]+`, 'gm');
    const result = [];
    let match;
    while ((match = rx.exec(text)) !== null) {
        result.push({ start: match.index, title: match[0].replace(/^#+\s*/, '').trim() });
    }
    return result;
}

function getBlock(text, headerName, level = 2) {
    const headers = findHeaders(text, level);
    const index = headers.findIndex(header => header.title.toLowerCase().includes(headerName.toLowerCase()));
    if (index === -1) return '';
    const start = headers[index].start;
    const end = index + 1 < headers.length ? headers[index + 1].start : text.length;
    return text.slice(start, end);
}

function getSubBlocks(block, prefixRegex) {
    const rx = new RegExp(`^###\\s+(${prefixRegex})`, 'gm');
    const matches = [];
    let match;
    while ((match = rx.exec(block)) !== null) {
        matches.push({ start: match.index });
    }
    return matches.map((item, index) => {
        const end = index + 1 < matches.length ? matches[index + 1].start : block.length;
        return block.slice(item.start, end);
    });
}

function normalizeKey(key) {
    return key.replace(/\s+/g, '').replace(/[()（）:：]/g, '').trim();
}

function extractFields(block) {
    const fields = {};
    const rx = /^-\s+(?:\*\*([^*]+)\*\*|([^：:\n]+))[：:]\s*(.*)$/gm;
    let match;
    while ((match = rx.exec(block)) !== null) {
        const rawKey = (match[1] || match[2]).trim();
        const value = match[3].trim().replace(/^`|`$/g, '').trim();
        fields[rawKey] = value;
        fields[normalizeKey(rawKey)] = value;
    }
    return fields;
}

function firstField(fields, keys, fallback = '') {
    for (const key of keys) {
        if (fields[key] !== undefined && fields[key] !== '') return fields[key];
        const normalized = normalizeKey(key);
        if (fields[normalized] !== undefined && fields[normalized] !== '') return fields[normalized];
        const prefixKey = Object.keys(fields).find(fieldKey => normalizeKey(fieldKey).startsWith(normalized) && fields[fieldKey] !== '');
        if (prefixKey) return fields[prefixKey];
    }
    return fallback;
}

export function parseMarkdown(templateId, mdText) {
    getTemplate(templateId);
    const data = {
        hero: {},
        steps: {},
        features: {},
        use_cases: {},
        more_tools: {},
        faq: {},
        tips: {},
        bottom_cta: {}
    };

    const heroFields = extractFields(getBlock(mdText, 'Hero'));
    data.hero = {
        headline: firstField(heroFields, ['H1 主标题', 'H1 涓绘爣棰?']),
        subtitle: firstField(heroFields, ['副标题', '鍓爣棰?']),
        cta_primary_href: firstField(heroFields, ['主 CTA 链接', '涓?CTA 閾炬帴']),
        cta_primary_text: firstField(heroFields, ['主 CTA 第一行文案', '涓?CTA 绗竴琛屾枃妗?']),
        cta_primary_sub: firstField(heroFields, ['主 CTA 第二行副文案', '涓?CTA 绗簩琛屽壇鏂囨']),
        cta_secondary_href: firstField(heroFields, ['次 CTA 链接', '娆?CTA 閾炬帴']),
        cta_secondary_text: firstField(heroFields, ['次 CTA 文案', '娆?CTA 鏂囨']),
        cta_mobile_href: firstField(heroFields, ['移动端 CTA 链接', '绉诲姩绔?CTA 閾炬帴']),
        cta_mobile_text: firstField(heroFields, ['移动端 CTA 文案', '绉诲姩绔?CTA 鏂囨']),
        image_url: firstField(heroFields, ['Hero 图片 URL', 'Hero 鍥剧墖 URL']),
        image_alt: firstField(heroFields, ['Hero 图片 Alt', 'Hero 鍥剧墖 Alt'])
    };

    const stepsBlock = getBlock(mdText, 'Steps');
    const stepsFields = extractFields(stepsBlock);
    data.steps = {
        title: firstField(stepsFields, ['Section H2 标题', 'Section H2 鏍囬']),
        cta_href: firstField(stepsFields, ['Steps 底部 CTA 链接', 'Steps 搴曢儴 CTA 閾炬帴']),
        cta_text: firstField(stepsFields, ['Steps 底部 CTA 文案', 'Steps 搴曢儴 CTA 鏂囨'])
    };
    getSubBlocks(stepsBlock, 'Step\\s+\\d+').forEach((block, index) => {
        const fields = extractFields(block);
        data.steps[`step_${index + 1}`] = {
            num: firstField(fields, ['编号', '缂栧彿'], String(index + 1)),
            title: firstField(fields, ['标题', '鏍囬']),
            desc: firstField(fields, ['描述', '鎻忚堪']),
            image_url: firstField(fields, ['截图 URL', '鎴浘 URL']),
            image_alt: firstField(fields, ['图片 Alt', '鍥剧墖 Alt'])
        };
    });

    const featuresBlock = getBlock(mdText, 'Features');
    const featureFields = extractFields(featuresBlock);
    data.features = { title: firstField(featureFields, ['Section H2 标题', 'Section H2 鏍囬']) };
    getSubBlocks(featuresBlock, 'Feature\\s+\\d+').forEach((block, index) => {
        const fields = extractFields(block);
        data.features[`feature_${index + 1}`] = {
            title: firstField(fields, ['标题', '鏍囬']),
            desc: firstField(fields, ['描述', '鎻忚堪']),
            image_url: firstField(fields, ['配图 URL', '閰嶅浘 URL']),
            image_alt: firstField(fields, ['配图 Alt', '閰嶅浘 Alt']),
            link: firstField(fields, ['跳转链接', '璺宠浆閾炬帴']),
            cta_text: firstField(fields, ['CTA 文案', 'CTA 鏂囨'], 'Generate Now')
        };
    });

    const useCasesBlock = getBlock(mdText, 'Use Cases');
    const useCaseFields = extractFields(useCasesBlock);
    data.use_cases = {
        title: firstField(useCaseFields, ['Section H2 标题', 'Section H2 鏍囬']),
        desc: firstField(useCaseFields, ['引导段落', '寮曞娈佃惤'])
    };
    getSubBlocks(useCasesBlock, '场景\\s+\\d+|鍦烘櫙\\s+\\d+').forEach((block, index) => {
        const fields = extractFields(block);
        data.use_cases[`use_case_${index + 1}`] = {
            title: firstField(fields, ['标题', '鏍囬']),
            desc: firstField(fields, ['描述', '鎻忚堪']),
            image_url: firstField(fields, ['配图 URL', '閰嶅浘 URL']),
            image_alt: firstField(fields, ['配图 Alt', '閰嶅浘 Alt'])
        };
    });

    const toolsBlock = getBlock(mdText, 'More Tools');
    const toolsFields = extractFields(toolsBlock);
    data.more_tools = { title: firstField(toolsFields, ['Section H2 标题', 'Section H2 鏍囬']) };
    getSubBlocks(toolsBlock, '工具\\s+\\d+|宸ュ叿\\s+\\d+').forEach((block, index) => {
        const fields = extractFields(block);
        data.more_tools[`tool_${index + 1}`] = {
            title: firstField(fields, ['名称', '鍚嶇О']),
            desc: firstField(fields, ['简短描述', '绠€鐭弿杩?']),
            image_url: firstField(fields, ['卡片图片 URL', '鍗＄墖鍥剧墖 URL']),
            image_alt: firstField(fields, ['卡片图片 Alt', '鍗＄墖鍥剧墖 Alt']),
            link_href: firstField(fields, ['跳转链接', '璺宠浆閾炬帴'])
        };
    });

    const faqBlock = getBlock(mdText, 'FAQ');
    const faqFields = extractFields(faqBlock);
    data.faq = { title: firstField(faqFields, ['Section H2 标题', 'Section H2 鏍囬']) };
    getSubBlocks(faqBlock, 'Q\\d+').forEach((block, index) => {
        const fields = extractFields(block);
        data.faq[`faq_${index + 1}`] = {
            question: firstField(fields, ['问题', '闂']),
            answer: firstField(fields, ['回答', '鍥炵瓟'])
        };
    });

    const tipsBlock = getBlock(mdText, 'Tips');
    const tipFields = extractFields(tipsBlock);
    data.tips = { title: firstField(tipFields, ['Section H2 标题', 'Section H2 鏍囬']) };
    getSubBlocks(tipsBlock, 'Tip\\s+\\d+').forEach((block, index) => {
        const fields = extractFields(block);
        data.tips[`tip_${index + 1}`] = {
            link_href: firstField(fields, ['文章链接', '鏂囩珷閾炬帴', '链接']),
            link_text: firstField(fields, ['文章标题', '鏂囩珷鏍囬', '标题'])
        };
    });

    const bottomBlock = getBlock(mdText, 'Bottom CTA');
    const bottomFields = extractFields(bottomBlock);
    data.bottom_cta = {
        title: firstField(bottomFields, ['H2 标题', 'H2 鏍囬']),
        desc: firstField(bottomFields, ['描述文字', '鎻忚堪鏂囧瓧']),
        image_url: firstField(bottomFields, ['背景图 URL', '鑳屾櫙鍥?URL']),
        image_alt: firstField(bottomFields, ['背景图 Alt', '鑳屾櫙鍥?Alt'])
    };

    [
        ['desktop', '桌面端 CTA', '妗岄潰绔?CTA'],
        ['ios', 'iOS 移动端 CTA', 'iOS 绉诲姩绔?CTA'],
        ['android', 'Android 移动端 CTA', 'Android 绉诲姩绔?CTA']
    ].forEach(([key, cn, legacy]) => {
        const block = getSubBlocks(bottomBlock, `${escapeRegExp(cn)}|${escapeRegExp(legacy)}`)[0] || '';
        const fields = extractFields(block);
        data.bottom_cta[`cta_${key}_href`] = firstField(fields, ['链接', '閾炬帴']);
        data.bottom_cta[`cta_${key}_text`] = firstField(fields, ['第一行文案', '文案', '绗竴琛屾枃妗?', '鏂囨']);
        data.bottom_cta[`cta_${key}_sub`] = firstField(fields, ['第二行副文案', '绗簩琛屽壇鏂囨']);
    });

    return data;
}

function getByPath(data, pathText) {
    return pathText.split('.').reduce((current, part) => {
        if (current === undefined || current === null) return '';
        return current[part];
    }, data);
}

export function renderHtml(templateId, parsedData) {
    const template = getTemplate(templateId);
    let html = readText(template.htmlTemplatePath);
    const fieldMap = readJson(template.fieldMapPath);

    for (const [placeholder, dataPath] of Object.entries(fieldMap)) {
        const value = getByPath(parsedData, dataPath);
        html = html.replaceAll(`{{${placeholder}}}`, value === undefined || value === null ? '' : String(value));
    }

    const remaining = [...html.matchAll(/\{\{([^}]+)\}\}/g)].map(match => match[1]);
    if (remaining.length > 0) {
        throw new Error(`Template ${template.id} has unfilled placeholders: ${[...new Set(remaining)].join(', ')}`);
    }

    return html;
}

export function buildSeoMeta(parsedData) {
    return {
        title: parsedData.hero?.headline || '',
        description: parsedData.hero?.subtitle || ''
    };
}

export function buildJsonLd(parsedData) {
    const faqs = Object.values(parsedData.faq || {})
        .filter(item => item && typeof item === 'object' && item.question && item.answer)
        .map(item => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer
            }
        }));

    const steps = Object.values(parsedData.steps || {})
        .filter(item => item && typeof item === 'object' && item.title)
        .map((item, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: item.title,
            text: item.desc || ''
        }));

    return {
        WebPage: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: parsedData.hero?.headline || '',
            description: parsedData.hero?.subtitle || ''
        },
        FAQPage: faqs.length ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs
        } : null,
        HowTo: steps.length ? {
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: parsedData.steps?.title || '',
            step: steps
        } : null
    };
}
