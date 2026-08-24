#!/usr/bin/env python3
"""Render the README demo from real deterministic Runtime Canary output."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "assets" / "runtime-canary-demo.gif"
WIDTH, HEIGHT = 1280, 720

COLORS = {
    "background": "#101419",
    "panel": "#171c22",
    "border": "#303843",
    "text": "#e6edf3",
    "muted": "#8b98a5",
    "green": "#46d17d",
    "amber": "#f0b35a",
    "cyan": "#5ec4d6",
    "red": "#ec6a5f",
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts") / name,
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
        Path("/System/Library/Fonts/Menlo.ttc"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


FONT = font("consola.ttf", 25)
FONT_BOLD = font("consolab.ttf", 25)
FONT_SMALL = font("consola.ttf", 18)
FONT_LABEL = font("consolab.ttf", 19)


def run_script(script: str, args: list[str], expected_code: int) -> str:
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm is required to render the demo")
    completed = subprocess.run(
        [npm, "run", "--silent", script, "--", *args],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if completed.returncode != expected_code:
        raise RuntimeError(
            f"CLI exited with {completed.returncode}; expected {expected_code}:\n"
            f"{completed.stderr}"
        )
    return completed.stdout.strip()


def normalized(value: str) -> str:
    return re.sub(r"\bin \d+(?:\.\d+)?ms\b", "in <measured>", value)


def wrap_lines(lines: list[str], width: int = 76) -> list[str]:
    wrapped: list[str] = []
    for line in lines:
        if not line:
            wrapped.append("")
            continue
        indent = len(line) - len(line.lstrip())
        wrapped.extend(
            textwrap.wrap(
                line,
                width=width,
                subsequent_indent=" " * indent,
                replace_whitespace=False,
                drop_whitespace=False,
            )
        )
    return wrapped


def line_color(line: str) -> str:
    stripped = line.strip()
    if stripped.startswith("$"):
        return COLORS["cyan"]
    if "AVAILABLE" in line or stripped.startswith("[+]"):
        return COLORS["green"]
    if "DEGRADED" in line or stripped.startswith("[!]"):
        return COLORS["amber"]
    if stripped.startswith("configuration:"):
        return COLORS["amber"]
    if stripped.startswith("next:"):
        return COLORS["cyan"]
    if "failed" in stripped or "not run" in stripped:
        return COLORS["muted"]
    return COLORS["text"]


def render(lines: list[str], footer: str | None = None) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["background"])
    draw = ImageDraw.Draw(image)

    draw.text((58, 34), "RUNTIME CANARY", font=FONT_BOLD, fill=COLORS["text"])
    draw.text(
        (294, 39),
        "DETERMINISTIC PREFLIGHT",
        font=FONT_SMALL,
        fill=COLORS["muted"],
    )
    draw.rounded_rectangle(
        (955, 28, 1222, 67),
        radius=5,
        outline=COLORS["border"],
        width=2,
    )
    draw.text(
        (978, 37),
        "CONTROLLED FIXTURE",
        font=FONT_LABEL,
        fill=COLORS["amber"],
    )

    draw.rounded_rectangle(
        (50, 88, 1230, 660),
        radius=7,
        fill=COLORS["panel"],
        outline=COLORS["border"],
        width=2,
    )
    draw.rectangle((51, 89, 1229, 127), fill="#1d232b")
    draw.text((76, 99), "runtime-canary / live doctor", font=FONT_SMALL, fill=COLORS["muted"])

    y = 149
    for line in lines:
        draw.text((78, y), line, font=FONT, fill=line_color(line))
        y += 37

    if footer:
        draw.rectangle((50, 672, 1230, 676), fill=COLORS["amber"])
        draw.text((58, 686), footer, font=FONT_LABEL, fill=COLORS["amber"])
    else:
        draw.text(
            (58, 686),
            "DISCOVERY  >  LAUNCH  >  TASK  >  EVIDENCE  >  CLEANUP",
            font=FONT_SMALL,
            fill=COLORS["muted"],
        )
    return image


def add_frame(
    frames: list[Image.Image],
    durations: list[int],
    lines: list[str],
    duration: int,
    footer: str | None = None,
) -> None:
    frames.append(render(lines, footer))
    durations.append(duration)


def add_typed_line(
    frames: list[Image.Image],
    durations: list[int],
    existing: list[str],
    line: str,
) -> None:
    for end in range(2, len(line) + 3, 3):
        add_frame(frames, durations, [*existing, line[:end]], 55)


def main() -> None:
    probe = normalized(run_script("canary", ["probe", "--runtime", "fake"], 0))
    doctor = normalized(
        run_script(
            "doctor",
            [
                "--runtime",
                "fake",
                "--live",
                "--simulate",
                "configuration",
            ],
            1,
        )
    )
    machine_report = json.loads(
        run_script(
            "doctor",
            [
                "--runtime",
                "fake",
                "--live",
                "--simulate",
                "configuration",
                "--json",
            ],
            1,
        )
    )
    finding = machine_report["runtimes"][0]["findings"][0]["code"]
    if finding != "CONFIGURATION_FAILED":
        raise RuntimeError(f"unexpected Doctor finding: {finding}")

    command_probe = "$ npm run --silent canary -- probe --runtime fake"
    command_doctor = "$ npm run --silent doctor -- --runtime fake --live --simulate configuration"
    output_lines = wrap_lines(doctor.splitlines())

    frames: list[Image.Image] = []
    durations: list[int] = []
    visible: list[str] = []
    add_frame(frames, durations, visible, 500)
    add_typed_line(frames, durations, visible, command_probe)
    visible.extend([command_probe, probe, ""])
    add_frame(frames, durations, visible, 950)
    add_typed_line(frames, durations, visible, command_doctor)
    visible.append(command_doctor)

    for line in output_lines:
        visible.append(line)
        add_frame(frames, durations, visible, 310 if line else 140)

    add_frame(
        frames,
        durations,
        visible,
        2200,
        f"VERSION OK  /  LIVE CANARY DEGRADED  /  FINDING: {finding}",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"demo render failed: {error}", file=sys.stderr)
        raise
