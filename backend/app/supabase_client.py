"""
VoxShield AI — Supabase Cloud Auth & Database Client
Direct HTTP client for Supabase Auth and PostgREST endpoints.
Zero external heavy dependencies (uses standard requests library).
"""

import os
import json
import uuid
from typing import Optional, Dict, Any, List
import requests
from dotenv import load_dotenv

# Load backend/.env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def is_supabase_configured() -> bool:
    """Checks whether valid Supabase credentials have been configured."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return False
    if "YOUR_PROJECT_ID" in SUPABASE_URL or "your_supabase" in SUPABASE_SERVICE_ROLE_KEY:
        return False
    return SUPABASE_URL.startswith("http://") or SUPABASE_URL.startswith("https://")


def _get_headers(return_representation: bool = False) -> Dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if return_representation:
        headers["Prefer"] = "return=representation"
    return headers


def verify_user_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies a user token against Supabase Auth (or local storage fallback).
    Calls GET {SUPABASE_URL}/auth/v1/user with:
      apikey: SUPABASE_SERVICE_ROLE_KEY
      Authorization: Bearer {token}
    Returns user dict ('id', 'email', 'name') if valid, else None.
    """
    if not token or not token.strip():
        return None

    clean_token = token.replace("Bearer ", "").strip()

    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/auth/v1/user"
            resp = requests.get(
                url,
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {clean_token}",
                },
                timeout=5.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                user_id = data.get("id")
                email = data.get("email", "")
                user_meta = data.get("user_metadata") or {}
                name = user_meta.get("full_name") or (email.split("@")[0] if email else "User")
                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "provider": "supabase"
                }
        except Exception as e:
            print(f"[Supabase Auth] verify_user_token error: {e}")

    # Fallback to local SQLite session lookup
    try:
        from app.storage import get_user_by_token
        local_user = get_user_by_token(clean_token)
        if local_user:
            return local_user
    except Exception:
        pass

    return None


