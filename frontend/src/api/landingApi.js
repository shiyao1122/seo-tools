import request from './client';

export function listProjects() {
    return request({
        url: '/landing/projects',
        method: 'get'
    });
}

export function createProject(data) {
    return request({
        url: '/landing/projects',
        method: 'post',
        data
    });
}

export function listTemplates() {
    return request({
        url: '/landing/templates',
        method: 'get'
    });
}

export function getProject(id) {
    return request({
        url: `/landing/projects/${id}`,
        method: 'get'
    });
}

export function runStep1(id) {
    return request({
        url: `/landing/projects/${id}/step1-content`,
        method: 'post'
    });
}

export function runStep2(id) {
    return request({
        url: `/landing/projects/${id}/step2-prompts`,
        method: 'post'
    });
}

export function skipStep2(id) {
    return request({
        url: `/landing/projects/${id}/step2-skip`,
        method: 'post'
    });
}

export function runStep3(id) {
    return request({
        url: `/landing/projects/${id}/step3-images`,
        method: 'post'
    });
}

export function skipStep3(id) {
    return request({
        url: `/landing/projects/${id}/step3-skip`,
        method: 'post'
    });
}

export function runStep4(id) {
    return request({
        url: `/landing/projects/${id}/step4-template`,
        method: 'post'
    });
}

// Ensure the download link is accessed straight from browser window
export function getDownloadUrl(id) {
    return `/api/landing/projects/${id}/download`;
}

export function getProjectContent(id) {
    return request({
        url: `/landing/projects/${id}/content`,
        method: 'get'
    });
}

export function updateProjectContent(id, content) {
    return request({
        url: `/landing/projects/${id}/content`,
        method: 'put',
        data: { content }
    });
}

export function getProjectFiles(id) {
    return request({
        url: `/landing/projects/${id}/files`,
        method: 'get'
    });
}

export function getProjectOutputs(id) {
    return request({
        url: `/landing/projects/${id}/outputs`,
        method: 'get'
    });
}
