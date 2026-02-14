from __future__ import annotations

"""Seed script for official agent templates.

Run standalone:
    python -m seeds.templates

Or import and call ``seed_templates(session)`` from an async context.
"""

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.template import AgentTemplate

# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

SEED_TEMPLATES: list[dict] = [
    {
        "name": "Support Ticket Classifier",
        "description": "Automatically classifies incoming support tickets by priority using AI and notifies the team on Slack when a high-priority ticket arrives.",
        "category": "support",
        "icon": "ticket",
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {"event": "ticket.created"},
            "settings": {"timeout_seconds": 120, "max_retries": 2},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "New Ticket",
                    "config": {"event": "ticket.created"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "ai-1",
                    "node_type": "ai",
                    "node_subtype": "classify",
                    "label": "Classify Priority",
                    "config": {
                        "model": "gpt-4o",
                        "prompt": "Classify the following support ticket into one of these priorities: critical, high, medium, low.\n\nSubject: {{trigger.data.subject}}\nBody: {{trigger.data.body}}\n\nRespond with ONLY the priority level.",
                        "temperature": 0.1,
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "logic-1",
                    "node_type": "logic",
                    "node_subtype": "if_else",
                    "label": "Is High Priority?",
                    "config": {
                        "condition": {
                            "field": "{{ai-1.output.text}}",
                            "operator": "in",
                            "value": ["critical", "high"],
                        },
                    },
                    "position_x": 250,
                    "position_y": 350,
                },
                {
                    "id": "action-1",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Notify Slack",
                    "config": {
                        "tool_name": "slack",
                        "action": "send_message",
                        "params": {
                            "channel": "#support-urgent",
                            "text": "High-priority ticket: {{trigger.data.subject}} — Priority: {{ai-1.output.text}}",
                        },
                    },
                    "position_x": 250,
                    "position_y": 500,
                },
            ],
            "edges": [
                {"source_node_id": "trigger-1", "target_node_id": "ai-1"},
                {"source_node_id": "ai-1", "target_node_id": "logic-1"},
                {
                    "source_node_id": "logic-1",
                    "target_node_id": "action-1",
                    "condition": {"branch": "true"},
                    "label": "Yes",
                },
            ],
        },
    },
    {
        "name": "Meeting Notes Summarizer",
        "description": "Receives meeting notes via webhook, generates an AI-powered summary, and posts it to a Slack channel.",
        "category": "engineering",
        "icon": "file-text",
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {"event": "meeting.ended"},
            "settings": {"timeout_seconds": 180, "max_retries": 2},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "Meeting Ended",
                    "config": {"event": "meeting.ended"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "ai-1",
                    "node_type": "ai",
                    "node_subtype": "summarize",
                    "label": "Summarize Notes",
                    "config": {
                        "model": "gpt-4o",
                        "prompt": "Summarize the following meeting notes into key points, action items, and decisions.\n\nMeeting: {{trigger.data.title}}\nAttendees: {{trigger.data.attendees}}\nNotes:\n{{trigger.data.transcript}}\n\nFormat with bullet points under sections: Key Points, Action Items, Decisions.",
                        "temperature": 0.3,
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "action-1",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Post Summary",
                    "config": {
                        "tool_name": "slack",
                        "action": "send_message",
                        "params": {
                            "channel": "#meeting-notes",
                            "text": "Meeting Summary: {{trigger.data.title}}\n\n{{ai-1.output.text}}",
                        },
                    },
                    "position_x": 250,
                    "position_y": 350,
                },
            ],
            "edges": [
                {"source_node_id": "trigger-1", "target_node_id": "ai-1"},
                {"source_node_id": "ai-1", "target_node_id": "action-1"},
            ],
        },
    },
    {
        "name": "Lead Enrichment",
        "description": "When a new lead arrives via webhook, uses AI to research the company and updates the CRM record via HTTP.",
        "category": "sales",
        "icon": "user-search",
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {"event": "lead.created"},
            "settings": {"timeout_seconds": 300, "max_retries": 3},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "New Lead",
                    "config": {"event": "lead.created"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "ai-1",
                    "node_type": "ai",
                    "node_subtype": "chat",
                    "label": "Research Company",
                    "config": {
                        "model": "gpt-4o",
                        "prompt": "Research the following company and provide a brief summary including: industry, size, key products/services, recent news, and potential fit.\n\nCompany: {{trigger.data.company}}\nWebsite: {{trigger.data.website}}\n\nReturn as JSON with keys: industry, size, products, recent_news, fit_score (1-10).",
                        "temperature": 0.4,
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "action-1",
                    "node_type": "action",
                    "node_subtype": "http_request",
                    "label": "Update CRM",
                    "config": {
                        "tool_name": "http_request",
                        "action": "request",
                        "params": {
                            "method": "PATCH",
                            "url": "{{trigger.data.crm_api_url}}/leads/{{trigger.data.lead_id}}",
                            "headers": {"Content-Type": "application/json"},
                            "body": {
                                "enrichment_data": "{{ai-1.output.text}}",
                                "enriched_at": "{{now}}",
                            },
                        },
                    },
                    "position_x": 250,
                    "position_y": 350,
                },
            ],
            "edges": [
                {"source_node_id": "trigger-1", "target_node_id": "ai-1"},
                {"source_node_id": "ai-1", "target_node_id": "action-1"},
            ],
        },
    },
    {
        "name": "PR Review Assistant",
        "description": "Receives pull request events via webhook, uses AI to review the code changes, and posts a review comment via HTTP.",
        "category": "engineering",
        "icon": "git-pull-request",
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {"event": "pull_request.opened"},
            "settings": {"timeout_seconds": 300, "max_retries": 2},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "PR Opened",
                    "config": {"event": "pull_request.opened"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "ai-1",
                    "node_type": "ai",
                    "node_subtype": "chat",
                    "label": "Review Code",
                    "config": {
                        "model": "gpt-4o",
                        "prompt": "Review the following pull request diff and provide constructive feedback. Focus on:\n1. Potential bugs\n2. Security concerns\n3. Performance issues\n4. Code style improvements\n\nPR Title: {{trigger.data.title}}\nDescription: {{trigger.data.description}}\n\nDiff:\n{{trigger.data.diff}}",
                        "temperature": 0.3,
                        "max_tokens": 2048,
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "action-1",
                    "node_type": "action",
                    "node_subtype": "http_request",
                    "label": "Post Review Comment",
                    "config": {
                        "tool_name": "http_request",
                        "action": "request",
                        "params": {
                            "method": "POST",
                            "url": "https://api.github.com/repos/{{trigger.data.repo}}/pulls/{{trigger.data.pr_number}}/reviews",
                            "headers": {
                                "Authorization": "Bearer {{env.GITHUB_TOKEN}}",
                                "Content-Type": "application/json",
                            },
                            "body": {
                                "body": "## AI Code Review\n\n{{ai-1.output.text}}",
                                "event": "COMMENT",
                            },
                        },
                    },
                    "position_x": 250,
                    "position_y": 350,
                },
            ],
            "edges": [
                {"source_node_id": "trigger-1", "target_node_id": "ai-1"},
                {"source_node_id": "ai-1", "target_node_id": "action-1"},
            ],
        },
    },
    {
        "name": "Daily Standup Digest",
        "description": "Runs on a daily schedule to fetch recent Slack messages from the standup channel, summarizes them with AI, and posts the digest.",
        "category": "engineering",
        "icon": "calendar-clock",
        "definition": {
            "trigger_type": "schedule",
            "trigger_config": {"cron": "0 9 * * 1-5", "timezone": "America/New_York"},
            "settings": {"timeout_seconds": 180, "max_retries": 2},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "schedule",
                    "label": "Daily 9 AM",
                    "config": {"cron": "0 9 * * 1-5", "timezone": "America/New_York"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "action-1",
                    "node_type": "action",
                    "node_subtype": "http_request",
                    "label": "Fetch Messages",
                    "config": {
                        "tool_name": "http_request",
                        "action": "request",
                        "params": {
                            "method": "GET",
                            "url": "https://slack.com/api/conversations.history",
                            "headers": {"Authorization": "Bearer {{env.SLACK_BOT_TOKEN}}"},
                            "query": {
                                "channel": "{{env.STANDUP_CHANNEL_ID}}",
                                "oldest": "{{yesterday_timestamp}}",
                            },
                        },
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "ai-1",
                    "node_type": "ai",
                    "node_subtype": "summarize",
                    "label": "Summarize Standup",
                    "config": {
                        "model": "gpt-4o",
                        "prompt": "Summarize the following standup messages into a daily digest. Group by team member and highlight:\n- What was done yesterday\n- What's planned for today\n- Any blockers\n\nMessages:\n{{action-1.output.messages}}\n\nFormat as a clean Slack message with bold names.",
                        "temperature": 0.3,
                    },
                    "position_x": 250,
                    "position_y": 350,
                },
                {
                    "id": "action-2",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Post Digest",
                    "config": {
                        "tool_name": "slack",
                        "action": "send_message",
                        "params": {
                            "channel": "#standup-digest",
                            "text": "Daily Standup Digest\n\n{{ai-1.output.text}}",
                        },
                    },
                    "position_x": 250,
                    "position_y": 500,
                },
            ],
            "edges": [
                {"source_node_id": "trigger-1", "target_node_id": "action-1"},
                {"source_node_id": "action-1", "target_node_id": "ai-1"},
                {"source_node_id": "ai-1", "target_node_id": "action-2"},
            ],
        },
    },
]


async def seed_templates(db: AsyncSession) -> int:
    """Insert official templates if they don't already exist. Returns count of inserted templates."""
    inserted = 0
    for tpl_data in SEED_TEMPLATES:
        result = await db.execute(
            select(AgentTemplate).where(
                AgentTemplate.name == tpl_data["name"],
                AgentTemplate.is_official.is_(True),
            )
        )
        if result.scalar_one_or_none() is not None:
            continue

        template = AgentTemplate(
            id=uuid.uuid4(),
            name=tpl_data["name"],
            description=tpl_data["description"],
            category=tpl_data["category"],
            definition=tpl_data["definition"],
            icon=tpl_data["icon"],
            is_official=True,
            is_public=True,
            author_org_id=None,
            install_count=0,
        )
        db.add(template)
        inserted += 1

    await db.flush()
    return inserted


async def _run() -> None:
    """Run seeding as a standalone script."""
    from core.database import async_session_factory

    async with async_session_factory() as session:
        count = await seed_templates(session)
        await session.commit()
        print(f"Seeded {count} templates.")


if __name__ == "__main__":
    asyncio.run(_run())
