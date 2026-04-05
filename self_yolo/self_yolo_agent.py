#!/usr/bin/env python3
import json, subprocess, sys, shutil, time
from pathlib import Path

REPO = Path.home() / "3dvr-agent"
URL = "http://127.0.0.1:8080/completion"

ALLOWED = {
    "self_yolo/cli.py",
    "self_yolo/yolo_app.py",
    "self_yolo/yolo_new_site.py",
    "self_yolo/self_update_agent.py",
    "self_yolo/self_yolo_agent.py",
    "self_yolo/self_yolo_loop.py",
    "self_yolo/rollback.py",
    "pyproject.toml",
    "README.md",
}

def say(msg):
    print(f"[self-yolo-agent] {msg}", flush=True)

def rule(title=""):
    bar = "=" * 56
    print(f"\n{bar}\n{title}\n{bar}", flush=True)

def ensure_server():
    chk = subprocess.run(["pgrep", "-f", "llama-server"], capture_output=True, text=True)
    if chk.returncode == 0:
        say("llama-server already running")
        return
    say("starting llama-server...")
    subprocess.Popen(
        [
            str(Path.home() / "llama.cpp" / "build" / "bin" / "llama-server"),
            "-hf", "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF:Q4_K_M",
            "--host", "127.0.0.1",
            "--port", "8080",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(5)
    say("llama-server started")

def dedupe_markdown_sections(text):
    lines = text.splitlines()
    out = []
    seen_blocks = set()
    block = []

    def flush_block():
        nonlocal block
        if not block:
            return
        joined = "\n".join(block).strip()
        key = joined[:400]
        if joined and key not in seen_blocks:
            seen_blocks.add(key)
            out.extend(block)
            out.append("")
        block = []

    for line in lines:
        if line.strip() == "---" or line.startswith("# "):
            flush_block()
        block.append(line)
    flush_block()
    return "\n".join(out).strip() + "\n"

def clean_text(text):
    return (
        text.replace("```python", "")
            .replace("```toml", "")
            .replace("```md", "")
            .replace("```html", "")
            .replace("```", "")
            .strip() + "\n"
    )

def main():
    if len(sys.argv) == 2:
        target = "README.md"
        task = sys.argv[1]
    elif len(sys.argv) >= 3:
        target = sys.argv[1]
        task = sys.argv[2]
    else:
        print('Usage: self-yolo-agent [file] "task"')
        sys.exit(1)

    if target not in ALLOWED:
        print("Target not allowed.")
        for x in sorted(ALLOWED):
            print(" -", x)
        sys.exit(2)

    ensure_server()

    path = REPO / target
    if not path.exists():
        print(f"Target file does not exist: {path}")
        sys.exit(3)

    orig = path.read_text(encoding="utf-8")
    say(f"target: {target}")
    say(f"file size: {len(orig)} chars")

    prompt = f"""Rewrite this file based on the task.

STRICT RULES:
- Output must be complete and correct for the actual project.
- Do not invent tools, commands, or technologies not present.
- Use correct formatting for this file type.
- No placeholders like example.com unless already present.
- Keep it concise and production-ready.
- Do not repeat sections.

Task: {task}

Return ONLY the full final file contents.
No markdown fences.
No explanation.

FILE PATH: {target}

FILE:
{orig}
"""
    say(f"prompt size: {len(prompt)} chars")

    stream = target.endswith(".html")
    payload = {
        "prompt": prompt,
        "n_predict": 1200 if stream else 220,
        "temperature": 0.2,
        "repeat_penalty": 1.3,
        "stop": ["\n---\n# 3dvr-agent", "\n# 3dvr-agent\n# 3dvr-agent"],
        "stream": stream,
    }

    say(f"editing {target} ...")
    rule("MODEL OUTPUT")
    started = time.time()

    if not stream:
        say("using non-stream mode")
        res = subprocess.run(
            ["curl", "-s", URL, "-H", "Content-Type: application/json", "-d", json.dumps(payload)],
            capture_output=True,
            text=True,
        )
        if not res.stdout.strip():
            print("Failed: empty response")
            sys.exit(4)
        data = json.loads(res.stdout)
        out = clean_text(data.get("content", ""))
        if target.endswith(".md"):
            out = dedupe_markdown_sections(out)
        print(out, end="", flush=True)
        say(f"completed in {time.time() - started:.1f}s")
    else:
        proc = subprocess.Popen(
            ["curl", "-N", "-s", URL, "-H", "Content-Type: application/json", "-d", json.dumps(payload)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        parts = []
        seen_tail = set()
        first_token = None

        for line in proc.stdout:
            if time.time() - started > 45:
                print("\n[self-yolo-agent] timeout reached")
                proc.kill()
                break
            if not line.startswith("data: "):
                continue
            chunk = line[6:].strip()
            if not chunk or chunk == "[DONE]":
                continue
            try:
                data = json.loads(chunk)
            except json.JSONDecodeError:
                continue
            text = data.get("content", "")
            if text:
                if first_token is None:
                    first_token = time.time()
                    say(f"first token in {first_token - started:.1f}s")
                print(text, end="", flush=True)
                parts.append(text)
                joined = "".join(parts)
                tail = joined[-400:]
                if tail in seen_tail and len(tail.strip()) > 80:
                    print("\n[self-yolo-agent] repetition detected, stopping")
                    proc.kill()
                    break
                seen_tail.add(tail)

        proc.wait()
        print()
        say(f"completed in {time.time() - started:.1f}s")
        out = clean_text("".join(parts))
        if not out.strip():
            print("Failed: empty response")
            sys.exit(4)

    rule("POST-PROCESS")

    tmp = path.with_suffix(path.suffix + ".new")
    bak = path.with_suffix(path.suffix + ".bak")
    bak.write_text(orig, encoding="utf-8")
    tmp.write_text(out, encoding="utf-8")

    if len(out.strip()) < max(120, len(orig.strip()) // 4):
        print("Validation failed: output too small.")
        sys.exit(5)

    if target.endswith(".py"):
        if "def main" not in out and "if __name__" not in out:
            print("Validation failed: missing expected python structure.")
            sys.exit(5)
        chk = subprocess.run([sys.executable, "-m", "py_compile", str(tmp)], capture_output=True, text=True)
        if chk.returncode != 0:
            print(chk.stderr or chk.stdout)
            print("Validation failed.")
            sys.exit(5)

    if out.strip() == orig.strip():
        print("No meaningful changes.")
        tmp.unlink(missing_ok=True)
        sys.exit(0)

    subprocess.run(["git","add","."], cwd=REPO)
    subprocess.run(["git","commit","-m","checkpoint before self-yolo-agent"], cwd=REPO, capture_output=True, text=True)

    shutil.move(tmp, path)

    if target.endswith(".py"):
        final_chk = subprocess.run([sys.executable, "-m", "py_compile", str(path)], capture_output=True, text=True)
        if final_chk.returncode != 0:
            print(final_chk.stderr or final_chk.stdout)
            print("[self-yolo-agent] final syntax check failed, restoring backup")
            if bak.exists():
                shutil.copy2(bak, path)
            sys.exit(6)

    subprocess.run(["git", "add", target], cwd=REPO)
    commit_res = subprocess.run(["git", "commit", "-m", f"self-yolo-agent: improve {target}"], cwd=REPO, capture_output=True, text=True)
    if commit_res.returncode != 0:
        print(commit_res.stdout or commit_res.stderr)
        print("[self-yolo-agent] commit failed, restoring backup")
        if bak.exists():
            shutil.copy2(bak, path)
        sys.exit(7)

    push_res = subprocess.run(["git", "push"], cwd=REPO, capture_output=True, text=True)
    if push_res.returncode != 0:
        print(push_res.stdout or push_res.stderr)
        print("[self-yolo-agent] push failed, restoring backup")
        if bak.exists():
            shutil.copy2(bak, path)
        sys.exit(8)

    reinstall_res = subprocess.run(["pip", "install", "--break-system-packages", "-e", str(REPO)], capture_output=True, text=True)
    if reinstall_res.returncode != 0:
        print(reinstall_res.stdout or reinstall_res.stderr)
        print("[self-yolo-agent] reinstall failed, restoring backup")
        if bak.exists():
            shutil.copy2(bak, path)
        sys.exit(9)

    rule("DONE")
    say(f"updated {target}")

if __name__ == "__main__":
    main()
