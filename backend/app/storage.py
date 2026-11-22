"""VoxShield AI — SQLite Persistent Storage Engine (Per-User Isolation & Auth)."""

import os
import sqlite3
import json
import uuid
import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DATA_DIR, "voxshield.db")
os.makedirs(DATA_DIR, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Initializes tables for users, sessions, voiceprints, and incidents."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS voiceprints (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                relation TEXT NOT NULL,
                embedding_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_voiceprints_user ON voiceprints(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_incidents_user ON incidents(user_id);")
        conn.commit()


# Initialize database schema immediately on module load
init_db()


# -------------------------------------------------------------
# Password Cryptography (Standard Library PBKDF2-HMAC-SHA256)
# -------------------------------------------------------------
def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hashes password with 100,000 PBKDF2 iterations and cryptographically random salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_bytes = password.encode("utf-8")
    salt_bytes = bytes.fromhex(salt)
    dk = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt_bytes, 100000)
    return dk.hex(), salt


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    """Constant-time comparison against stored PBKDF2 hash."""
    try:
        calculated_hash, _ = hash_password(password, salt=salt_hex)
        return hmac.compare_digest(calculated_hash, hash_hex)
    except Exception:
        return False


# -------------------------------------------------------------
# User Account Management
# -------------------------------------------------------------
def create_user(name: str, email: str, password: str) -> Dict[str, Any]:
    """Registers a new user account and returns user info + session token."""
    clean_email = email.strip().lower()
    clean_name = name.strip()
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid email address is required.")
    if not clean_name:
        raise ValueError("Name cannot be empty.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    pwd_hash, salt = hash_password(password)
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (id, name, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, clean_name, clean_email, pwd_hash, salt, created_at)
            )
            # Create immediate active session
            token = secrets.token_hex(32)
            cursor.execute(
                "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                (token, user_id, created_at)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise ValueError(f"An account with email '{clean_email}' already exists.")

    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": clean_name,
            "email": clean_email
        }
    }


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Validates user credentials and generates a new session token."""
    clean_email = email.strip().lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, email, password_hash, salt FROM users WHERE email = ?",
            (clean_email,)
        )
        row = cursor.fetchone()
        if not row:
            return None

        if not verify_password(password, row["salt"], row["password_hash"]):
            return None

        token = secrets.token_hex(32)
        created_at = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, row["id"], created_at)
        )
        conn.commit()

        return {
            "token": token,
            "user": {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"]
            }
        }


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    """Looks up authenticated user by bearer session token."""
    if not token or not isinstance(token, str):
        return None
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.name, u.email
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        """, (token.strip(),))
        row = cursor.fetchone()
        if row:
            return {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"]
            }
        return None


def delete_session(token: str) -> bool:
    """Invalidates session on user sign out."""
    if not token:
        return False
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token.strip(),))
        conn.commit()
        return cursor.rowcount > 0


