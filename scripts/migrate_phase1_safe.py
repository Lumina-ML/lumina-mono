#!/usr/bin/env python3
"""
Phase 1 brand migration: wandb -> lumina (safe version)

Rules:
- Rename package directory from wandb/ to lumina/
- Update import statements and module references in Python code
- Update pyproject.toml and README
- Avoid AST unparse to protect generated files (protobuf)
- DO NOT touch: WANDB_* env vars, API URLs, protobuf message type names
"""

import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
SDK_DIR = ROOT / "python" / "lumina" / "lumina" / "lumina"


def iter_text_files():
    for path in SDK_DIR.rglob("*"):
        if path.is_file():
            if path.suffix in {".pyc", ".pyo", ".so", ".dylib", ".dll"}:
                continue
            if "__pycache__" in path.parts:
                continue
            if is_binary(path):
                continue
            yield path


def is_binary(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(2048)
            return b"\x00" in chunk
    except Exception:
        return True


def is_wandb_url(s: str) -> bool:
    return bool(re.search(r"https?://[^\s\"']*wandb", s))


def replace_import_statements(content: str) -> str:
    # import wandb -> import lumina (preserve indentation)
    content = re.sub(r"^([ \t]*)import wandb(\b)", r"\1import lumina\2", content, flags=re.MULTILINE)
    # from wandb -> from lumina (preserve indentation)
    content = re.sub(r"^([ \t]*)from wandb(\b|\.)", r"\1from lumina\2", content, flags=re.MULTILINE)
    return content


def replace_module_references(content: str) -> str:
    """
    Replace bare `wandb.` references with `lumina.` in code, but protect strings
    that contain WANDB_ env vars or URLs.
    """
    result = []
    in_string = None
    escape = False
    i = 0

    while i < len(content):
        char = content[i]

        if escape:
            result.append(char)
            escape = False
            i += 1
            continue

        if char == "\\" and in_string:
            escape = True
            result.append(char)
            i += 1
            continue

        if char in ('"', "'"):
            if in_string is None:
                in_string = char
                result.append(char)
            elif in_string == char:
                in_string = None
                result.append(char)
            else:
                result.append(char)
            i += 1
            continue

        if in_string:
            result.append(char)
            i += 1
            continue

        # Not in string. Check for wandb reference.
        if content.startswith("wandb", i):
            # Check if it's a valid identifier boundary
            after = i + 5
            if after >= len(content) or not (content[after].isalnum() or content[after] == "_"):
                # Check context: don't replace if preceded by env var pattern or URL
                before = content[max(0, i - 20):i]
                if re.search(r"WANDB$", before):
                    result.append("wandb")
                elif re.search(r"https?://\S*$", before):
                    result.append("wandb")
                else:
                    result.append("lumina")
                i += 5
                continue

        result.append(char)
        i += 1

    return "".join(result)


def fix_string_literals(content: str) -> str:
    """
    Replace "wandb.xxx" -> "lumina.xxx" inside string literals, but skip URLs and WANDB_*.
    """
    def replace_in_string(match):
        s = match.group(1)
        if "WANDB" in s:
            return match.group(0)
        if is_wandb_url(s):
            return match.group(0)
        # Replace module paths like "wandb.sdk.xxx" -> "lumina.sdk.xxx"
        s = re.sub(r'\bwandb\.([a-zA-Z0-9_.]+)\b', r'lumina.\1', s)
        # Replace standalone "wandb" only when it refers to the package
        s = re.sub(r'\bwandb\b', 'lumina', s)
        quote = match.group(0)[0]
        return quote + s + quote

    # Double-quoted strings
    content = re.sub(r'"([^"\\]*(?:\\.[^"\\]*)*)"', replace_in_string, content)
    # Single-quoted strings
    content = re.sub(r"'([^'\\]*(?:\\.[^'\\]*)*)'", replace_in_string, content)
    return content


def migrate_file(path: Path) -> bool:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return False

    original = content

    if path.suffix == ".py":
        content = replace_import_statements(content)
        if path.name.endswith("_pb2.py"):
            # Protobuf generated files: only update import statements,
            # do not touch serialized descriptors containing original proto paths
            pass
        else:
            content = replace_module_references(content)
            content = fix_string_literals(content)
    elif path.suffix == ".pyi":
        content = replace_import_statements(content)
        content = replace_module_references(content)
        content = fix_string_literals(content)
    else:
        # For non-Python files, just do safe string replacements
        content = fix_string_literals(content)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    changed = 0
    for path in iter_text_files():
        if migrate_file(path):
            changed += 1
            print(f"Changed: {path.relative_to(ROOT)}")

    print(f"\nTotal files changed: {changed}")


if __name__ == "__main__":
    main()
