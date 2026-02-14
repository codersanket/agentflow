"""phase2 agent engine tables

Revision ID: a2b3c4d5e6f7
Revises: cfef885e1a08
Create Date: 2026-02-15 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "a2b3c4d5e6f7"
down_revision: str | Sequence[str] | None = "cfef885e1a08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID_PK = UUID(as_uuid=True)
_TZDT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_UUID_DEFAULT = sa.text("gen_random_uuid()")


def _pk_col():
    return sa.Column("id", _UUID_PK, primary_key=True, server_default=_UUID_DEFAULT)


def _ts_cols():
    return [
        sa.Column("created_at", _TZDT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _TZDT, server_default=_NOW, nullable=False),
    ]


def _fk(col_name, target, ondelete="CASCADE", nullable=False):
    return sa.Column(
        col_name,
        _UUID_PK,
        sa.ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
    )


def upgrade() -> None:
    # --- agent_templates (must be created before agents due to FK) ---
    op.create_table(
        "agent_templates",
        _pk_col(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("definition", JSONB, nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("is_official", sa.Boolean, server_default=sa.text("false")),
        sa.Column("is_public", sa.Boolean, server_default=sa.text("true")),
        sa.Column(
            "author_org_id",
            _UUID_PK,
            sa.ForeignKey("organizations.id"),
            nullable=True,
        ),
        sa.Column("install_count", sa.Integer, server_default="0"),
        sa.Column("rating", sa.Numeric(3, 2), server_default="0"),
        *_ts_cols(),
    )

    # --- agents ---
    op.create_table(
        "agents",
        _pk_col(),
        _fk("org_id", "organizations.id"),
        sa.Column(
            "created_by",
            _UUID_PK,
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("trigger_type", sa.String(50), nullable=True),
        sa.Column("trigger_config", JSONB, server_default="{}", nullable=False),
        sa.Column("is_template", sa.Boolean, server_default=sa.text("false")),
        sa.Column(
            "template_id",
            _UUID_PK,
            sa.ForeignKey("agent_templates.id"),
            nullable=True,
        ),
        sa.Column("settings", JSONB, server_default="{}", nullable=False),
        *_ts_cols(),
    )
    op.create_index("ix_agents_org_id", "agents", ["org_id"])
    op.create_index("ix_agents_status", "agents", ["status"])

    # --- agent_versions ---
    op.create_table(
        "agent_versions",
        _pk_col(),
        _fk("agent_id", "agents.id"),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("definition", JSONB, nullable=False),
        sa.Column("change_message", sa.Text, nullable=True),
        sa.Column(
            "created_by",
            _UUID_PK,
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("is_published", sa.Boolean, server_default=sa.text("false")),
        *_ts_cols(),
        sa.UniqueConstraint("agent_id", "version"),
    )
    op.create_index("ix_agent_versions_agent_id", "agent_versions", ["agent_id"])

    # --- agent_nodes ---
    op.create_table(
        "agent_nodes",
        _pk_col(),
        _fk("agent_version_id", "agent_versions.id"),
        sa.Column("node_type", sa.String(50), nullable=False),
        sa.Column("node_subtype", sa.String(100), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("config", JSONB, server_default="{}", nullable=False),
        sa.Column("position_x", sa.Float, server_default="0"),
        sa.Column("position_y", sa.Float, server_default="0"),
        *_ts_cols(),
    )
    op.create_index("ix_agent_nodes_agent_version_id", "agent_nodes", ["agent_version_id"])

    # --- agent_edges ---
    op.create_table(
        "agent_edges",
        _pk_col(),
        _fk("agent_version_id", "agent_versions.id"),
        sa.Column(
            "source_node_id",
            _UUID_PK,
            sa.ForeignKey("agent_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_node_id",
            _UUID_PK,
            sa.ForeignKey("agent_nodes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("condition", JSONB, nullable=True),
        sa.Column("label", sa.String(100), nullable=True),
        *_ts_cols(),
    )
    op.create_index("ix_agent_edges_agent_version_id", "agent_edges", ["agent_version_id"])

    # --- executions ---
    op.create_table(
        "executions",
        _pk_col(),
        _fk("agent_id", "agents.id"),
        sa.Column(
            "agent_version_id",
            _UUID_PK,
            sa.ForeignKey("agent_versions.id"),
            nullable=True,
        ),
        _fk("org_id", "organizations.id"),
        sa.Column("triggered_by", sa.String(50), nullable=True),
        sa.Column("trigger_data", JSONB, server_default="{}", nullable=False),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("started_at", _TZDT, nullable=True),
        sa.Column("completed_at", _TZDT, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("total_tokens", sa.Integer, server_default="0"),
        sa.Column("total_cost", sa.Numeric(10, 6), server_default="0"),
        sa.Column("metadata", JSONB, server_default="{}", nullable=False),
        *_ts_cols(),
    )
    op.create_index("ix_executions_agent_id", "executions", ["agent_id"])
    op.create_index("ix_executions_org_id", "executions", ["org_id"])
    op.create_index("ix_executions_status", "executions", ["status"])
    op.create_index("ix_executions_created_at", "executions", ["created_at"])

    # --- execution_steps ---
    op.create_table(
        "execution_steps",
        _pk_col(),
        _fk("execution_id", "executions.id"),
        sa.Column(
            "node_id",
            _UUID_PK,
            sa.ForeignKey("agent_nodes.id"),
            nullable=True,
        ),
        sa.Column("step_order", sa.Integer, nullable=True),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("input_data", JSONB, nullable=True),
        sa.Column("output_data", JSONB, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("tokens_used", sa.Integer, server_default="0"),
        sa.Column("cost", sa.Numeric(10, 6), server_default="0"),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("started_at", _TZDT, nullable=True),
        sa.Column("completed_at", _TZDT, nullable=True),
        *_ts_cols(),
    )
    op.create_index("ix_execution_steps_execution_id", "execution_steps", ["execution_id"])

    # --- execution_logs ---
    op.create_table(
        "execution_logs",
        _pk_col(),
        _fk("execution_id", "executions.id"),
        sa.Column(
            "step_id",
            _UUID_PK,
            sa.ForeignKey("execution_steps.id"),
            nullable=True,
        ),
        sa.Column("level", sa.String(20), server_default="info"),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("data", JSONB, nullable=True),
        *_ts_cols(),
    )
    op.create_index("ix_execution_logs_execution_id", "execution_logs", ["execution_id"])


def downgrade() -> None:
    op.drop_table("execution_logs")
    op.drop_table("execution_steps")
    op.drop_table("executions")
    op.drop_table("agent_edges")
    op.drop_table("agent_nodes")
    op.drop_table("agent_versions")
    op.drop_table("agents")
    op.drop_table("agent_templates")
