import fs from 'fs';
import path from 'path';
import { callLLM } from './llmClient.js';
import * as seoLandingService from './seoLandingService.js';

const IMG_BASE_URL = 'https://online.hitpaw.com/images/online-tools-land/';

function slugify(text, fallback = 'image') {
    const slug = (text || '').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug || fallback;
}

function extractFieldValue(line) {
    const codeMatch = line.match(/`([^`]+)`/);
    if (codeMatch) return codeMatch[1].trim();
    const colonIndex = Math.max(line.lastIndexOf('：'), line.lastIndexOf(':'));
    if (colonIndex !== -1) {
        return line.slice(colonIndex + 1).trim().replace(/^`|`$/g, '').trim();
    }
    return '';
}

function hasAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
}

function parseMarkdownEntries(mdText) {
    const lines = mdText.split('\n');
    const entries = [];
    const urlLines = {};
    const altLines = [];
    let currentSection = '';

    const urlKeys = [
        '配图 URL', '截图 URL', '卡片图片 URL', 'Hero 图片 URL', '背景图 URL',
        '閰嶅浘 URL', '鎴浘 URL', '鍗＄墖鍥剧墖 URL', 'Hero 鍥剧墖 URL', '鑳屾櫙鍥?URL'
    ];
    const altKeys = [
        '配图 Alt', '图片 Alt', '卡片图片 Alt', 'Hero 图片 Alt', '背景图 Alt',
        '閰嶅浘 Alt', '鍥剧墖 Alt', '鍗＄墖鍥剧墖 Alt', 'Hero 鍥剧墖 Alt', '鑳屾櫙鍥?Alt'
    ];

    lines.forEach((line, i) => {
        const stripped = line.trim();
        if (stripped.startsWith('### ')) {
            currentSection = stripped.substring(4).trim();
        }
        if (!stripped.includes('**')) return;

        if (hasAny(stripped, urlKeys)) {
            const val = extractFieldValue(stripped);
            if (val.startsWith('http')) urlLines[i] = val;
        } else if (hasAny(stripped, altKeys)) {
            const val = extractFieldValue(stripped);
            if (val) altLines.push({ i, val, currentSection });
        }
    });

    const imgTypeKeywords = {
        Feature: 'feature',
        Step: 'step',
        '场景': 'usecase',
        '鍦烘櫙': 'usecase',
        '工具': 'tool_icon',
        '宸ュ叿': 'tool_icon',
        'Hero 图片': 'hero',
        'Hero 鍥剧墖': 'hero',
        '背景图': 'bottom_cta',
        '鑳屾櫙鍥?': 'bottom_cta'
    };

    altLines.forEach(({ i, val, currentSection }) => {
        let matchedUrl = '';
        for (let lookback = 1; lookback <= 10; lookback++) {
            if (urlLines[i - lookback]) {
                matchedUrl = urlLines[i - lookback];
                break;
            }
        }

        let imgType = 'generic';
        for (const [kw, type] of Object.entries(imgTypeKeywords)) {
            if (currentSection.includes(kw) || val.includes(kw)) {
                imgType = type;
                break;
            }
        }

        entries.push({
            type: imgType,
            alt: val,
            currentUrl: matchedUrl,
            altLine: i,
            section: currentSection
        });
    });

    return entries;
}

function getContextForAlt(mdText, altLine) {
    const lines = mdText.split('\n');
    for (let i = altLine - 1; i >= Math.max(0, altLine - 10); i--) {
        const line = lines[i].trim();
        if (line.includes('描述') || line.includes('鎻忚堪')) return extractFieldValue(line);
    }
    return '';
}

export async function runStep2(projectId) {
    try {
        seoLandingService.updateProjectStatus(projectId, 'step2', { status: 'in_progress' });
        const project = seoLandingService.getProject(projectId);
        const mdFilename = project.steps.step1.file;
        const projectDir = path.resolve('data/seo-projects', projectId);
        const mdPath = path.join(projectDir, mdFilename);
        let mdText = fs.readFileSync(mdPath, 'utf8');

        mdText = mdText.replace(/\\n/g, '\n');

        const entries = parseMarkdownEntries(mdText);

        entries.forEach((entry, index) => {
            entry.context = getContextForAlt(mdText, entry.altLine);
            entry.finalUrl = IMG_BASE_URL + slugify(entry.alt, `${entry.type}-${index + 1}`) + '.webp';
        });

        const placeholderRe = /https:\/\/www\.hitpaw\.com\/images\/(placeholder(?:[-\w]+|)\.png|icon-\d+\.png|bottom-banner\.png)/;
        const processedAltLines = new Set();
        const resultLines = [];

        const mdLines = mdText.split('\n');
        mdLines.forEach((line, idx) => {
            const match = line.match(placeholderRe);
            if (match) {
                const oldUrl = match[0];
                let bestEntry = null;
                let bestDist = 999;

                for (const entry of entries) {
                    if (processedAltLines.has(entry.altLine)) continue;
                    const dist = entry.altLine - idx;
                    if (dist > 0 && dist < bestDist) {
                        bestDist = dist;
                        bestEntry = entry;
                    }
                }
                if (!bestEntry) {
                    bestEntry = entries.find(entry => !processedAltLines.has(entry.altLine));
                }
                if (bestEntry) {
                    line = line.replace(oldUrl, bestEntry.finalUrl);
                    processedAltLines.add(bestEntry.altLine);
                }
            }
            resultLines.push(line);
        });

        const mdFinal = resultLines.join('\n');
        fs.writeFileSync(path.join(projectDir, `content-${projectId}-final.md`), mdFinal, 'utf8');

        const typeHints = {
            hero: 'a wide-angle hero banner with a person interacting with the product, cinematic feel',
            feature: 'a split-screen or before/after comparison showing the feature effect',
            step: 'a clean UI screenshot showing the step in the workflow',
            usecase: 'a lifestyle scene showing real people enjoying the use case',
            bottom_cta: 'an inspiring, motivational background for a CTA section',
            generic: 'a professional product screenshot or lifestyle image'
        };

        const imagesData = [];
        let aiCount = 0;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const altSlug = slugify(entry.alt, `${entry.type}-${i + 1}`);

            if (entry.type === 'tool_icon') {
                imagesData.push({
                    index: i + 1,
                    type: entry.type,
                    alt: entry.alt,
                    alt_slug: altSlug,
                    url: `${IMG_BASE_URL}${altSlug}.webp`,
                    context: entry.context,
                    prompt: null,
                    source: 'tool_icons.json'
                });
            } else {
                const typeHint = typeHints[entry.type] || typeHints.generic;
                const promptText = `You are generating an AI image prompt for an SEO landing page. Keep it under 50 words.
