# 3dvr-agent

Local self-improving AI dev tool built around llama.cpp, llama-server, GitHub, and Vercel.

## What it does

- edits project files with local AI
- generates HTML pages and app folders
- commits and pushes changes
- deploys sites via GitHub → Vercel
- supports rollback and self-updating workflows

## Commands

self-yolo
Improve a site file (usually index.html)

self-yolo-agent
Improve files inside the 3dvr-agent repo

self-yolo-loop
Run repeated improvement rounds

yolo-app
Create a new app page in 3dvr-site

yolo-new-site
Create a new repo + starter site

rollback-agent
Reset repo to previous state

## Installation

pip install --break-system-packages -e ~/3dvr-agent

or

pip install git+https://github.com/tmsteph/3dvr-agent.git

## Notes

- Requires llama-server running locally on 127.0.0.1:8080
- HTML generation is the strongest workflow
- Python and markdown edits should be reviewed

## License

Add your preferred license
