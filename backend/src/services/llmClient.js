import { fetch, getGlobalDispatcher } from 'undici';

export async function callLLM(prompt, options = {}) {
    const provider = options.provider || process.env.DEFAULT_LLM_PROVIDER || 'gemini';
    const maxTokens = options.maxTokens || 8192;

    if (provider === 'gemini') {
        return _callGemini(prompt, maxTokens);
    } else if (provider === 'openai') {
        return _callOpenAI(prompt, maxTokens);
    } else if (provider === 'minimax') {
        return _callMiniMax(prompt, maxTokens);
    } else {
        throw new Error('Unknown LLM provider: ' + provider);
    }
}

async function _callGemini(prompt, maxTokens) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

    const model = process.env.DEFAULT_LLM_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        dispatcher: getGlobalDispatcher()
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${err}`);
    }

    const data = await response.json();
    try {
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        return null;
    }
}

async function _callOpenAI(prompt, maxTokens) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
        model: process.env.DEFAULT_LLM_MODEL || 'gpt-4o',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        dispatcher: getGlobalDispatcher()
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API Error: ${err}`);
    }

    const data = await response.json();
    try {
        return data.choices[0].message.content;
    } catch (e) {
        return null;
    }
}

async function _callMiniMax(prompt, maxTokens) {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY is missing');

    const url = 'https://api.minimaxi.com/anthropic/v1/messages';
    const payload = {
        model: process.env.DEFAULT_LLM_MODEL || 'MiniMax-M2.7',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload),
        dispatcher: getGlobalDispatcher()
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`MiniMax API Error: ${err}`);
    }

    const data = await response.json();
    try {
        for (const item of data.content || []) {
            if (item.type === 'text') {
                return item.text;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}