Product keyword: ${project.keyword}
Image type: ${entry.type}
Style guidance: ${typeHint}
Image title (alt): "${entry.alt}"
Description context: "${entry.context}"
Do NOT include text, logos, or UI elements unless it's a step screenshot.`;

                const generated = await callLLM(promptText, { maxTokens: 150 });

                imagesData.push({
                    index: i + 1,
                    type: entry.type,
                    alt: entry.alt,
                    alt_slug: altSlug,
                    url: entry.finalUrl,
                    context: entry.context,
                    prompt: generated ? generated.trim() : `${entry.alt}, professional image, cinematic, 4K`
                });
                aiCount++;
            }
        }

        const jsonFile = 'image_prompts.json';
        fs.writeFileSync(path.join(projectDir, jsonFile), JSON.stringify({
            meta: { generatedAt: Date.now(), totalImages: imagesData.length, aiGenerated: aiCount },
            images: imagesData
        }, null, 2), 'utf8');

        seoLandingService.updateProjectStatus(projectId, 'step2', {
            status: 'step2_done',
            stepData: { status: 'completed', file: jsonFile, totalImages: imagesData.length }
        });

        return { file: jsonFile };
    } catch (error) {
        seoLandingService.updateProjectStatus(projectId, 'step2', { status: 'failed', stepData: { error: error.message } });
        throw error;
    }
}

export function skipStep2(projectId) {
    seoLandingService.updateProjectStatus(projectId, 'step2', { status: 'in_progress' });
    try {
        const project = seoLandingService.getProject(projectId);
        const mdFilename = project.steps.step1?.file;
        if (!mdFilename) {
            throw new Error('Project step 1 file missing. Run Step 1 first.');
        }

        const projectDir = path.resolve('data/seo-projects', projectId);
        const sourcePath = path.join(projectDir, mdFilename);
        if (!fs.existsSync(sourcePath)) {
            throw new Error('Markdown file not found. Run Step 1 first.');
        }

        const finalFile = `content-${projectId}-final.md`;
        fs.copyFileSync(sourcePath, path.join(projectDir, finalFile));

        seoLandingService.updateProjectStatus(projectId, 'step2', {
            status: 'step2_done',
            stepData: {
                status: 'skipped',
                file: null,
                finalFile,
                totalImages: 0
            }
        });

        return { skipped: true, finalFile };
    } catch (error) {
        seoLandingService.updateProjectStatus(projectId, 'step2', { status: 'failed', stepData: { error: error.message } });
        throw error;
    }
}
