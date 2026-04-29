import { fetch, getGlobalDispatcher } from 'undici';
import fs from 'fs';
import path from 'path';
import { callLLM } from './llmClient.js';
import * as seoLandingService from './seoLandingService.js';
import { DEFAULT_TEMPLATE_ID, renderMarkdown } from './seoTemplateRegistry.js';

const EXCLUDE_DOMAINS = ['apps.apple.com', 'play.google.com', 'github.com', 'twitter.com', 'x.com', 'youtube.com', 'pinterest.com', 'reddit.com', 'wikipedia.org'];
const EXCLUDE_PATTERNS = ['upload', 'convert', 'compress', 'tools.apple', 'login', 'signup', 'signin', 'price', 'pricing'];

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
        return '';
    }
}

function stripJsonFence(text) {
    return (text || '').replace(/^\s*```(json)?|\s*```\s*$/gi, '').trim();
}

export async function runStep1(projectId) {
    const project = seoLandingService.getProject(projectId);
    const keyword = project.keyword;
    const templateId = project.templateId || DEFAULT_TEMPLATE_ID;

    seoLandingService.updateProjectStatus(projectId, 'step1', { status: 'in_progress' });

    try {
        const apiKey = process.env.SERPAPI_KEY;
        if (!apiKey) throw new Error('SERPAPI_KEY is missing');

        const searchUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&api_key=${apiKey}&engine=google&num=10`;
        const response = await fetch(searchUrl, { dispatcher: getGlobalDispatcher() });
        if (!response.ok) throw new Error('SerpAPI error');

        const data = await response.json();
        const organic = data.organic_results || [];
        const analyses = [];

        for (const item of organic) {
            if (!item.link) continue;
            const domain = extractDomain(item.link);
            if (EXCLUDE_DOMAINS.some(d => domain.includes(d))) continue;
            if (EXCLUDE_PATTERNS.some(p => item.link.toLowerCase().includes(p))) continue;

            analyses.push({
                url: item.link,
                title: item.title,
                snippet: item.snippet || ''
            });

            if (analyses.length >= 10) break;
        }

        const prompt = `
You are an SEO expert for HitPaw Online.
Create an SEO landing page content brief for the keyword: "${keyword}".

Here are the contexts from top ranking URLs:
${analyses.map((a, i) => `[${i + 1}] Title: ${a.title}\nSnippet: ${a.snippet}`).join('\n\n')}

Strictly output ONLY a JSON object (no markdown formatting, no code blocks) with the following structure:
{
  "h1": "Main H1 title",
  "subtitle": "Subtitle description",
  "steps": [{"title": "Step title", "description": "Step detail"}],
  "features": [{"title": "Feature title", "description": "Feature detail"}],
  "use_cases": [{"title": "UseCase title", "description": "UseCase detail"}],
  "faqs": [{"question": "FAQ Q", "answer": "FAQ A"}],
  "bottom_cta": {"h2": "CTA Title", "description": "CTA Desc", "button_text": "CTA Button"}
}
`;

        const briefRaw = stripJsonFence(await callLLM(prompt));
        let brief;
        try {
            brief = JSON.parse(briefRaw);
        } catch (e) {
            throw new Error('LLM output invalid JSON: ' + briefRaw);
        }

        const tools = [
            { name: 'AI Video Enhancer', url: 'https://online.hitpaw.com/online-video-enhancer.html' },
            { name: 'AI Cartoon Video', url: 'https://online.hitpaw.com/ai-cartoon-video.html' },
            { name: 'AI Photo Enhancer', url: 'https://online.hitpaw.com/ai-photo-enhancer.html' },
            { name: 'Online Video Effects', url: 'https://online.hitpaw.com/online-video-effects.html' }
        ];

        const markdownContent = renderMarkdown(templateId, brief, { keyword, tools });
        const mdFilename = `content-${projectId}.md`;
        const outPath = path.join(path.resolve('data/seo-projects'), projectId, mdFilename);
        fs.writeFileSync(outPath, markdownContent, 'utf8');

        seoLandingService.updateProjectStatus(projectId, 'step1', {
            status: 'step1_done',
            stepData: {
                status: 'completed',
                file: mdFilename,
                analysedPages: analyses.length,
                templateId
            }
        });

        return { mdFilename, templateId };
    } catch (error) {
        console.error('runStep1 failed:', error);
        let errorMsg = error.message;
        if (error.cause && error.cause.code === 'UND_ERR_CONNECT_TIMEOUT') {
            errorMsg = `Connection Timeout. Please check your proxy settings in .env! Detail: ${error.message}`;
        } else if (errorMsg === 'fetch failed') {
            errorMsg = `Network request failed (fetch failed). If you are in China, you MUST configure HTTP_PROXY/HTTPS_PROXY in .env and restart the server!`;
        }
        seoLandingService.updateProjectStatus(projectId, 'step1', { status: 'failed', stepData: { error: errorMsg } });
        throw new Error(errorMsg);
    }
}
