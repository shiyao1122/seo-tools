import fs from 'fs';
import path from 'path';
import { fetch, getGlobalDispatcher, ProxyAgent, setGlobalDispatcher } from 'undici';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

async function buildDb() {
    const htmlPath = path.resolve(rootDir, '..', 'seo-skills-package', 'tools.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html);

    const tools = [];

    // Parse main tools (.cell)
    $('.cell').each((i, el) => {
        const name = $(el).find('.h5').text().trim();
        const url = $(el).find('a').attr('href');
        const imgEl = $(el).find('picture img').first();
        const imgUrl = imgEl.attr('src') || imgEl.attr('data-src'); // support lozad
        const imgAlt = imgEl.attr('alt') || '';

        if (name && url) {
            tools.push({ name, url, imgUrl, imgAlt, type: 'main' });
        }
    });

    // Parse explore more tools (.card-list-center)
    $('.card-list-center').each((i, el) => {
        const name = $(el).find('.card-list-title').text().trim();
        const url = $(el).find('a').attr('href');

        if (name && url) {
            tools.push({ name, url, imgUrl: '', imgAlt: '', type: 'explore' });
        }
    });

    console.log(`Found ${tools.length} tools. Fetching meta descriptions...`);

    for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        console.log(`[${i + 1}/${tools.length}] Fetching ${tool.url}...`);
        try {
            const res = await fetch(tool.url, { dispatcher: getGlobalDispatcher() });
            if (!res.ok) {
                console.warn(`  HTTP ${res.status} for ${tool.url}`);
                continue;
            }
            const pageHtml = await res.text();
            const page$ = cheerio.load(pageHtml);
            const desc = page$('meta[name="description"]').attr('content') || '';
            tool.desc = desc.trim();

            if (!tool.imgUrl) {
                tool.imgUrl = page$('meta[property="og:image"]').attr('content') || '';
            }

            // Sleep a bit to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.error(`  Error fetching ${tool.url}: ${e.message}`);
        }
    }

    const outPath = path.join(rootDir, 'data', 'tools-db.json');
    fs.writeFileSync(outPath, JSON.stringify(tools, null, 2));
    console.log(`Saved ${tools.length} tools to ${outPath}`);
}

buildDb().catch(console.error);
