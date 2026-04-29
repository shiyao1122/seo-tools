import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { config } from '../config.js';
import { getSettings } from './settingsService.js';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function resolveSchemaNode(node, rootSchema) {
  if (!node?.$ref) {
    return node;
  }

  const ref = node.$ref;
  if (!ref.startsWith('#/')) {
    throw new Error(`Unsupported schema reference: ${ref}`);
  }

  const segments = ref.slice(2).split('/');
  let current = rootSchema;
  for (const segment of segments) {
    current = current?.[segment];
  }

  if (!current) {
    throw new Error(`Schema reference not found: ${ref}`);
  }

  return {
    ...current,
    title: node.title || current.title,
    description: node.description || current.description
  };
}

function buildLabel(key, node) {
  return node.title || key.replace(/_/g, ' ');
}

function getPrimitiveType(node) {
  if (node.enum) {
    return 'enum';
  }
  if (node.type === 'string') {
    return node.format === 'uri' ? 'url' : 'string';
  }
  return node.type || 'string';
}

function createEmptyValue(node, rootSchema) {
  const resolved = resolveSchemaNode(node, rootSchema);

  if (resolved.type === 'object' || resolved.properties) {
    const value = {};
    for (const [key, childNode] of Object.entries(resolved.properties || {})) {
      value[key] = createEmptyValue(childNode, rootSchema);
    }
    return value;
  }

  if (resolved.type === 'array') {
    return [];
  }

  if (resolved.default !== undefined) {
    return resolved.default;
  }

  if (resolved.type === 'boolean') {
    return false;
  }

  if (resolved.type === 'number' || resolved.type === 'integer') {
    return '';
  }

  return '';
}

function buildFieldConfig(key, node, rootSchema, required = false, pathParts = []) {
  const resolved = resolveSchemaNode(node, rootSchema);
  const nextPath = [...pathParts, key];

  if (resolved.type === 'object' || resolved.properties) {
    const requiredSet = new Set(resolved.required || []);
    return {
      key,
      label: buildLabel(key, resolved),
      description: resolved.description || '',
      required,
      path: nextPath.join('.'),
      type: 'object',
      fields: Object.entries(resolved.properties || {}).map(([childKey, childNode]) => (
        buildFieldConfig(childKey, childNode, rootSchema, requiredSet.has(childKey), nextPath)
      ))
    };
  }

  return {
    key,
    label: buildLabel(key, resolved),
    description: resolved.description || '',
    required,
    path: nextPath.join('.'),
    type: getPrimitiveType(resolved),
    enum: resolved.enum || null,
    defaultValue: resolved.default ?? '',
    format: resolved.format || '',
    example: resolved.examples?.[0] || ''
  };
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\r\n/g, '\n').trim();
}

function sanitizeValue(node, inputValue, rootSchema, currentPath, errors, options = {}) {
  const resolved = resolveSchemaNode(node, rootSchema);
  const requiredSet = new Set(resolved.required || []);

  if (resolved.type === 'object' || resolved.properties) {
    const output = {};
    for (const [key, childNode] of Object.entries(resolved.properties || {})) {
      const childPath = [...currentPath, key];
      const childValue = inputValue?.[key];
      const autoValue = options.meta?.[childPath.join('.')];
      const nextInputValue = autoValue !== undefined && (childValue === undefined || childValue === '')
        ? autoValue
        : childValue;
      output[key] = sanitizeValue(childNode, nextInputValue, rootSchema, childPath, errors, options);
    }
    return output;
  }

  if (resolved.type === 'array') {
    return Array.isArray(inputValue) ? inputValue : [];
  }

  let value = inputValue;
  if (value === undefined || value === null) {
    value = resolved.default ?? '';
  }

  if (typeof value === 'string') {
    value = value.replace(/\r\n/g, '\n');
  }

  const pathText = currentPath.join('.');
  const isRequired = requiredSet.size === 0 ? options.requiredPaths?.has(pathText) : false;
  const shouldValidate = options.requiredPaths?.has(pathText) || isRequired;
  if (shouldValidate && (value === '' || value === undefined || value === null)) {
    errors.push(`${pathText} is required`);
  }

  return value;
}

