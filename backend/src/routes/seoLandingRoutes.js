import express from 'express';
import * as seoLandingService from '../services/seoLandingService.js';
import * as seoContentGenerator from '../services/seoContentGenerator.js';
import * as seoPromptGenerator from '../services/seoPromptGenerator.js';
import * as seoImageGenerator from '../services/seoImageGenerator.js';
import * as seoTemplateFiller from '../services/seoTemplateFiller.js';
import { listTemplates } from '../services/seoTemplateRegistry.js';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const router = express.Router();

// List valid projects
router.get('/projects', (req, res) => {
    try {
        const projects = seoLandingService.listProjects();
        res.json({ ok: true, projects });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

router.get('/templates', (req, res) => {
    try {
        res.json({ ok: true, templates: listTemplates() });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// List files in project folder
router.get('/projects/:id/files', (req, res) => {
    try {
        const { id } = req.params;
        const projectDir = path.resolve('data/seo-projects', id);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ ok: false, message: 'Project folder not found' });
        }

        const files = fs.readdirSync(projectDir).map(file => {
            const filePath = path.join(projectDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                isDirectory: stats.isDirectory(),
                updatedAt: stats.mtime
            };
        });

        res.json({ ok: true, files });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Create a new project
router.post('/projects', (req, res) => {
    try {
        const { keyword, templateId } = req.body;
        if (!keyword) {
            return res.status(400).json({ ok: false, message: 'Keyword is required' });
        }
        const project = seoLandingService.createProject(keyword, templateId);
        res.json({ ok: true, project });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Get a specific project state
router.get('/projects/:id', (req, res) => {
    try {
        const project = seoLandingService.getProject(req.params.id);
        res.json({ ok: true, project });
    } catch (error) {
        res.status(404).json({ ok: false, message: error.message });
    }
});

// Step 1: Generate Content
router.post('/projects/:id/step1-content', async (req, res) => {
    try {
        const result = await seoContentGenerator.runStep1(req.params.id);
        res.json({ ok: true, message: 'Step 1 complete', data: result });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Step 2: Generate Prompts
router.post('/projects/:id/step2-prompts', async (req, res) => {
    try {
        const result = await seoPromptGenerator.runStep2(req.params.id);
        res.json({ ok: true, message: 'Step 2 complete', data: result });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

router.post('/projects/:id/step2-skip', (req, res) => {
    try {
        const result = seoPromptGenerator.skipStep2(req.params.id);
        res.json({ ok: true, message: 'Step 2 skipped', data: result });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Step 3: Generate Images
router.post('/projects/:id/step3-images', async (req, res) => {
    try {
        const result = await seoImageGenerator.runStep3(req.params.id);
        res.json({ ok: true, message: 'Step 3 complete', data: result });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

router.post('/projects/:id/step3-skip', (req, res) => {
    try {
        const result = seoImageGenerator.skipStep3(req.params.id);
        res.json({ ok: true, message: 'Step 3 skipped', data: result });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Step 4: Fill Template
router.post('/projects/:id/step4-template', async (req, res) => {
    try {
        const result = await seoTemplateFiller.runStep4(req.params.id);
        res.json({ ok: true, message: 'Step 4 complete', data: result });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Get Step 1 Content
router.get('/projects/:id/content', (req, res) => {
    try {
        const project = seoLandingService.getProject(req.params.id);
        if (!project.steps.step1 || !project.steps.step1.file) {
            return res.json({ ok: true, content: '' });
        }
        const fileName = project.steps.step1.file;
        const filePath = path.resolve('data/seo-projects', req.params.id, fileName);
        if (!fs.existsSync(filePath)) {
            return res.json({ ok: true, content: '' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ ok: true, content });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Update Step 1 Content
router.put('/projects/:id/content', (req, res) => {
    try {
        const { content } = req.body;
        const project = seoLandingService.getProject(req.params.id);
        if (!project.steps.step1 || !project.steps.step1.file) {
            throw new Error('Project step 1 file missing. Run Step 1 first.');
        }
        const fileName = project.steps.step1.file;
        const filePath = path.resolve('data/seo-projects', req.params.id, fileName);
        fs.writeFileSync(filePath, content, 'utf8');
        res.json({ ok: true, message: 'Content saved successfully' });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

router.get('/projects/:id/outputs', (req, res) => {
    try {
        const { id } = req.params;
        const projectDir = path.resolve('data/seo-projects', id);
        if (!fs.existsSync(projectDir)) {
            return res.status(404).json({ ok: false, message: 'Project folder not found' });
        }

        const outputFiles = [
            { key: 'html', label: 'HTML', file: `fill-${id}.html`, language: 'html' },
            { key: 'jsonld', label: 'JSON-LD', file: `fill-${id}.jsonld.json`, language: 'json' },
            { key: 'faq', label: 'FAQ JSON', file: `fill-${id}.faq.json`, language: 'json' },
            { key: 'meta', label: 'SEO Meta', file: `fill-${id}.seo-meta.json`, language: 'json' }
        ];

        const outputs = outputFiles.map(item => {
            const filePath = path.join(projectDir, item.file);
            return {
                ...item,
                exists: fs.existsSync(filePath),
                content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
            };
        });

        res.json({ ok: true, outputs });
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

// Download ZIP
router.get('/projects/:id/download', (req, res) => {
    try {
        const project = seoLandingService.getProject(req.params.id);
        const projectDir = path.resolve('data/seo-projects', req.params.id);
        const packageName = project.steps?.step4?.package || `package-${req.params.id}.zip`;
        const packagePath = path.join(projectDir, packageName);

        if (!fs.existsSync(packagePath)) {
            return res.status(404).json({ ok: false, message: 'Package not found. Run Step 4 first.' });
        }

        return res.download(packagePath, packageName);
    } catch (error) {
        res.status(500).json({ ok: false, message: error.message });
    }
});

export default router;
