# 3dvr-agent

A local command-line system for:
- building apps with AI
- finding and closing real-world customers

## Sales Engine

export PATH="$HOME/3dvr-agent/thomas-agent/scripts:$PATH"

### Workflow

ask-crawl
ask-enrich
ask-track new
ask-next

### Main sales page

- Launch in 3 Days → https://3dvr.tech/launch-in-3-days.html
- use this when a lead asks what 3dvr actually does

### Commands

- ask-crawl → find nearby businesses
- ask-enrich → find contact pages
- ask-track → manage pipeline, including `new`, `contact`, `nurture`, `reply`, `close`
- ask-next → next lead + ready opener + launch-page follow-up
- ask-message → outreach message variants and launch-page follow-up
- ask-send → copy opener, open email/contact page, and optionally mark contacted
- ask-artifact → store outreach drafts and screenshots in Gun for later reuse
- ask-sales → outreach messages
- ask-reply → reply messages
- ask-post → simple posts
- ask-flow → daily execution steps

### Outreach Artifacts

Store a draft and screenshots in Gun:

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
