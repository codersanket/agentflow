from __future__ import annotations

import json
import logging
from collections import defaultdict, deque
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.redis import get_redis
from engine.cost_tracker import CostTracker
from engine.executor import RetryPolicy, StepExecutor
from engine.handlers.human_handler import HumanApprovalRequiredError
from engine.providers.router import ProviderRouter
from models.agent import AgentEdge, AgentNode, AgentVersion
from models.execution import Execution
from models.organization import Organization

logger = logging.getLogger(__name__)


def _topological_sort(nodes: list[AgentNode], edges: list[AgentEdge]) -> list[AgentNode]:
    """Sort nodes in dependency order using Kahn's algorithm.

    Nodes with no incoming edges are processed first.
    """
    node_map = {n.id: n for n in nodes}
    in_degree: dict[UUID, int] = defaultdict(int)
    adjacency: dict[UUID, list[UUID]] = defaultdict(list)

    for node in nodes:
        in_degree.setdefault(node.id, 0)

    for edge in edges:
        adjacency[edge.source_node_id].append(edge.target_node_id)
        in_degree[edge.target_node_id] += 1

    queue: deque[UUID] = deque()
    for node_id, degree in in_degree.items():
        if degree == 0:
            queue.append(node_id)

    sorted_nodes: list[AgentNode] = []
    while queue:
        node_id = queue.popleft()
        if node_id in node_map:
            sorted_nodes.append(node_map[node_id])
        for neighbor in adjacency[node_id]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(sorted_nodes) != len(nodes):
        raise ValueError("Agent graph contains a cycle — cannot determine execution order")

    return sorted_nodes


