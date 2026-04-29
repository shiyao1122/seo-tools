import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(rootDir, '.env') });

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'replace-with-a-long-random-string',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '123456',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  minimaxApiKey: process.env.MINIMAX_API_KEY || '',
  serpapiKey: process.env.SERPAPI_KEY || '',
  defaultLlmProvider: process.env.DEFAULT_LLM_PROVIDER || 'gemini',
  defaultLlmModel: process.env.DEFAULT_LLM_MODEL || '',
  httpProxy: process.env.HTTP_PROXY || process.env.http_proxy || '',
  httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || '',
  noProxy: process.env.NO_PROXY || process.env.no_proxy || '',
  googleApiTimeoutMs: Number(process.env.GOOGLE_API_TIMEOUT_MS || 30000),
  dataFile: path.join(rootDir, 'data', 'db.json'),
  uploadsDir: path.join(rootDir, 'uploads'),
  processedDir: path.join(rootDir, 'uploads', 'processed'),
  templateFile: path.join(rootDir, 'test.xlsx'),
  contentSchemaFile: path.resolve(rootDir, '..', 'content_schema.json'),
  contentFillTemplateFile: path.resolve(rootDir, '..', 'content_fill_template.md')
};
