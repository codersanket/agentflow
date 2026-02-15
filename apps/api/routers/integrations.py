from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from core.redis import get_redis
from models.user import User
from schemas.integration import (
    AvailableIntegrationResponse,
    ConnectIntegrationRequest,
    IntegrationResponse,
)
from services import integration_service

router = APIRouter(prefix="/integrations", tags=["integrations"])

# ─── Standard CRUD ─────────────────────────────────────────────────


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[IntegrationResponse]:
    return await integration_service.list_integrations(db, org_id)


@router.post(
    "/{provider}/connect",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def connect_integration(
    provider: str,
    data: ConnectIntegrationRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> IntegrationResponse:
    return await integration_service.connect_integration(
        db, org_id, current_user.id, provider, data
    )


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
):
    await integration_service.disconnect_integration(db, org_id, integration_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/available", response_model=list[AvailableIntegrationResponse])
async def list_available_providers(
    _user: User = Depends(get_current_user),
) -> list[AvailableIntegrationResponse]:
    return integration_service.list_available_providers()


# ─── Slack OAuth ─────────────────────────────────────────────────

SLACK_OAUTH_AUTHORIZE = "https://slack.com/oauth/v2/authorize"
SLACK_OAUTH_ACCESS = "https://slack.com/api/oauth.v2.access"
SLACK_DEFAULT_SCOPES = "chat:write,channels:read,channels:history"
OAUTH_STATE_TTL = 600  # 10 minutes


@router.get("/slack/oauth/start")
async def slack_oauth_start(
    current_user: User = Depends(get_current_user),
    org_id: UUID = Depends(get_current_org),
    redis: Redis = Depends(get_redis),
):
    """Return the Slack OAuth URL for the frontend to open in a popup."""
    if not settings.SLACK_CLIENT_ID or not settings.SLACK_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
        )

    state = secrets.token_urlsafe(32)
    # Store state → user/org mapping in Redis with TTL
    await redis.setex(
        f"slack_oauth:{state}",
        OAUTH_STATE_TTL,
        f"{current_user.id}:{org_id}",
    )

    url = (
        f"{SLACK_OAUTH_AUTHORIZE}"
        f"?client_id={settings.SLACK_CLIENT_ID}"
        f"&scope={SLACK_DEFAULT_SCOPES}"
        f"&redirect_uri={settings.SLACK_REDIRECT_URI}"
        f"&state={state}"
    )
    return {"url": url}


@router.get("/slack/oauth/callback", response_class=HTMLResponse)
async def slack_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """Handle Slack's OAuth redirect. Exchanges code for token and closes the popup."""
    import httpx

    # Verify state
    state_data = await redis.getdel(f"slack_oauth:{state}")
    if not state_data:
        return _oauth_error_page("Invalid or expired OAuth state. Please try again.")

    user_id_str, org_id_str = state_data.split(":")
    user_id = UUID(user_id_str)
    org_id = UUID(org_id_str)

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            SLACK_OAUTH_ACCESS,
            data={
                "client_id": settings.SLACK_CLIENT_ID,
                "client_secret": settings.SLACK_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.SLACK_REDIRECT_URI,
            },
        )

    data = resp.json()
    if not data.get("ok"):
        error = data.get("error", "unknown_error")
        return _oauth_error_page(f"Slack returned an error: {error}")

    # Extract token and team info
    access_token = data.get("access_token", "")
    team_name = data.get("team", {}).get("name", "Slack")
    scopes = data.get("scope", "").split(",")

    # Store as an integration
    from schemas.integration import ConnectIntegrationRequest

    req = ConnectIntegrationRequest(
        name=team_name,
        credentials={"access_token": access_token},
        scopes=scopes,
    )
    await integration_service.connect_integration(db, org_id, user_id, "slack", req)

    return _oauth_success_page()


def _oauth_success_page() -> str:  # noqa: E501
    return (
        "<!DOCTYPE html>"
        "<html><head><title>Connected</title></head>"
        '<body style="font-family:system-ui;display:flex;'
        "align-items:center;justify-content:center;"
        'height:100vh;margin:0;background:#0a0a0a;color:#fafafa">'
        '<div style="text-align:center">'
        '<h2 style="color:#22c55e">&#10003; Slack Connected</h2>'
        "<p>This window will close automatically.</p>"
        "<script>window.opener&&window.opener.postMessage("
        "{type:'oauth_success',provider:'slack'},'*');"
        "setTimeout(()=>window.close(),1500);</script>"
        "</div></body></html>"
    )


def _oauth_error_page(message: str) -> str:
    return (
        "<!DOCTYPE html>"
        "<html><head><title>Error</title></head>"
        '<body style="font-family:system-ui;display:flex;'
        "align-items:center;justify-content:center;"
        'height:100vh;margin:0;background:#0a0a0a;color:#fafafa">'
        '<div style="text-align:center">'
        '<h2 style="color:#ef4444">&#10007; Connection Failed</h2>'
        f"<p>{message}</p>"
        "<script>window.opener&&window.opener.postMessage("
        f"{{type:'oauth_error',provider:'slack',message:'{message}'}},"
        "'*');setTimeout(()=>window.close(),3000);</script>"
        "</div></body></html>"
    )
