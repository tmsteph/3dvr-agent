# 3DVR Autonomy Ladder

## Purpose

3DVR should not depend on a model being perfectly reliable. The system earns reliability by combining bounded capabilities, explicit policy, approvals, audit logs, rollback, tests, and measured trust.

Autonomy is granted **per capability**, not per agent. Reading a calendar, sending email, deploying code, spending money, and controlling a device are separate trust relationships with separate evidence and limits.

A missing or malformed policy fails closed.

## The six levels

| Level | Name | Authority |
| --- | --- | --- |
| 0 | Observe | Read permitted state and report what exists. No mutations. |
| 1 | Suggest | Recommend actions, priorities, or decisions. No mutations. |
| 2 | Draft | Prepare messages, code, transactions, forms, or other changes without executing them. |
| 3 | Act with approval | Execute one bounded action only after explicit approval. |
| 4 | Act + audit | Execute automatically inside a defined scope, with durable audit evidence and rollback/recovery. |
| 5 | Fully autonomous | Repeatedly execute tightly bounded, monitored, reversible work without routine approval. |

Level 5 is not unrestricted authority. It is a narrow operating mode for capabilities with proven reliability and strong containment.

## Core policy object

Every executable capability should eventually resolve to a versioned policy equivalent to:

```json
{
  "capability": "gmail.send",
  "enabled": true,
  "level": 3,
  "risk": "high",
  "scope": {
    "accounts": ["approved-account-id"],
    "recipientRules": "known-or-reviewed",
    "maxActionsPerDay": 10
  },
  "evidence": {
    "successfulRuns": 18,
    "reviewedRuns": 18,
    "failedRuns": 0,
    "rollbacks": 0,
    "unsafeAttempts": 0
  },
  "updatedAt": "2026-08-30T00:00:00Z"
}
```

The policy engine must evaluate the capability before execution. Business logic must not treat a prompt, model output, UI toggle, or environment variable as the security boundary.

## Risk caps

The initial conservative defaults are:

- **Low risk:** may reach level 5.
- **Medium risk:** may reach level 5 when bounded, monitored, reversible, and audited.
- **High risk:** capped at level 4 by default.
- **Critical risk:** capped at level 3; every execution requires explicit approval.

Examples:

- Low: refreshing a cached public-data index.
- Medium: updating a reversible project record or generating a deployment preview.
- High: sending external email, publishing content, production deployment, or device mutations.
- Critical: money movement, legal acceptance, credential/security changes, destructive account actions, or other difficult-to-reverse authority.

Risk classification is separate from autonomy level. A capability can be reliable and still remain approval-gated because its downside is too large.

## Execution requirements

All actions require an enabled policy and satisfied scope.

Additional gates:

- Level 3: explicit approval for the concrete action.
- Level 4: durable audit path available before execution.
- Level 5: bounded scope, active monitoring, reversibility/recovery, and audit.

Capability adapters should emit enough evidence to reconstruct what was requested, what policy allowed it, what happened, and how to undo or remediate it.

Recommended audit fields:

```text
actionId
agentId
user/workspace
capability
policyVersion
autonomyLevel
risk
requestedAction
scopeDecision
approvalId (when required)
inputs hash / safe summary
startedAt
completedAt
result
external receipt ids
rollback pointer
error / incident classification
```

## Promotion: earn one rung at a time

Promotion is explicit, reversible, and per capability. Revenue, model confidence, or a user saying "YOLO" is not sufficient evidence by itself.

The initial code defaults require increasing amounts of successful reviewed work and decreasing failure/rollback rates:

| Promotion to | Successful runs | Reviewed runs | Max failure rate | Max rollback rate |
| --- | ---: | ---: | ---: | ---: |
| 1 Suggest | 1 | 1 | 25% | 25% |
| 2 Draft | 5 | 3 | 15% | 10% |
| 3 Act with approval | 10 | 5 | 5% | 5% |
| 4 Act + audit | 25 | 10 | 2% | 2% |
| 5 Fully autonomous | 100 | 25 | 1% | 1% |

These are starter defaults, not universal constants. Product domains can tighten them. Promotion to level 5 additionally requires explicit owner approval.

Unsafe attempts block promotion. Promotion skips are not allowed.

## Demotion and trust decay

Trust must decrease when evidence worsens.

Initial behavior:

- policy violation or unsafe attempt -> level 0
- unbounded action or missing audit where required -> at most level 2
- rollback-required incident or rejected execution -> drop one level
- ordinary success -> no automatic promotion; promotion must pass gates

Future implementations can add time decay, domain-specific incident severity, and statistically stronger confidence intervals.

## Initial 3DVR capability posture

This is a target posture, not a claim that every adapter already enforces it.

| Capability | Initial target | Notes |
| --- | --- | --- |
| Public research / read-only discovery | 0-1 | Observe and suggest freely inside privacy rules. |
| CRM/project drafts | 2 | Prepare reversible changes first. |
| Gmail/message sending | 3 | Human approval until recipient/scope controls and receipts are proven. |
| Calendar booking mutations | 3 | Approval for external commitments. |
| GitHub code changes | 3-4 | PRs can move toward audited autonomy; protected production merge rules remain separate. |
| Production deployment | 3-4 | Require tests, deployment receipt, health check, and rollback. |
| Device control | 3 | Keep approval-gated for meaningful mutations until command allowlists and recovery are mature. |
| Outreach campaigns | 3-4 | Respect compliance rules, campaign limits, quiet periods, and deduplication. |
| Payment/refund/money movement | 3 | Critical risk; explicit approval by default. |
| Simulation-only venture loop | 5 inside sandbox | No real-world authority; simulation can run autonomously. |

## Architecture

```text
intent
  -> planner
  -> named capability
  -> autonomy policy lookup
  -> risk + scope evaluation
  -> approval gate when required
  -> executor/adapter
  -> external receipt
  -> durable audit event
  -> success/failure/rollback evidence
  -> promotion or demotion assessment
```

The same contract should be shared by:

- `3dvr-agent` for execution
- `3dvr-portal` for controls, explanations, approvals, and audit UI
- `3dvr-android` for device capabilities
- future workers and connectors

## User experience

The Portal should show trust in plain language, per capability:

> **Email sending — Level 3: Act with approval**  
> Operator can draft and send email after you approve each message.  
> 18 successful reviewed sends · 0 failures · 0 rollbacks.

For every level, show **why** the capability has that authority, what scope it covers, how to lower it immediately, and what evidence is needed for the next rung.

There must always be a visible kill switch and a way to revoke a capability independently of the rest of the agent.

## Implementation status

`thomas-agent/node/autonomy-policy.js` contains the first shared policy primitives:

- canonical six-level definitions
- conservative risk caps
- fail-closed action evaluation
- approval/audit/boundedness gates
- measurable promotion checks
- incident-based demotion recommendations

`test/autonomy-policy.test.js` covers the baseline safety contract.

Next integration step: route real executors through this policy module before side effects, starting with one capability at a time. Recommended order: outbound messaging, GitHub/deployment actions, calendar mutations, device commands, then financial actions.

## Relationship to venture autonomy

`docs/autonomous-after-ignition-business.md` defines a separate venture maturity model for an autonomous business experiment. That model remains useful. This document is the lower-level capability policy beneath it.

A venture may be mature enough for bounded fulfillment while an individual capability such as money movement remains level 3 forever.
