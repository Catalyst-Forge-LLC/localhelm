---
format_version: 0.1.0
id: decision-agent-commit-policy
kind: decision
title: Agents commit completed work and leave pushes to the operator
record_status: active
created_at: 2026-10-06T11:25:00Z
updated_at: 2026-10-06T11:25:00Z
recorded_by:
  id: codex
  type: agent
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: After each completed batch or specific change in LocalHelm, agents
    commit the work automatically with a clear, descriptive message. The
    operator handles pushes unless explicitly asking an agent to push.
  rationale: The operator explicitly requested this standing project policy.
  alternatives: []
  authority: operator
---
