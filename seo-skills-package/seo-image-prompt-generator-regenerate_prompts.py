#!/usr/bin/env python3
import json, urllib.request, urllib.error, time

config = {
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "api_key": "AIzaSyANwIQQyKtcqZY1vtengF8I2vPYfPeOKn8",
    "max_tokens": 1024
}

def call_gemini(prompt_text, api_key, model, max_tokens):
    url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + api_key
    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": prompt_text}]}], "generationConfig": {"maxOutputTokens": max_tokens}}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
        return data["candidates"][0]["content"]["parts"][0]["text"]

type_hints = {
    "hero":      "a wide-angle hero banner with a person interacting with the product, cinematic feel",
    "feature":   "a split-screen or before/after comparison showing the feature effect",
    "step":      "a clean UI screenshot showing the step in the workflow",
    "usecase":   "a lifestyle scene showing real people enjoying the use case",
    "tool_icon": "a clean flat tool icon, simple and recognizable",
    "bottom_cta":"an inspiring, motivational background for a CTA section",
    "generic":   "a professional product screenshot or lifestyle image",
}

PROMPT_TEMPLATE = """You are generating an AI image prompt for an SEO landing page.

Product: HitPaw AI Photo Enhancer
Image type: {img_type}
Style guidance: {type_hint}

Image title (alt): "{alt}"
Description context: "{context}"

Generate a vivid, specific image prompt that:
1. Captures the visual essence of the title and description
2. If "transform" or "before/after" is implied, show a split-screen comparison
3. If it is a feature, show the effect visually (not a diagram)
4. If it is a use case, show a realistic lifestyle scene with people
5. End with: cinematic, photorealistic, 4K (or: bright, clean product shot)
6. Do NOT include text, logos, or UI elements unless it is a step screenshot
7. Be specific about subjects, setting, mood, and lighting

Output ONLY the prompt text, nothing else."""

json_path = "projects/seo-toolkit/skills/seo-image-prompt-generator/outputs/content-ai-photo-enhancer-image-prompts.json"
with open(json_path) as f:
    data = json.load(f)

entries = data["images"]
print("Regenerating " + str(len(entries)) + " prompts with max_tokens=512...")

for i, entry in enumerate(entries):
    alt = entry["alt"]
    img_type = entry["type"]
    context = entry.get("context", "")
    type_hint = type_hints.get(img_type, type_hints["generic"])

    prompt_text = PROMPT_TEMPLATE.format(img_type=img_type, type_hint=type_hint, alt=alt, context=context)
    result = call_gemini(prompt_text, config["api_key"], config["model"], 512)
    result = result.strip().strip('"').strip("'").strip("```")
    entry["prompt"] = result
    print("  [" + str(i+1).zfill(2) + "/" + str(len(entries)) + "] " + img_type.ljust(12) + " | " + alt[:40])
    print("       -> " + result[:100])
    time.sleep(0.3)

with open(json_path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("\nDone. JSON updated at: " + json_path)