function collectRequiredPaths(node, rootSchema, pathParts = [], requiredPaths = new Set(), required = false) {
  const resolved = resolveSchemaNode(node, rootSchema);
  const pathText = pathParts.join('.');

  if (!(resolved.type === 'object' || resolved.properties) && required && pathText) {
    requiredPaths.add(pathText);
  }

  if (resolved.type === 'object' || resolved.properties) {
    const requiredSet = new Set(resolved.required || []);
    for (const [key, childNode] of Object.entries(resolved.properties || {})) {
      collectRequiredPaths(childNode, rootSchema, [...pathParts, key], requiredPaths, requiredSet.has(key));
    }
  }

  return requiredPaths;
}

function extractJsonFromText(text) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const raw = fencedMatch ? fencedMatch[1] : text;
  return JSON.parse(raw.trim());
}

async function readImportedFile(filePath, originalName) {
  const extension = path.extname(originalName).toLowerCase();

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return normalizeString(result.value || '');
  }

  if (['.md', '.markdown', '.txt'].includes(extension)) {
    return normalizeString(readTextFile(filePath));
  }

  throw new Error('Unsupported file type. Please upload .docx, .md, .markdown, or .txt');
}

async function callGeminiToFillSchema(sourceText, schema, templateText) {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || config.geminiApiKey;

  if (!apiKey) {
    throw new Error('Gemini API Key is not configured');
  }

  const prompt = [
    'You convert landing page content into a JSON object that matches the provided schema exactly.',
    'Return JSON only. Do not wrap it in markdown fences.',
    'Preserve the full object structure and all known fields from the schema, even if some optional string fields stay empty.',
    'Use the markdown template as a semantic guide for how the source content maps into fields.',
    'If a field is unknown, return an empty string for leaf string fields.',
    '',
    'Schema:',
    JSON.stringify(schema, null, 2),
    '',
    'Reference markdown template:',
    templateText,
    '',
    'Source content:',
    sourceText
  ].join('\n');

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });
  } catch (error) {
    const causeCode = error?.cause?.code || '';
    const causeMessage = error?.cause?.message || '';
    if (causeCode === 'UND_ERR_CONNECT_TIMEOUT') {
      throw new Error(`Gemini network request timed out. Current proxy is unreachable: ${causeMessage || 'proxy connect timeout'}`);
    }
    throw new Error(`Gemini request failed: ${causeMessage || error.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';

  if (!text.trim()) {
    throw new Error('Gemini returned an empty response');
  }

  return extractJsonFromText(text);
}

export function getTemplateSchemaBundle() {
  const schema = readJsonFile(config.contentSchemaFile);
  const templateText = readTextFile(config.contentFillTemplateFile);
  const requiredSet = new Set(schema.required || []);

  return {
    schema,
    templateText,
    formConfig: Object.entries(schema.properties || {}).map(([key, node]) => (
      buildFieldConfig(key, node, schema, requiredSet.has(key))
    )),
    initialData: createEmptyValue(schema, schema)
  };
}

function normalizeTemplateSchemaData(formData = {}, { validateRequired = true } = {}) {
  const { schema } = getTemplateSchemaBundle();
  const errors = [];
  const requiredPaths = validateRequired ? collectRequiredPaths(schema, schema) : new Set();
  const today = new Date().toISOString().slice(0, 10);
  const pageName = normalizeString(formData?._meta?.page_name || '');

  const data = sanitizeValue(schema, formData, schema, [], errors, {
    requiredPaths,
    meta: {
      '_meta.page_name': pageName,
      '_meta.template_version': schema.version || '1.0.0',
      '_meta.generated_at': today
    }
  });

  if (validateRequired && errors.length > 0) {
    const error = new Error('Please complete all required fields before generating JSON');
    error.details = errors;
    throw error;
  }

  return data;
}

export function generateTemplateSchemaJson(formData = {}) {
  return normalizeTemplateSchemaData(formData, { validateRequired: true });
}

export async function importTemplateSchemaContent({ text = '', filePath = '', originalName = '' } = {}) {
  const { schema, templateText } = getTemplateSchemaBundle();
  const sourceText = filePath ? await readImportedFile(filePath, originalName) : normalizeString(text);

  if (!sourceText) {
    throw new Error('No import content provided');
  }

  const llmOutput = await callGeminiToFillSchema(sourceText, schema, templateText);
  return normalizeTemplateSchemaData(llmOutput, { validateRequired: false });
}
