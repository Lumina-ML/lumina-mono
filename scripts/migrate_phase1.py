#!/usr/bin/env python3
"""
Phase 1 brand migration: wandb -> lumina

Rules:
- Rename package directory from wandb/ to lumina/
- Update import statements
- Update __module__ / __package__ metadata
- Update pyproject.toml and README
- DO NOT touch: WANDB_* env vars, API URLs, protobuf names, internal protocol constants
"""

import os
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
SDK_DIR = ROOT / "python" / "lumina" / "lumina" / "lumina"


def iter_source_files():
    for path in SDK_DIR.rglob("*"):
        if path.is_file():
            # Skip binary files and caches
            if path.suffix in {".pyc", ".pyo", ".so", ".dylib", ".dll"}:
                continue
            if "__pycache__" in path.parts:
                continue
            yield path


def is_text_file(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(1024)
            if b"\x00" in chunk:
                return False
            # Try decode as utf-8
            chunk.decode("utf-8")
        return True
    except Exception:
        return False


def replace_imports(content: str) -> str:
    # import wandb -> import lumina
    content = re.sub(r"^import wandb(\b)", r"import lumina\1", content, flags=re.MULTILINE)
    # from wandb -> from lumina
    content = re.sub(r"^from wandb(\b|\.)", r"from lumina\1", content, flags=re.MULTILINE)
    return content


def replace_metadata(content: str) -> str:
    # __module__ = "wandb.xxx" -> __module__ = "lumina.xxx"
    content = re.sub(r'__module__\s*=\s*"wandb', '__module__ = "lumina', content)
    content = re.sub(r"__module__\s*=\s*'wandb", "__module__ = 'lumina", content)
    # __package__ = "wandb" -> __package__ = "lumina"
    content = re.sub(r'__package__\s*=\s*"wandb"', '__package__ = "lumina"', content)
    content = re.sub(r"__package__\s*=\s*'wandb'", "__package__ = 'lumina'", content)
    return content


def replace_safe_strings(content: str) -> str:
    # "wandb.sdk" -> "lumina.sdk"
    content = re.sub(r'"wandb\.([a-zA-Z0-9_.]+)"', r'"lumina.\1"', content)
    content = re.sub(r"'wandb\.([a-zA-Z0-9_.]+)'", r'"lumina.\1"', content)

    # "wandb" as a standalone module reference in certain contexts
    # Only within Python source, be conservative
    # e.g. modulename="wandb" -> modulename="lumina"
    content = re.sub(r'(module[name]*|modulename|__name__|package)\s*=\s*"wandb"', r'\1 = "lumina"', content)
    content = re.sub(r"(module[name]*|modulename|__name__|package)\s*=\s*'wandb'", r"\1 = 'lumina'", content)

    return content


def migrate_file(path: Path) -> bool:
    if not is_text_file(path):
        return False

    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return False

    original = content
    content = replace_imports(content)
    content = replace_metadata(content)
    content = replace_safe_strings(content)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed = 0
    for path in iter_source_files():
        if migrate_file(path):
            changed += 1
            print(f"Changed: {path.relative_to(ROOT)}")

    print(f"\nTotal files changed: {changed}")


if __name__ == "__main__":
    main()
