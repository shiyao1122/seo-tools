#!/usr/bin/env python3
"""
seo-image-generator 主脚本
读取 image_prompts.json，构建生成计划 manifest，
供 agent 层调用 image_generate 工具处理每个图片。
不直接调用 API，不存储 API keys。
"""

import json
import os
import sys
from pathlib import Path

def load_config(skills_dir: Path) -> dict:
    config_path = skills_dir / "config.json"
    with open(config_path) as f:
        return json.load(f)

def load_prompts(prompts_path: str) -> dict:
    with open(prompts_path) as f:
        return json.load(f)

PROVIDER_MODEL_MAP = {
    "openai": "openai/gpt-image-1",
    "minimax": "minimax/image-01",
    "google": "google/gemini-3.1-flash-image-preview",
}

PROVIDER_PRIORITY = ["openai", "minimax", "google"]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate_images.py <image_prompts.json> [--download-only]")
        sys.exit(1)

    prompts_path = Path(sys.argv[1]).resolve()
    skills_dir = Path(__file__).parent.parent
    output_dir = skills_dir / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)

    config = load_config(skills_dir)
    data = load_prompts(str(prompts_path))
    images = data.get("images", [])
    total = len(images)

    if total == 0:
        print("No images to generate.")
        sys.exit(0)

    meta = data.get("meta", {})
    primary_provider = config.get("providers", {}).get("primary", "openai")

    # 构建 manifest
    manifest = {
        "meta": {
            "source": str(prompts_path),
            "generated_at": meta.get("generated_at", ""),
            "total_images": total,
            "output_dir": str(output_dir),
            "primary_provider": primary_provider,
            "provider_chain": PROVIDER_PRIORITY,
        },
        "images": []
    }

    for i, img in enumerate(images, 1):
        alt_slug = img.get("alt_slug", f"image-{i}")
        prompt = img.get("prompt", "")
        img_type = img.get("type", "unknown")
        context = img.get("context", "")

        if not prompt:
            print(f"[WARNING] Image {i}/{total}: '{alt_slug}' has empty prompt, skipping.")
            continue

        output_filename = f"{alt_slug}.webp"
        output_path = output_dir / output_filename

        manifest["images"].append({
            "index": i,
            "total": total,
            "alt": img.get("alt", ""),
            "alt_slug": alt_slug,
            "type": img_type,
            "prompt": prompt,
            "context": context,
            "output_filename": output_filename,
            "output_path": str(output_path),
            "providers": PROVIDER_PRIORITY,
            "primary_model": PROVIDER_MODEL_MAP.get(primary_provider, "openai/gpt-image-1"),
        })

    # 输出 manifest
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\nManifest built: {manifest_path}")
    print(f"Total images: {total}")
    print(f"Output dir: {output_dir}")
    print(f"Primary provider: {primary_provider} ({PROVIDER_MODEL_MAP[primary_provider]})")
    print(f"\nImages to generate:")
    for img in manifest["images"]:
        print(f"  [{img['index']}/{img['total']}] {img['output_filename']} | {img['type']} | {img['primary_model']}")

    print(f"\n{'='*60}")
    print(f"AGENT INSTRUCTION:")
    print(f"Read {manifest_path}, then for each image in manifest['images']:")
    print(f"  1. Call image_generate(prompt=img['prompt'], model=img['primary_model'])")
    print(f"  2. Save returned image to img['output_path']")
    print(f"  3. If openai fails, try next provider in img['providers'] list")
    print(f"  4. Log result: [index/total] filename OK/FAIL")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
