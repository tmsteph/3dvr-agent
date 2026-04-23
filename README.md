# 3dvr-agent

A local command-line system for:
- building apps with AI
- finding and closing real-world customers

## Sales Engine

export PATH="$HOME/3dvr-agent/thomas-agent/scripts:$PATH"

### Workflow

ask-crawl --location "La Mesa, CA" --category professional --limit 10 --radius-km 8
ask-enrich
ask-track new
ask-next
ask-send --enrich --mark "Lead Name"

### Main sales page

- Launch in 3 Days → https://3dvr.tech/launch-in-3-days.html
- use this when a lead asks what 3dvr actually does

### Commands

- ask-crawl → find nearby businesses from OpenStreetMap/Overpass, dedupe them, and add them to `thomas-agent/leads.csv`
- ask-enrich → find email addresses, contact forms, and contact pages
- ask-track → manage pipeline, including `new`, `contact`, `nurture`, `reply`, `close`
- ask-next → next lead + ready opener + launch-page follow-up
- ask-message → outreach message variants and launch-page follow-up
- ask-send → copy opener, open email/contact page, optionally enrich first, and optionally mark contacted
- ask-artifact → store outreach drafts and screenshots in Gun for later reuse
- ask-sales → outreach messages
- ask-reply → reply messages
- ask-post → simple posts
- ask-flow → daily execution steps
- ask-autopilot → run one unattended operator cycle
- ask-autopilot-daemon → keep the operator cycling in the background

### Lead Crawling

Run a dry crawl first:

```sh
ask-crawl --location "La Mesa, CA" --category professional --limit 10 --radius-km 8 --dry-run
```

Append the usable leads to the pipeline:

```sh
ask-crawl --location "La Mesa, CA" --category professional --limit 10 --radius-km 8
```

Categories:

```text
coffee, food, service, professional, health
```

Useful defaults:

```sh
export THREEDVR_LEAD_LOCATION="San Diego, CA"
export THREEDVR_LEAD_CATEGORY="service"
export THREEDVR_LEAD_LIMIT=25
export THREEDVR_LEAD_RADIUS_KM=8
```

If Overpass rate-limits a broad search, wait a minute or narrow the radius/city.

### Contact Enrichment

Pull better contact targets from a lead site:

```sh
ask-enrich --name "Dark Horse Coffee Roasters" --refresh
```

The enricher looks for:

```text
mailto links, visible email addresses, contact forms, contact/about/booking pages
```

Send with browser/email integration:

```sh
ask-send --enrich "Dark Horse Coffee Roasters"
```

If an email is found, `ask-send` opens a prefilled `mailto:` draft. If a form or contact page is found, it copies the message and opens the page in the browser. Add `--mark` when you want it to mark the lead contacted after opening.

### Autonomous Operator

Run one unattended cycle:

```sh
ask-autopilot
```

Dry-run without sending email:

```sh
ask-autopilot --dry-run --no-email
```

Keep it running a few times a day:

```sh
export THREEDVR_AUTOPILOT_INTERVAL_MINUTES=360
ask-autopilot-daemon start
ask-autopilot-daemon status
ask-autopilot-daemon stop
```

When `tmux` is available, the daemon runs in a detached `3dvr-autopilot` session so it survives the terminal that launched it.

The operator:

```text
- refills the lead queue when new leads are low
- enriches weak contact targets
- stores run snapshots in Gun and local state
- emails you only when action is needed, errors happen, or spend guardrails trip
```

Useful environment variables:

```sh
export THREEDVR_AUTOPILOT_LOCATIONS="La Mesa, CA;San Diego, CA"
export THREEDVR_AUTOPILOT_CATEGORIES="professional;service"
export THREEDVR_AUTOPILOT_MIN_NEW_LEADS=5
export THREEDVR_AUTOPILOT_NOTIFY_NEW_LEADS=3
export THREEDVR_AUTOPILOT_NOTIFY_EMAIL="3dvr.tech@gmail.com"
export THREEDVR_AUTOPILOT_EMAIL_MODE="action"
export THREEDVR_AUTOPILOT_EMAIL_TRANSPORT="portal"
export THREEDVR_AUTOPILOT_EMAIL_ENDPOINT="https://portal.3dvr.tech/api/calendar/reminder-email"
export THREEDVR_AUTOPILOT_EMAIL_TOKEN="shared_operator_token"
```

Portal relay is preferred. Local Gmail stays available as an optional fallback:

```sh
export THREEDVR_AUTOPILOT_EMAIL_TRANSPORT="auto"
export GMAIL_USER="3dvr.tech@gmail.com"
export GMAIL_APP_PASSWORD="your_app_password"
```

If you keep the shared token in a private file, `ask-autopilot` will read it automatically from:

```text
~/.3dvr-agent-operator-email-token
```

Optional spend guard:

```sh
export OPENAI_ADMIN_KEY="org_admin_key"
export THREEDVR_AUTOPILOT_OPENAI_COST_LIMIT_USD=5
```

Optional Codex probe modes:

```sh
export THREEDVR_AUTOPILOT_CODEX_PROBE="auth"   # default, reads local Codex auth summary
export THREEDVR_AUTOPILOT_CODEX_PROBE="codex"  # runs `codex exec \"/status\"`
export THREEDVR_AUTOPILOT_CODEX_PROBE="off"
```

Gun paths:

```text
3dvr/ops/autopilot/runs/<run-id>
3dvr/ops/autopilot/state
```

### Outreach Artifacts

Create a universal browser handoff that writes the draft and screenshots into Gun, then opens the portal:

```sh
ask-artifact open "Dark Horse Coffee Roasters" \
  --draft ~/outreach/darkhorse-coffee-roasters/darkhorse-footer-outreach-draft.txt \
  --file ~/outreach/darkhorse-coffee-roasters/darkhorse-footer-buttons-current.png \
  --file ~/outreach/darkhorse-coffee-roasters/darkhorse-footer-buttons-mock.png
```

The handoff file is written to the first available portable location:

```text
$THREEDVR_OUTREACH_DIR
~/3dvr-outreach
~/Downloads/3dvr-outreach
~/outreach
/sdcard/Download/3dvr-outreach
```

Use `--no-open` to create the handoff without launching a browser.

Store a draft and screenshots directly from Node:

```sh
ask-artifact save "Dark Horse Coffee Roasters" \
  --draft ~/outreach/darkhorse-coffee-roasters/darkhorse-footer-outreach-draft.txt \
  --file ~/outreach/darkhorse-coffee-roasters/darkhorse-footer-buttons-current.png \
  --file ~/outreach/darkhorse-coffee-roasters/darkhorse-footer-buttons-mock.png
```

Review the saved Gun record:

```sh
ask-artifact list "Dark Horse Coffee Roasters"
```

Gun path:

```text
3dvr/crm/outreach-artifacts/<lead-slug>
```

## AI Dev Engine

- self-yolo
- self-yolo-agent
- self-yolo-loop
- yolo-app
- yolo-new-site
- rollback-agent

## Philosophy

Keep it simple.
One action at a time.
Real output beats perfect systems.
