from __future__ import annotations

import logging

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 100


async def generate_embeddings(
    texts: list[str],
    model: str = "text-embedding-3-small",
) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI's API.

    Processes in batches of 100 texts per request.
    Returns a list of embedding vectors (list of floats).
    """
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("No OPENAI_API_KEY configured; returning zero vectors")
        return [[0.0] * 1536 for _ in texts]

    all_embeddings: list[list[float]] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "input": batch,
                    "model": model,
                },
            )
            response.raise_for_status()
            data = response.json()
            # Sort by index to preserve order
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            all_embeddings.extend([item["embedding"] for item in sorted_data])

    return all_embeddings