def get_user_voiceprints(user_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves all voiceprints enrolled by user_id.
    GET {SUPABASE_URL}/rest/v1/voiceprints?user_id=eq.{user_id}&select=*&order=created_at.desc
    """
    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/rest/v1/voiceprints"
            params = {
                "user_id": f"eq.{user_id}",
                "select": "*",
                "order": "created_at.desc",
            }
            resp = requests.get(url, headers=_get_headers(), params=params, timeout=5.0)
            if resp.status_code == 200:
                records = resp.json()
                results = []
                for r in records:
                    emb = r.get("embedding")
                    if isinstance(emb, str):
                        try:
                            emb = json.loads(emb)
                        except Exception:
                            emb = []
                    elif emb is None and "embedding_json" in r:
                        try:
                            emb = json.loads(r["embedding_json"])
                        except Exception:
                            emb = []

                    results.append({
                        "id": r.get("id"),
                        "name": r.get("name"),
                        "relation": r.get("relation"),
                        "created_at": r.get("created_at"),
                        "embedding": emb,
                        "has_embedding": bool(emb),
                    })
                return results
        except Exception as e:
            print(f"[Supabase REST] get_user_voiceprints error: {e}")

    # Local fallback
    try:
        from app.storage import get_voiceprints_by_user
        return get_voiceprints_by_user(user_id)
    except Exception:
        return []


def get_voiceprint_by_id(user_id: str, contact_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single voiceprint by ID scoped to user_id.
    """
    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/rest/v1/voiceprints"
            params = {
                "user_id": f"eq.{user_id}",
                "id": f"eq.{contact_id}",
                "select": "*",
            }
            resp = requests.get(url, headers=_get_headers(), params=params, timeout=5.0)
            if resp.status_code == 200:
                records = resp.json()
                if records:
                    r = records[0]
                    emb = r.get("embedding")
                    if isinstance(emb, str):
                        try:
                            emb = json.loads(emb)
                        except Exception:
                            emb = []
                    elif emb is None and "embedding_json" in r:
                        try:
                            emb = json.loads(r["embedding_json"])
                        except Exception:
                            emb = []
                    return {
                        "id": r.get("id"),
                        "name": r.get("name"),
                        "relation": r.get("relation"),
                        "created_at": r.get("created_at"),
                        "embedding": emb,
                    }
        except Exception as e:
            print(f"[Supabase REST] get_voiceprint_by_id error: {e}")

    # Local fallback
    try:
        from app.storage import get_voiceprint_by_id as local_get_vp
        return local_get_vp(user_id, contact_id)
    except Exception:
        return None


def insert_voiceprint(
    user_id: str,
    name: str,
    relation: str,
    embedding: List[float],
    contact_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Enrolls a new voiceprint for user_id.
    POST {SUPABASE_URL}/rest/v1/voiceprints with Prefer: return=representation
    """
    cid = contact_id or f"cnt_{uuid.uuid4().hex[:8]}"

    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/rest/v1/voiceprints"
            payload = {
                "id": cid,
                "user_id": user_id,
                "name": name,
                "relation": relation,
                "embedding": embedding,
            }
            resp = requests.post(
                url,
                headers=_get_headers(return_representation=True),
                json=payload,
                timeout=5.0
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                created = data[0] if isinstance(data, list) and data else payload
                return {
                    "id": created.get("id", cid),
                    "name": created.get("name", name),
                    "relation": created.get("relation", relation),
                    "created_at": created.get("created_at"),
                    "has_embedding": True,
                }
            else:
                # If error is due to column type (e.g. text instead of array/jsonb), retry with embedding_json string
                payload_str = {
                    "id": cid,
                    "user_id": user_id,
                    "name": name,
                    "relation": relation,
                    "embedding_json": json.dumps(embedding),
                }
                resp2 = requests.post(
                    url,
                    headers=_get_headers(return_representation=True),
                    json=payload_str,
                    timeout=5.0
                )
                if resp2.status_code in (200, 201):
                    data = resp2.json()
                    created = data[0] if isinstance(data, list) and data else payload_str
                    return {
                        "id": created.get("id", cid),
                        "name": created.get("name", name),
                        "relation": created.get("relation", relation),
                        "created_at": created.get("created_at"),
                        "has_embedding": True,
                    }
        except Exception as e:
            print(f"[Supabase REST] insert_voiceprint error: {e}")

    # Local fallback
    from app.storage import add_voiceprint
    return add_voiceprint(
        user_id=user_id,
        contact_id=cid,
        name=name,
        relation=relation,
        embedding=embedding
    )


def delete_voiceprint(user_id: str, contact_id: str) -> bool:
    """
    Deletes a voiceprint belonging to user_id.
    DELETE {SUPABASE_URL}/rest/v1/voiceprints?id=eq.{contact_id}&user_id=eq.{user_id}
    """
    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/rest/v1/voiceprints"
            params = {
                "id": f"eq.{contact_id}",
                "user_id": f"eq.{user_id}",
            }
            resp = requests.delete(url, headers=_get_headers(), params=params, timeout=5.0)
            if resp.status_code in (200, 204):
                return True
        except Exception as e:
            print(f"[Supabase REST] delete_voiceprint error: {e}")

    # Local fallback
    try:
        from app.storage import delete_voiceprint as local_del_vp
        return local_del_vp(user_id=user_id, contact_id=contact_id)
    except Exception:
        return False


def insert_incident(user_id: str, payload: Dict[str, Any]) -> bool:
    """
    Logs an incident report for user_id.
    POST {SUPABASE_URL}/rest/v1/incidents
    """
    inc_id = payload.get("id") or f"inc_{uuid.uuid4().hex[:8]}"

    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/rest/v1/incidents"
            doc = {
                "id": inc_id,
                "user_id": user_id,
                "payload": payload,
                "payload_json": json.dumps(payload),
                "threat_state": payload.get("threat_state"),
                "risk_score": payload.get("risk_score"),
            }
            resp = requests.post(url, headers=_get_headers(), json=doc, timeout=5.0)
            if resp.status_code in (200, 201, 204):
                return True
            else:
                # Retry with minimal schema
                doc_min = {
                    "id": inc_id,
                    "user_id": user_id,
                    "payload_json": json.dumps(payload),
                }
                resp2 = requests.post(url, headers=_get_headers(), json=doc_min, timeout=5.0)
                if resp2.status_code in (200, 201, 204):
                    return True
        except Exception as e:
            print(f"[Supabase REST] insert_incident error: {e}")

    # Local fallback
    try:
        from app.storage import add_incident
        add_incident(user_id=user_id, incident=payload)
        return True
    except Exception:
        return False


def get_user_incidents(user_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves incident logs for user_id.
    """
    if is_supabase_configured():
        try:
            url = f"{SUPABASE_URL}/rest/v1/incidents"
            params = {
                "user_id": f"eq.{user_id}",
                "select": "*",
                "order": "created_at.desc",
            }
            resp = requests.get(url, headers=_get_headers(), params=params, timeout=5.0)
            if resp.status_code == 200:
                records = resp.json()
                incidents = []
                for r in records:
                    p = r.get("payload")
                    if isinstance(p, str):
                        try:
                            p = json.loads(p)
                        except Exception:
                            p = {}
                    elif p is None and "payload_json" in r:
                        try:
                            p = json.loads(r["payload_json"])
                        except Exception:
                            p = {}
                    if isinstance(p, dict) and p:
                        incidents.append(p)
                    else:
                        incidents.append(r)
                return incidents
        except Exception as e:
            print(f"[Supabase REST] get_user_incidents error: {e}")

    # Local fallback
    try:
        from app.storage import get_incidents_by_user
        return get_incidents_by_user(user_id)
    except Exception:
        return []
