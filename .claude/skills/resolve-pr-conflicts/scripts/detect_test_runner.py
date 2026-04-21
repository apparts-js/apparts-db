#!/usr/bin/env python3
"""Detect the test runner command for the current project.

Prints the runnable command to stdout, e.g.: npm test
Exits with code 1 and a message to stderr if nothing is detected.

Run from the project root.
"""

import json
import sys
from pathlib import Path


def detect(root: Path) -> str | None:
    # Node.js (npm / yarn / pnpm)
    pkg = root / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            scripts = data.get("scripts", {})
            for name in ("test", "test:unit", "test:all", "tests"):
                if name in scripts:
                    if (root / "yarn.lock").exists():
                        return f"yarn {name}"
                    if (root / "pnpm-lock.yaml").exists():
                        return f"pnpm run {name}"
                    return f"npm {name}"
        except (json.JSONDecodeError, OSError):
            pass

    # Rust
    if (root / "Cargo.toml").exists():
        return "cargo test"

    # Go
    if (root / "go.mod").exists():
        return "go test ./..."

    # Python — pytest preferred
    for marker in ("pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"):
        if (root / marker).exists():
            return "pytest"
    if any(root.rglob("test_*.py")) or any(root.rglob("*_test.py")):
        return "pytest"

    # Make
    makefile = root / "Makefile"
    if makefile.exists():
        content = makefile.read_text()
        for target in ("test", "tests", "check"):
            if re.search(rf"^{target}\s*:", content, re.MULTILINE):
                return f"make {target}"

    # Ruby
    if (root / "Gemfile").exists():
        if (root / ".rspec").exists() or any(root.rglob("*_spec.rb")):
            return "bundle exec rspec"
        return "bundle exec rake test"

    # PHP
    if (root / "phpunit.xml").exists() or (root / "phpunit.xml.dist").exists():
        return "./vendor/bin/phpunit"

    return None


if __name__ == "__main__":
    import re
    cmd = detect(Path.cwd())
    if cmd:
        print(cmd)
    else:
        print(
            "Could not detect test runner. Check README.md for test instructions.",
            file=sys.stderr,
        )
        sys.exit(1)
