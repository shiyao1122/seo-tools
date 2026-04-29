import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DB_PATH = path.resolve(__dirname, '../../data/tools-db.json');

export function loadToolsDb() {
    if (!fs.existsSync(TOOLS_DB_PATH)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(TOOLS_DB_PATH, 'utf8');
        const tools = JSON.parse(raw);

        if (!Array.isArray(tools)) {
            return [];
        }

        return tools
            .map(tool => ({
                name: tool.name || '',
                url: tool.url || '',
                imgUrl: tool.imgUrl || '',
                imgAlt: tool.imgAlt || tool.name || '',
                desc: tool.desc || ''
            }))
            .filter(tool => tool.name && tool.url);
    } catch (error) {
        console.warn(`Failed to load tools-db.json: ${error.message}`);
        return [];
    }
}
