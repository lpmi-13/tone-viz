#!/usr/bin/env python3
"""Generate static Thai lesson audio with edge-tts.

Install dependency:
  python3 -m pip install --user edge-tts

Examples:
  python3 scripts/generate_edge_tts.py
  python3 scripts/generate_edge_tts.py --force
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "audio" / "generated"
DEFAULT_VOICES = [
    "th-TH-PremwadeeNeural",
    "th-TH-NiwatNeural",
]
WORD_VARIANTS = {
    "natural": {"rate": "+0%", "pitch": "+0Hz", "suffix": "natural"},
    "exaggerated": {"rate": "-30%", "pitch": "+0Hz", "suffix": "slow"},
}
PHRASE_VARIANTS = {
    "phrase": {"rate": "+0%", "pitch": "+0Hz", "suffix": "phrase"},
    "phraseSlow": {"rate": "-20%", "pitch": "+0Hz", "suffix": "phrase-slow"},
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate static Thai lesson audio with edge-tts.")
    parser.add_argument("--items", type=Path, help="Optional JSON item list. Defaults to data.js quiz lesson variants.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--voice", action="append", help="Voice name. Can be repeated.")
    parser.add_argument("--include-phrases", action="store_true", help="Also generate context-phrase samples.")
    parser.add_argument("--from-lesson-data", action="store_true", help="Generate items from data.js quiz lesson variants. This is the default when --items is omitted.")
    parser.add_argument("--force", action="store_true", help="Regenerate files that already exist.")
    args = parser.parse_args()

    try:
        import edge_tts
    except ImportError:
        print("edge-tts is not installed. Run: python3 -m pip install --user edge-tts", file=sys.stderr)
        return 2

    voices = args.voice
    if not voices:
        voices = DEFAULT_VOICES

    use_lesson_data = args.from_lesson_data or not args.items
    items = load_lesson_items_from_data_js() if use_lesson_data else json.loads(args.items.read_text(encoding="utf-8"))
    include_phrases = args.include_phrases or use_lesson_data
    asyncio.run(generate_all(edge_tts, items, voices, args.output, include_phrases, args.force))
    return 0


def load_lesson_items_from_data_js() -> list[dict]:
    script = """
      import { quizLessons } from "./data.js";
      const items = quizLessons.map((lesson) => ({
        id: lesson.phraseVariantId || lesson.id.replace(/[^a-zA-Z0-9_-]+/g, "-"),
        thai: lesson.thai,
        translation: lesson.translation,
        tone: lesson.tone,
        expectedContour: lesson.toneLabelEnglish,
        contextThai: lesson.contextThai
          ? `${lesson.contextThai.before || ""}${lesson.contextThai.target || ""}${lesson.contextThai.after || ""}`
          : lesson.thai,
        contextTranslation: lesson.contextTranslation || "",
        audio: lesson.audio || {}
      }));
      process.stdout.write(JSON.stringify(items));
    """
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


async def generate_all(edge_tts, items, voices, output_root: Path, include_phrases: bool, force: bool) -> None:
    for voice in voices:
        voice_dir = output_root / slugify_voice(voice)
        voice_dir.mkdir(parents=True, exist_ok=True)
        for item in items:
            for variant, settings in WORD_VARIANTS.items():
                await synthesize(edge_tts, item["thai"], voice, settings, output_path_for(item, voice_dir, variant, settings["suffix"]), force)

            if include_phrases:
                for variant, settings in PHRASE_VARIANTS.items():
                    await synthesize(edge_tts, item["contextThai"], voice, settings, output_path_for(item, voice_dir, variant, settings["suffix"]), force)


def output_path_for(item: dict, voice_dir: Path, variant: str, fallback_suffix: str) -> Path:
    src = item.get("audio", {}).get(variant)
    if isinstance(src, str) and src:
        return voice_dir / Path(src).name

    return voice_dir / f"{item['id']}-{fallback_suffix}.mp3"


async def synthesize(edge_tts, text: str, voice: str, settings: dict, output_path: Path, force: bool) -> None:
    if output_path.exists() and not force:
        print(f"skip {output_path}")
        return

    print(f"write {output_path}")
    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=settings["rate"],
        pitch=settings["pitch"],
    )
    await communicate.save(str(output_path))


def slugify_voice(voice: str) -> str:
    slug = voice.replace("Neural", "")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", slug).strip("-")
    return slug.lower()


if __name__ == "__main__":
    raise SystemExit(main())