class Orchestrator:
    """Builds and executes agent graphs.

    Implements a topological-sort executor that processes nodes
    in dependency order with support for conditional branching.
    Logic nodes (if/else, switch) output a branch key, and only
    edges whose label matches the branch are followed.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def run(self, execution_id: UUID) -> dict[str, Any]:
        """Run a full agent execution."""
        # Load execution with agent data
        result = await self._db.execute(select(Execution).where(Execution.id == execution_id))
        execution = result.scalar_one_or_none()
        if execution is None:
            raise ValueError(f"Execution {execution_id} not found")

        # Load agent version
        version = await self._load_agent_version(execution)

        # Mark execution as running
        execution.status = "running"
        execution.started_at = datetime.now(UTC)
        await self._db.flush()

        await self._emit_event(execution_id, "execution.started", {})

        # Load nodes and edges
        nodes_result = await self._db.execute(
            select(AgentNode).where(AgentNode.agent_version_id == version.id)
        )
        nodes = list(nodes_result.scalars().all())

        edges_result = await self._db.execute(
            select(AgentEdge).where(AgentEdge.agent_version_id == version.id)
        )
        edges = list(edges_result.scalars().all())

        # Sort nodes topologically
        sorted_nodes = _topological_sort(nodes, edges)

        # Build lookup maps for branching
        node_map = {n.id: n for n in nodes}
        incoming_edges: dict[UUID, list[AgentEdge]] = defaultdict(list)
        for edge in edges:
            incoming_edges[edge.target_node_id].append(edge)

        # Load org settings for AI provider keys
        org_result = await self._db.execute(
            select(Organization).where(Organization.id == execution.org_id)
        )
        org = org_result.scalar_one_or_none()
        org_settings = org.settings if org else {}

        # Load integration credentials into context
        integrations_ctx = await self._load_integrations(execution.org_id)

        # Build provider router from org settings / env
        provider_router = self._build_provider_router(org_settings=org_settings)
        cost_tracker = CostTracker()

        # Build retry policy from agent settings
        agent_settings = execution.metadata_ or {}
        retry_policy = RetryPolicy(
            max_retries=agent_settings.get("max_retries", 3),
        )

        step_executor = StepExecutor(
            db=self._db,
            execution_id=execution_id,
            provider_router=provider_router,
            cost_tracker=cost_tracker,
            retry_policy=retry_policy,
        )

        # Initialize context with trigger data and integrations
        context: dict[str, Any] = {
            "trigger": {"data": execution.trigger_data},
            "execution_id": str(execution_id),
            "integrations": integrations_ctx,
        }

        # Track skipped nodes for conditional branching
        skipped_nodes: set[UUID] = set()

        # Execute nodes in topological order with branching support
        try:
            for step_order, node in enumerate(sorted_nodes):
                # --- Branching logic ---
                node_incoming = incoming_edges.get(node.id, [])

                if node_incoming:
                    should_skip = self._should_skip_node(
                        node, node_incoming, node_map, skipped_nodes, context
                    )
                    if should_skip:
                        skipped_nodes.add(node.id)
                        logger.info(
                            "Skipping node %s (%s) — branch condition not met",
                            node.label or node.id,
                            node.node_type,
                        )
                        await self._emit_event(
                            execution_id,
                            "step.skipped",
                            {"node_id": str(node.id), "reason": "branch_condition"},
                        )
                        continue

                output = await step_executor.execute_node(
                    node_id=node.id,
                    node_type=node.node_type,
                    node_config=node.config,
                    context=context,
                    step_order=step_order,
                )
                # Store node output in context keyed by node label or id
                node_key = node.label or str(node.id)
                context[node_key] = {"output": output.data}

            # Mark execution as completed
            execution.status = "completed"
            execution.completed_at = datetime.now(UTC)
            execution.total_tokens = cost_tracker.total_tokens
            execution.total_cost = Decimal(str(cost_tracker.total_cost))
            await self._db.flush()

            await self._emit_event(
                execution_id,
                "execution.completed",
                {
                    "total_tokens": cost_tracker.total_tokens,
                    "total_cost": float(cost_tracker.total_cost),
                },
            )

            return {
                "status": "completed",
                "total_tokens": cost_tracker.total_tokens,
                "total_cost": float(cost_tracker.total_cost),
                "context": context,
            }

        except HumanApprovalRequiredError:
            execution.status = "waiting_approval"
            execution.total_tokens = cost_tracker.total_tokens
            execution.total_cost = Decimal(str(cost_tracker.total_cost))
            await self._db.flush()

            await self._emit_event(execution_id, "execution.waiting_approval", {})
            return {"status": "waiting_approval"}

        except Exception as exc:
            execution.status = "failed"
            execution.error_message = str(exc)
            execution.completed_at = datetime.now(UTC)
            execution.total_tokens = cost_tracker.total_tokens
            execution.total_cost = Decimal(str(cost_tracker.total_cost))
            await self._db.flush()

            await self._emit_event(
                execution_id,
                "execution.failed",
                {
                    "error": str(exc),
                },
            )
            raise

        finally:
            # Clean up provider HTTP clients
            await provider_router.close()

    def _should_skip_node(
        self,
        node: AgentNode,
        incoming: list[AgentEdge],
        node_map: dict[UUID, AgentNode],
        skipped_nodes: set[UUID],
        context: dict[str, Any],
    ) -> bool:
        """Determine whether a node should be skipped based on branch conditions.

        A node executes if at least one incoming edge is "active":
        - An edge from a non-skipped, non-logic source with no label → active
        - An edge from a logic node where edge.label matches the branch output → active
        - An edge from a skipped source → inactive
        - An edge from a logic node where edge.label doesn't match → inactive
        """
        has_active_edge = False

        for edge in incoming:
            source_id = edge.source_node_id

            # Edges from skipped nodes are inactive
            if source_id in skipped_nodes:
                continue

            source_node = node_map.get(source_id)
            if not source_node:
                continue

            # Check if this is a conditional edge from a logic node
            if source_node.node_type == "logic" and edge.label:
                source_key = source_node.label or str(source_node.id)
                logic_output = context.get(source_key, {}).get("output", {})
                branch = logic_output.get("branch")

                if branch is not None and edge.label == branch:
                    has_active_edge = True
                    break
                # Conditional edge that doesn't match — don't count as active
            else:
                # Unconditional edge from a non-skipped node → active
                has_active_edge = True
                break

        return not has_active_edge

    async def _load_agent_version(self, execution: Execution) -> AgentVersion:
        """Load the agent version for this execution."""
        if execution.agent_version_id:
            result = await self._db.execute(
                select(AgentVersion).where(AgentVersion.id == execution.agent_version_id)
            )
            version = result.scalar_one_or_none()
            if version:
                return version

        # Fallback: load the latest published version
        result = await self._db.execute(
            select(AgentVersion)
            .where(
                AgentVersion.agent_id == execution.agent_id,
                AgentVersion.is_published.is_(True),
            )
            .order_by(AgentVersion.version.desc())
            .limit(1)
        )
        version = result.scalar_one_or_none()
        if version is None:
            raise ValueError(f"No published version found for agent {execution.agent_id}")
        return version

    async def _load_integrations(self, org_id: UUID) -> dict[str, dict]:
        """Load integration credentials for the org, keyed by provider name.

        Returns a dict like {"slack": {"bot_token": "xoxb-..."}, ...}.
        """
        from models.integration import Integration

        result = await self._db.execute(
            select(Integration).where(
                Integration.org_id == org_id,
                Integration.status == "connected",
            )
        )
        integrations = result.scalars().all()

        creds_map: dict[str, dict] = {}
        for integration in integrations:
            try:
                # credentials_encrypted is currently stored as JSON text
                import json as _json

                creds = _json.loads(integration.credentials_encrypted)
            except (ValueError, TypeError):
                creds = {}
            creds_map[integration.provider] = creds

        return creds_map

    def _build_provider_router(self, org_settings: dict | None = None) -> ProviderRouter:
        """Build a ProviderRouter from org settings with env-var fallback.

        Org-level AI provider keys (stored in org.settings["ai_providers"])
        take precedence over environment variables.
        """
        from engine.providers.anthropic import AnthropicProvider
        from engine.providers.google import GoogleProvider
        from engine.providers.ollama import OllamaProvider
        from engine.providers.openai import OpenAIProvider

        ai_providers = (org_settings or {}).get("ai_providers", {})

        providers: dict = {}
        fallback_order: list[str] = []

        # OpenAI: org settings first, then env var
        openai_key = (
            ai_providers.get("openai", {}).get("api_key")
            or getattr(settings, "OPENAI_API_KEY", None)
        )
        if openai_key:
            providers["openai"] = OpenAIProvider(api_key=openai_key)
            fallback_order.append("openai")

        # Anthropic: org settings first, then env var
        anthropic_key = (
            ai_providers.get("anthropic", {}).get("api_key")
            or getattr(settings, "ANTHROPIC_API_KEY", None)
        )
        if anthropic_key:
            providers["anthropic"] = AnthropicProvider(api_key=anthropic_key)
            fallback_order.append("anthropic")

        # Google: org settings first, then env var
        google_key = (
            ai_providers.get("google", {}).get("api_key")
            or getattr(settings, "GOOGLE_API_KEY", None)
        )
        if google_key:
            providers["google"] = GoogleProvider(api_key=google_key)
            fallback_order.append("google")

        # Ollama: org settings first, then env var
        ollama_url = (
            ai_providers.get("ollama", {}).get("base_url")
            or getattr(settings, "OLLAMA_URL", None)
        )
        if ollama_url:
            providers["ollama"] = OllamaProvider(base_url=ollama_url)
            fallback_order.append("ollama")

        if not providers:
            # Default to Ollama for local dev
            providers["ollama"] = OllamaProvider()
            fallback_order.append("ollama")

        return ProviderRouter(providers=providers, fallback_order=fallback_order)

    async def _emit_event(self, execution_id: UUID, event_type: str, data: dict[str, Any]) -> None:
        """Publish an execution event via Redis pub/sub."""
        try:
            redis = await get_redis()
            channel = f"execution:{execution_id}"
            payload = json.dumps(
                {
                    "type": event_type,
                    "execution_id": str(execution_id),
                    "timestamp": datetime.now(UTC).isoformat(),
                    **data,
                }
            )
            await redis.publish(channel, payload)
        except Exception:
            logger.warning("Failed to emit event %s", event_type, exc_info=True)
