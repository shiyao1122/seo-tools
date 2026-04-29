import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import * as seoLandingService from './seoLandingService.js';
import {
    DEFAULT_TEMPLATE_ID,
    buildJsonLd,
    buildSeoMeta,
    parseMarkdown,
    renderHtml
} from './seoTemplateRegistry.js';

function addFileIfExists(archive, filePath, name) {
    if (fs.existsSync(filePath)) {
        archive.file(filePath, { name });
    }
}

export async function runStep4(projectId) {
    seoLandingService.updateProjectStatus(projectId, 'step4', { status: 'in_progress' });
    const project = seoLandingService.getProject(projectId);
    const projectDir = path.resolve('data/seo-projects', projectId);
    const templateId = project.templateId || DEFAULT_TEMPLATE_ID;

    try {
        const mdPath = path.join(projectDir, `content-${projectId}-final.md`);
        if (!fs.existsSync(mdPath)) {
            throw new Error('Markdown file not found. Step 2 may have failed.');
        }

        const mdText = fs.readFileSync(mdPath, 'utf8');
        const parsedData = parseMarkdown(templateId, mdText);
        const html = renderHtml(templateId, parsedData);

        const htmlPath = path.join(projectDir, `fill-${projectId}.html`);
        const jsonLdPath = path.join(projectDir, `fill-${projectId}.jsonld.json`);
        const faqPath = path.join(projectDir, `fill-${projectId}.faq.json`);
        const metaPath = path.join(projectDir, `fill-${projectId}.seo-meta.json`);

        const jsonLd = buildJsonLd(parsedData);
        const seoMeta = buildSeoMeta(parsedData);

        fs.writeFileSync(htmlPath, html, 'utf8');
        fs.writeFileSync(jsonLdPath, JSON.stringify(jsonLd, null, 2), 'utf8');
        fs.writeFileSync(faqPath, JSON.stringify(jsonLd.FAQPage || {}, null, 2), 'utf8');
        fs.writeFileSync(metaPath, JSON.stringify(seoMeta, null, 2), 'utf8');

        const zipPath = path.join(projectDir, `package-${projectId}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        archive.file(htmlPath, { name: 'index.html' });
        archive.file(jsonLdPath, { name: 'index.jsonld.json' });
        archive.file(faqPath, { name: 'index.faq.json' });
        archive.file(metaPath, { name: 'index.seo-meta.json' });

        const files = fs.readdirSync(projectDir);
        files.forEach(file => {
            if (file.endsWith('.webp')) {
                addFileIfExists(archive, path.join(projectDir, file), `images/${file}`);
            }
        });

        await archive.finalize();

        seoLandingService.updateProjectStatus(projectId, 'step4', {
            status: 'completed',
            stepData: {
                status: 'completed',
                package: `package-${projectId}.zip`,
                templateId
            }
        });

        return { package: `package-${projectId}.zip`, templateId };
    } catch (error) {
        seoLandingService.updateProjectStatus(projectId, 'step4', { status: 'failed', stepData: { error: error.message } });
        throw error;
    }
}
