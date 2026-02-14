"""initial phase1 tables

Revision ID: cfef885e1a08
Revises:
Create Date: 2026-02-15 01:04:35.961830

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "cfef885e1a08"
down_revision: str | Sequence[str] | None = None
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


def _fk(col_name, target, ondelete="CASCADE"):
    return sa.Column(
        col_name,
        _UUID_PK,
        sa.ForeignKey(target, ondelete=ondelete),
        nullable=False,
    )


def upgrade() -> None:
    # --- organizations ---
    op.create_table(
        "organizations",
        _pk_col(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("plan", sa.String(50), server_default="starter"),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("settings", JSONB, server_default="{}", nullable=False),
        *_ts_cols(),
    )

    # --- users ---
    op.create_table(
        "users",
        _pk_col(),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("auth_provider", sa.String(50), server_default="email"),
        sa.Column("auth_provider_id", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        *_ts_cols(),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # --- org_memberships ---
    op.create_table(
        "org_memberships",
        _pk_col(),
        _fk("user_id", "users.id"),
        _fk("org_id", "organizations.id"),
        sa.Column("role", sa.String(50), server_default="member"),
        *_ts_cols(),
        sa.UniqueConstraint("user_id", "org_id"),
    )
    op.create_index("ix_org_memberships_user_id", "org_memberships", ["user_id"])
    op.create_index("ix_org_memberships_org_id", "org_memberships", ["org_id"])

    # --- teams ---
    op.create_table(
        "teams",
        _pk_col(),
        _fk("org_id", "organizations.id"),
        sa.Column("name", sa.String(255), nullable=False),
        *_ts_cols(),
    )
    op.create_index("ix_teams_org_id", "teams", ["org_id"])

    # --- team_memberships ---
    op.create_table(
        "team_memberships",
        _pk_col(),
        _fk("user_id", "users.id"),
        _fk("team_id", "teams.id"),
        *_ts_cols(),
        sa.UniqueConstraint("user_id", "team_id"),
    )
    op.create_index("ix_team_memberships_user_id", "team_memberships", ["user_id"])
    op.create_index("ix_team_memberships_team_id", "team_memberships", ["team_id"])

    # --- api_keys ---
    op.create_table(
        "api_keys",
        _pk_col(),
        _fk("org_id", "organizations.id"),
        sa.Column(
            "created_by",
            _UUID_PK,
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(10), nullable=False),
        sa.Column("scopes", sa.ARRAY(sa.String), server_default="{}", nullable=False),
        sa.Column("last_used_at", _TZDT, nullable=True),
        sa.Column("expires_at", _TZDT, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true")),
        *_ts_cols(),
    )
    op.create_index("ix_api_keys_org_id", "api_keys", ["org_id"])


def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("team_memberships")
    op.drop_table("teams")
    op.drop_table("org_memberships")
    op.drop_table("users")
    op.drop_table("organizations")
