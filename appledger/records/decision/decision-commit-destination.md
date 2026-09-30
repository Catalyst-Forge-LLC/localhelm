---
format_version: 0.1.0
id: decision-commit-destination
kind: decision
title: Commit drafts use a selected model destination
record_status: active
created_at: 2026-09-30T14:40:00Z
updated_at: 2026-09-30T14:40:00Z
recorded_by:
  id: codex
  type: agent
visibility: internal
relations: []
claims: []
data:
  status: accepted
  choice: Default to loopback Ollama; remote destinations require explicit machine or URL configuration. LAN discovery requires opt-in and never automatically authorizes a prompt.
  rationale: Commit planning previously discovered remote hosts and could transmit repository text before commit confirmation. User approved correcting this boundary in the portfolio implementation batch.
  alternatives:
    - Keep automatic network-first selection; rejected because discovery is not authorization to send repository content.
  authority: user
---

Supersedes the network-first commit-drafting behavior described in historical context. Editable fallback messages and explicit configured destinations remain available.