# -------------------------------------------------------------
# Biometric Voiceprint Vault (Scoped strictly by user_id)
# -------------------------------------------------------------
def get_voiceprints_by_user(user_id: str) -> List[Dict[str, Any]]:
    """Retrieves all enrolled voiceprints belonging to the specified user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, relation, embedding_json, created_at FROM voiceprints WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        result = []
        for r in rows:
            emb = None
            try:
                emb = json.loads(r["embedding_json"])
            except Exception:
                pass
            result.append({
                "id": r["id"],
                "name": r["name"],
                "relation": r["relation"],
                "created_at": r["created_at"],
                "has_embedding": bool(emb),
                "embedding": emb
            })
        return result


def get_voiceprint_by_id(user_id: str, contact_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single voiceprint for matching, verifying user ownership."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, relation, embedding_json, created_at FROM voiceprints WHERE user_id = ? AND id = ?",
            (user_id, contact_id)
        )
        r = cursor.fetchone()
        if not r:
            return None
        emb = None
        try:
            emb = json.loads(r["embedding_json"])
        except Exception:
            pass
        return {
            "id": r["id"],
            "name": r["name"],
            "relation": r["relation"],
            "created_at": r["created_at"],
            "has_embedding": bool(emb),
            "embedding": emb
        }


def add_voiceprint(user_id: str, contact_id: str, name: str, relation: str, embedding: List[float]) -> Dict[str, Any]:
    """Enrolls a voiceprint scoped strictly to the authenticated user."""
    created_at = datetime.now(timezone.utc).isoformat()
    emb_json = json.dumps(embedding)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO voiceprints (id, user_id, name, relation, embedding_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (contact_id, user_id, name.strip(), relation.strip(), emb_json, created_at)
        )
        conn.commit()

    return {
        "id": contact_id,
        "name": name.strip(),
        "relation": relation.strip(),
        "created_at": created_at,
        "has_embedding": True
    }


def delete_voiceprint(user_id: str, contact_id: str) -> bool:
    """Deletes an enrolled voiceprint, verifying ownership."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM voiceprints WHERE user_id = ? AND id = ?",
            (user_id, contact_id)
        )
        conn.commit()
        return cursor.rowcount > 0


# -------------------------------------------------------------
# Forensic Incidents (Scoped strictly by user_id)
# -------------------------------------------------------------
def get_incidents_by_user(user_id: str) -> List[Dict[str, Any]]:
    """Retrieves forensic incident history for the authenticated user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT payload_json FROM incidents WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
            (user_id,)
        )
        rows = cursor.fetchall()
        result = []
        for r in rows:
            try:
                result.append(json.loads(r["payload_json"]))
            except Exception:
                pass
        return result


def add_incident(user_id: str, incident: Dict[str, Any]) -> None:
    """Logs an incident under the user account."""
    inc_id = incident.get("id") or f"inc_{uuid.uuid4().hex[:8]}"
    created_at = incident.get("timestamp") or datetime.now(timezone.utc).isoformat()
    payload_json = json.dumps(incident)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO incidents (id, user_id, payload_json, created_at) VALUES (?, ?, ?, ?)",
            (inc_id, user_id, payload_json, created_at)
        )
        conn.commit()


# -------------------------------------------------------------
# Backwards Compatibility Helpers (Graceful fallback)
# -------------------------------------------------------------
def load_contacts(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if user_id:
        return get_voiceprints_by_user(user_id)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, relation, embedding_json, created_at FROM voiceprints ORDER BY created_at DESC")
        rows = cursor.fetchall()
        res = []
        for r in rows:
            emb = None
            try:
                emb = json.loads(r["embedding_json"])
            except Exception:
                pass
            res.append({
                "id": r["id"],
                "name": r["name"],
                "relation": r["relation"],
                "created_at": r["created_at"],
                "has_embedding": bool(emb),
                "embedding": emb
            })
        return res


def get_contact_by_id(contact_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        if user_id:
            cursor.execute("SELECT id, name, relation, embedding_json, created_at FROM voiceprints WHERE id = ? AND user_id = ?", (contact_id, user_id))
        else:
            cursor.execute("SELECT id, name, relation, embedding_json, created_at FROM voiceprints WHERE id = ?", (contact_id,))
        r = cursor.fetchone()
        if not r:
            return None
        emb = None
        try:
            emb = json.loads(r["embedding_json"])
        except Exception:
            pass
        return {
            "id": r["id"],
            "name": r["name"],
            "relation": r["relation"],
            "created_at": r["created_at"],
            "has_embedding": bool(emb),
            "embedding": emb
        }


def load_incidents(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if user_id:
        return get_incidents_by_user(user_id)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT payload_json FROM incidents ORDER BY created_at DESC LIMIT 200")
        rows = cursor.fetchall()
        res = []
        for r in rows:
            try:
                res.append(json.loads(r["payload_json"]))
            except Exception:
                pass
        return res
