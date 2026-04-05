#!/usr/bin/env python3
import json, subprocess, sys, shutil
from pathlib import Path

REPO = Path.home() / "3dvr-site"
URL = "http://127.0.0.1:8080/completion"

def ensure_server():
    chk = subprocess.run(["pgrep","-f","llama-server"], capture_output=True, text=True)
    if chk.returncode != 0:
        subprocess.Popen(
            [str(Path.home() / "llama.cpp" / "build" / "bin" / "llama-server"),
             "-hf","Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF:Q4_K_M",
             "--host","127.0.0.1","--port","8080"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(["sleep","5"])

def main():
    if len(sys.argv) == 2:
        target = "index.html"
        task = sys.argv[1]
    elif len(sys.argv) >= 3:
        target = sys.argv[1]
        task = sys.argv[2]
    else:
        print('Usage: self-yolo [file] "task"')
        sys.exit(1)

    ensure_server()

    path = REPO / target
    orig = path.read_text()

    prompt = f"""Rewrite this file based on the task.

Task: {task}

Return ONLY the full final file contents.

FILE:
{orig}
"""

    res = subprocess.run(
        ["curl","-s",URL,"-H","Content-Type: application/json","-d",json.dumps({
            "prompt": prompt,
            "n_predict": 1200,
            "temperature": 0.2,
            "stop": ["</html>"]
        })],
        capture_output=True, text=True
    )

    if not res.stdout.strip():
        print("Failed: empty response from llama-server")
        sys.exit(2)

    data = json.loads(res.stdout)
    out = data["content"] + "</html>"

    tmp = path.with_suffix(".new")
    tmp.write_text(out)

    if tmp.stat().st_size > 0:
        shutil.move(tmp, path)
        subprocess.run(["git","add",target], cwd=REPO)
        subprocess.run(["git","commit","-m","self-yolo update"], cwd=REPO)
        print("Updated:", target)
    else:
        print("Failed: empty output")

if __name__ == "__main__":
    main()
