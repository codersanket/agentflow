"""Seed the database with pre-built agent templates.

Usage:
    cd apps/api
    python -m scripts.seed_templates
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from core.database import async_session_factory
from models.template import AgentTemplate

logger = logging.getLogger(__name__)

TEMPLATES: list[dict] = [
    # ------------------------------------------------------------------ #
    # 1. Customer Support Classifier
    # ------------------------------------------------------------------ #
    {
        "name": "Customer Support Classifier",
        "description": "Classifies incoming support tickets by category and urgency, then routes them to the right team via Slack.",
        "category": "automation",
        "icon": "headphones",
        "is_official": True,
        "is_public": True,
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {},
            "settings": {},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "Webhook Trigger",
                    "config": {"trigger_type": "webhook"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "ai-classify",
                    "node_type": "ai",
                    "node_subtype": "classify",
                    "label": "Classify Ticket",
                    "config": {
                        "model": "gpt-4o",
                        "system_prompt": "You are a support ticket classifier. Classify the ticket into one of: billing, technical, feature_request, bug. Also determine urgency: low, medium, high. Respond with JSON: {\"category\": \"...\", \"urgency\": \"...\", \"summary\": \"...\"}",
                        "prompt": "Classify this support ticket:\n\n{{Webhook Trigger.output.payload.message}}",
                        "temperature": 0.3,
                        "max_tokens": 256,
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "action-slack",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Notify Slack",
                    "config": {
                        "action_type": "slack_send_message",
                        "channel": "#support-triage",
                        "text": "New ticket classified:\n{{Classify Ticket.output.text}}",
                    },
                    "position_x": 250,
                    "position_y": 380,
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source_node_id": "trigger-1",
                    "target_node_id": "ai-classify",
                    "label": None,
                },
                {
                    "id": "e2",
                    "source_node_id": "ai-classify",
                    "target_node_id": "action-slack",
                    "label": None,
                },
            ],
        },
    },
    # ------------------------------------------------------------------ #
    # 2. Content Summarizer
    # ------------------------------------------------------------------ #
    {
        "name": "Content Summarizer",
        "description": "Fetches a URL, summarizes the content using AI, and posts the summary to a Slack channel.",
        "category": "ai",
        "icon": "file-text",
        "is_official": True,
        "is_public": True,
        "definition": {
            "trigger_type": "manual",
            "trigger_config": {},
            "settings": {},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "manual",
                    "label": "Manual Trigger",
                    "config": {"trigger_type": "manual"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "action-fetch",
                    "node_type": "action",
                    "node_subtype": "http_request",
                    "label": "Fetch Content",
                    "config": {
                        "action_type": "http_request",
                        "method": "GET",
                        "url": "{{trigger.data.url}}",
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "ai-summarize",
                    "node_type": "ai",
                    "node_subtype": "summarize",
                    "label": "Summarize",
                    "config": {
                        "model": "gpt-4o",
                        "system_prompt": "You are a content summarizer. Provide a concise 3-5 sentence summary of the given text.",
                        "prompt": "Summarize the following content:\n\n{{Fetch Content.output.body}}",
                        "temperature": 0.5,
                        "max_tokens": 512,
                    },
                    "position_x": 250,
                    "position_y": 380,
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source_node_id": "trigger-1",
                    "target_node_id": "action-fetch",
                    "label": None,
                },
                {
                    "id": "e2",
                    "source_node_id": "action-fetch",
                    "target_node_id": "ai-summarize",
                    "label": None,
                },
            ],
        },
    },
    # ------------------------------------------------------------------ #
    # 3. Lead Qualifier with Routing
    # ------------------------------------------------------------------ #
    {
        "name": "Lead Qualifier",
        "description": "Scores incoming leads using AI and routes high-quality leads to sales via Slack, while low-quality leads get an automated email.",
        "category": "automation",
        "icon": "target",
        "is_official": True,
        "is_public": True,
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {},
            "settings": {},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "Webhook Trigger",
                    "config": {"trigger_type": "webhook"},
                    "position_x": 300,
                    "position_y": 50,
                },
                {
                    "id": "ai-score",
                    "node_type": "ai",
                    "node_subtype": "classify",
                    "label": "Score Lead",
                    "config": {
                        "model": "gpt-4o",
                        "system_prompt": "You are a lead qualification expert. Analyze the lead data and determine if it's a high-quality lead. Respond with JSON: {\"score\": 0-100, \"qualified\": true/false, \"reason\": \"...\"}",
                        "prompt": "Score this lead:\n\nName: {{Webhook Trigger.output.payload.name}}\nCompany: {{Webhook Trigger.output.payload.company}}\nEmail: {{Webhook Trigger.output.payload.email}}\nMessage: {{Webhook Trigger.output.payload.message}}",
                        "temperature": 0.3,
                        "max_tokens": 256,
                    },
                    "position_x": 300,
                    "position_y": 200,
                },
                {
                    "id": "logic-check",
                    "node_type": "logic",
                    "node_subtype": "if_else",
                    "label": "Is Qualified?",
                    "config": {
                        "logic_type": "if_else",
                        "condition": {
                            "left": "{{Score Lead.output.text}}",
                            "operator": "contains",
                            "right": "\"qualified\": true",
                        },
                    },
                    "position_x": 300,
                    "position_y": 380,
                },
                {
                    "id": "action-slack-hot",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Notify Sales",
                    "config": {
                        "action_type": "slack_send_message",
                        "channel": "#sales-leads",
                        "text": "Hot lead! {{Webhook Trigger.output.payload.name}} from {{Webhook Trigger.output.payload.company}}\n\nAI Assessment: {{Score Lead.output.text}}",
                    },
                    "position_x": 100,
                    "position_y": 550,
                },
                {
                    "id": "action-email-cold",
                    "node_type": "action",
                    "node_subtype": "email",
                    "label": "Send Follow-up",
                    "config": {
                        "action_type": "send_email",
                        "to": "{{Webhook Trigger.output.payload.email}}",
                        "subject": "Thanks for reaching out!",
                        "body": "Hi {{Webhook Trigger.output.payload.name}},\n\nThank you for your interest. We'll review your request and get back to you within 48 hours.\n\nBest regards,\nThe Team",
                    },
                    "position_x": 500,
                    "position_y": 550,
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source_node_id": "trigger-1",
                    "target_node_id": "ai-score",
                    "label": None,
                },
                {
                    "id": "e2",
                    "source_node_id": "ai-score",
                    "target_node_id": "logic-check",
                    "label": None,
                },
                {
                    "id": "e3",
                    "source_node_id": "logic-check",
                    "target_node_id": "action-slack-hot",
                    "label": "true",
                },
                {
                    "id": "e4",
                    "source_node_id": "logic-check",
                    "target_node_id": "action-email-cold",
                    "label": "false",
                },
            ],
        },
    },
    # ------------------------------------------------------------------ #
    # 4. Daily Report Generator
    # ------------------------------------------------------------------ #
    {
        "name": "Daily Report Generator",
        "description": "Pulls data from an API endpoint, generates a daily summary with AI, and posts it to Slack.",
        "category": "ai",
        "icon": "bar-chart-2",
        "is_official": True,
        "is_public": True,
        "definition": {
            "trigger_type": "schedule",
            "trigger_config": {"cron": "0 9 * * 1-5"},
            "settings": {},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "schedule",
                    "label": "Schedule Trigger",
                    "config": {"trigger_type": "schedule", "cron": "0 9 * * 1-5"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "action-fetch",
                    "node_type": "action",
                    "node_subtype": "http_request",
                    "label": "Fetch Metrics",
                    "config": {
                        "action_type": "http_request",
                        "method": "GET",
                        "url": "{{trigger.data.metrics_url}}",
                        "headers": {"Authorization": "Bearer {{trigger.data.api_token}}"},
                    },
                    "position_x": 250,
                    "position_y": 200,
                },
                {
                    "id": "ai-report",
                    "node_type": "ai",
                    "node_subtype": "generate",
                    "label": "Generate Report",
                    "config": {
                        "model": "gpt-4o",
                        "system_prompt": "You are a business analyst. Generate a concise daily report from the provided metrics data. Use bullet points and highlight key changes.",
                        "prompt": "Generate a daily report from this data:\n\n{{Fetch Metrics.output.body}}",
                        "temperature": 0.6,
                        "max_tokens": 1024,
                    },
                    "position_x": 250,
                    "position_y": 380,
                },
                {
                    "id": "action-slack",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Post to Slack",
                    "config": {
                        "action_type": "slack_send_message",
                        "channel": "#daily-reports",
                        "text": "Daily Report\n\n{{Generate Report.output.text}}",
                    },
                    "position_x": 250,
                    "position_y": 560,
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source_node_id": "trigger-1",
                    "target_node_id": "action-fetch",
                    "label": None,
                },
                {
                    "id": "e2",
                    "source_node_id": "action-fetch",
                    "target_node_id": "ai-report",
                    "label": None,
                },
                {
                    "id": "e3",
                    "source_node_id": "ai-report",
                    "target_node_id": "action-slack",
                    "label": None,
                },
            ],
        },
    },
    # ------------------------------------------------------------------ #
    # 5. Webhook to Slack Notifier (simplest possible)
    # ------------------------------------------------------------------ #
    {
        "name": "Webhook to Slack Notifier",
        "description": "The simplest agent: receives a webhook and posts the payload to a Slack channel. Great for monitoring and alerts.",
        "category": "integration",
        "icon": "bell",
        "is_official": True,
        "is_public": True,
        "definition": {
            "trigger_type": "webhook",
            "trigger_config": {},
            "settings": {},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "webhook",
                    "label": "Webhook Trigger",
                    "config": {"trigger_type": "webhook"},
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "action-slack",
                    "node_type": "action",
                    "node_subtype": "slack",
                    "label": "Send to Slack",
                    "config": {
                        "action_type": "slack_send_message",
                        "channel": "#notifications",
                        "text": "Webhook received:\n{{Webhook Trigger.output.payload}}",
                    },
                    "position_x": 250,
                    "position_y": 230,
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source_node_id": "trigger-1",
                    "target_node_id": "action-slack",
                    "label": None,
                },
            ],
        },
    },
    # ------------------------------------------------------------------ #
    # 6. Joke Generator (works with ONLY an AI provider — no integrations)
    # ------------------------------------------------------------------ #
    {
        "name": "Joke Generator",
        "description": "The simplest possible agent: takes a topic and generates a joke. Works with just an AI provider — no Slack, email, or other integrations required. Perfect for testing your setup.",
        "category": "ai",
        "icon": "smile",
        "is_official": True,
        "is_public": True,
        "definition": {
            "trigger_type": "manual",
            "trigger_config": {},
            "settings": {},
            "nodes": [
                {
                    "id": "trigger-1",
                    "node_type": "trigger",
                    "node_subtype": "manual",
                    "label": "Manual Trigger",
                    "config": {
                        "trigger_type": "manual",
                        "payload_schema": '{"type":"object","properties":{"topic":{"type":"string"}},"required":["topic"]}',
                    },
                    "position_x": 250,
                    "position_y": 50,
                },
                {
                    "id": "ai-joke",
                    "node_type": "ai",
                    "node_subtype": "generate",
                    "label": "Generate Joke",
                    "config": {
                        "model": "gpt-4o",
                        "system_prompt": "You are a witty comedian. Generate a short, clever joke about the given topic. Keep it clean and family-friendly.",
                        "prompt": "Tell me a joke about: {{Manual Trigger.output.payload.topic}}",
                        "temperature": 0.9,
                        "max_tokens": 256,
                    },
                    "position_x": 250,
                    "position_y": 230,
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source_node_id": "trigger-1",
                    "target_node_id": "ai-joke",
                    "label": None,
                },
            ],
        },
    },
]


async def seed() -> None:
    """Insert seed templates if they don't already exist."""
    async with async_session_factory() as db:
        for tpl_data in TEMPLATES:
            # Check if template already exists by name
            result = await db.execute(
                select(AgentTemplate).where(AgentTemplate.name == tpl_data["name"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                logger.info("Template '%s' already exists, skipping", tpl_data["name"])
                continue

            template = AgentTemplate(
                name=tpl_data["name"],
                description=tpl_data["description"],
                category=tpl_data["category"],
                definition=tpl_data["definition"],
                icon=tpl_data.get("icon"),
                is_official=tpl_data.get("is_official", True),
                is_public=tpl_data.get("is_public", True),
            )
            db.add(template)
            logger.info("Created template: %s", tpl_data["name"])

        await db.commit()
        logger.info("Template seeding complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
