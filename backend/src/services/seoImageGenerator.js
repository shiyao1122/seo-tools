import fs from 'fs';
import path from 'path';
import { fetch, getGlobalDispatcher } from 'undici';
import * as seoLandingService from './seoLandingService.js';

async function generateImageOpenAI(prompt, apiKey) {
    const url = 'https://api.openai.com/v1/images/generations';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024'
        }),
        dispatcher: getGlobalDispatcher()
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI Image API Error: ${text}`);
    }
    const data = await response.json();
    return data.data[0].url;
}

export async function runStep3(projectId) {
    seoLandingService.updateProjectStatus(projectId, 'step3', { status: 'in_progress' });
    const project = seoLandingService.getProject(projectId);
    const projectDir = path.resolve('data/seo-projects', projectId);
    const jsonPath = path.join(projectDir, 'image_prompts.json');

    if (!fs.existsSync(jsonPath)) {
        throw new Error('image_prompts.json not found in project. Step 2 may have failed.');
    }

    const promptsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is missing. Currently using OpenAI for DALL-E 3 image generation.');
    }

    const generatedImages = [];
    try {
        for (const img of promptsData.images || []) {
            if (img.type === 'tool_icon') {
                // Skip tool plugins since they pull from CDN natively
                generatedImages.push({ ...img, generationStatus: 'skipped' });
                continue;
            }

            let imageUrl;
            try {
                console.log(`Generating image for prompt: ${img.prompt.substring(0, 50)}...`);
                imageUrl = await generateImageOpenAI(img.prompt, apiKey);

                // Download image to local project directory
                const imgOutput = path.join(projectDir, `${img.alt_slug}.webp`);
                const imgResponse = await fetch(imageUrl, { dispatcher: getGlobalDispatcher() });
                const buffer = await imgResponse.arrayBuffer();
                fs.writeFileSync(imgOutput, Buffer.from(buffer));

                generatedImages.push({ ...img, localPath: `${img.alt_slug}.webp`, generationStatus: 'success' });
            } catch (err) {
                console.error(`Error generating image for ${img.alt_slug}: ${err.message}`);
                generatedImages.push({ ...img, generationStatus: 'failed', error: err.message });
            }
        }

        seoLandingService.updateProjectStatus(projectId, 'step3', {
            status: 'step3_done',
            stepData: { status: 'completed', images: generatedImages }
        });

        return { images: generatedImages };
    } catch (error) {
        seoLandingService.updateProjectStatus(projectId, 'step3', { status: 'failed', stepData: { error: error.message } });
        throw error;
    }
}

export function skipStep3(projectId) {
    const projectDir = path.resolve('data/seo-projects', projectId);
    const finalMdPath = path.join(projectDir, `content-${projectId}-final.md`);
    if (!fs.existsSync(finalMdPath)) {
        throw new Error('Final markdown file not found. Run or skip Step 2 before skipping Step 3.');
    }

    seoLandingService.updateProjectStatus(projectId, 'step3', {
        status: 'step3_done',
        stepData: {
            status: 'skipped',
            images: []
        }
    });

    return { skipped: true, images: [] };
}
