import fs from 'fs';
import path from 'path';
import { createId, ensureDir } from '../utils.js';
import { DEFAULT_TEMPLATE_ID, getTemplate } from './seoTemplateRegistry.js';

const PROJECTS_DIR = path.resolve('data/seo-projects');

// Initialize the root projects directory
ensureDir(PROJECTS_DIR);

function getProjectDir(id) {
    return path.join(PROJECTS_DIR, id);
}

function getProjectStatePath(id) {
    return path.join(getProjectDir(id), 'project.json');
}

export function listProjects() {
    ensureDir(PROJECTS_DIR);
    const dirs = fs.readdirSync(PROJECTS_DIR);
    const projects = [];
    for (const dir of dirs) {
        const statePath = path.join(PROJECTS_DIR, dir, 'project.json');
        if (fs.existsSync(statePath)) {
            try {
                const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                projects.push(state);
            } catch (e) {
                // Skip invalid JSON
            }
        }
    }
    return projects.sort((a, b) => b.createdAt - a.createdAt);
}

export function getProject(id) {
    const statePath = getProjectStatePath(id);
    if (!fs.existsSync(statePath)) {
        throw new Error('Project not found');
    }
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

export function saveProjectState(id, state) {
    const statePath = getProjectStatePath(id);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

export function createProject(keyword, templateId = DEFAULT_TEMPLATE_ID) {
    const id = createId('proj');
    const projectDir = getProjectDir(id);
    ensureDir(projectDir);
    const template = getTemplate(templateId || DEFAULT_TEMPLATE_ID);

    const state = {
        id,
        keyword,
        templateId: template.id,
        templateVersion: template.version,
        createdAt: Date.now(),
        status: 'created', // created, step1_done, step2_done, step3_done, completed
        steps: {
            step1: { status: 'pending', file: `content-${id}.md` },
            step2: { status: 'pending', file: `image_prompts.json` },
            step3: { status: 'pending', images: [] },
            step4: { status: 'pending', files: [] }
        }
    };

    saveProjectState(id, state);
    return state;
}

export function updateProjectStatus(id, step, updateProps) {
    const state = getProject(id);
    if (updateProps && updateProps.status) {
        state.status = updateProps.status; // Global status update
    }
    if (step) {
        state.steps[step] = { ...state.steps[step], ...updateProps.stepData };
    }
    saveProjectState(id, state);
    return state;
}
