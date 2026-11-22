"""VoxShield AI — Production FastAPI Backend Application (Per-User Accounts & SQLite Storage)."""

import os
import time
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

import torch
import numpy as np
import soundfile as sf
from pydantic import BaseModel
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Header,
    Depends,
    Query
)
from fastapi.middleware.cors import CORSMiddleware

from app.audio_utils import decode_audio_bytes, simulate_telephony, generate_spectrogram_b64
from app.ai_engine import AIEngine
from app.storage import (
    create_user,
    authenticate_user,
    get_user_by_token,
    delete_session,
    get_voiceprints_by_user,
    get_voiceprint_by_id,
    add_voiceprint,
    delete_voiceprint,
    get_incidents_by_user,
    add_incident,
    get_contact_by_id
)

engine = AIEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes neural models on application startup."""
    print("=" * 65)
    print("  VoxShield AI Forensic Engine starting up...")
    print(f"  Target Device: {engine.device} ({engine.gpu_name})")
    print("=" * 65)
    engine.load_models()
    yield
    print("[VoxShield AI] Shutting down.")


app = FastAPI(
    title="VoxShield AI Forensic Engine",
    description="Real-Time AI Voice Cloning Detection & Forensic Verification API",
    version="2.1.0",
    lifespan=lifespan
)

# CORS setup for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Authentication Dependencies & Request Models
# -------------------------------------------------------------
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Extracts authenticated user if Bearer token is provided."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return None
    return get_user_by_token(token)


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Strictly enforces authentication for user-scoped endpoints."""
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in to your VoxShield account."
        )
    return user


# -------------------------------------------------------------
# System Diagnostics
# -------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    """System health check and GPU diagnostics."""
    vram_mb = 0.0
    if torch.cuda.is_available():
        vram_mb = round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2)

    return {
        "status": "ok",
        "service": "VoxShield AI Forensic Engine",
        "cuda_available": torch.cuda.is_available(),
        "gpu_name": engine.gpu_name,
        "models_loaded": engine.is_loaded,
        "vram_allocated_mb": vram_mb,
        "startup_time": datetime.now(timezone.utc).isoformat()
    }


# -------------------------------------------------------------
# User Authentication Endpoints
# -------------------------------------------------------------
@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    """Registers a new user account with isolated voiceprint and incident storage."""
    try:
        res = create_user(req.name, req.email, req.password)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """Authenticates user credentials and generates a new session token."""
    res = authenticate_user(req.email, req.password)
    if not res:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return res


@app.post("/api/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Terminates active session token."""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        delete_session(token)
    return {"success": True, "message": "Logged out successfully."}


@app.get("/api/auth/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns profile for currently authenticated user."""
    return {"user": current_user}


# -------------------------------------------------------------
# Contact Voiceprints (Scoped strictly by user_id)
# -------------------------------------------------------------
@app.post("/api/enroll-contact")
async def enroll_contact(
    name: str = Form(...),
    relation: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Enrolls a trusted contact's reference voiceprint into the user's biometric vault."""
    try:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file provided.")

        audio = decode_audio_bytes(raw_bytes, target_sr=16000)
        if len(audio) < int(0.5 * 16000):
            raise HTTPException(status_code=400, detail="Audio too short for enrollment (minimum 0.5s required).")

        embedding = engine.extract_embedding(audio, sr=16000)
        contact_id = f"cnt_{uuid.uuid4().hex[:8]}"

        contact = add_voiceprint(
            user_id=current_user["id"],
            contact_id=contact_id,
            name=name.strip(),
            relation=relation.strip(),
            embedding=embedding
        )

        return {
            "success": True,
            "message": f"Successfully enrolled voiceprint for {name}.",
            "contact": contact
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voiceprint enrollment failed: {str(e)}")


@app.get("/api/contacts")
async def get_contacts(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieves all registered trusted contacts belonging to the authenticated user."""
    contacts = get_voiceprints_by_user(current_user["id"])
    summary = []
    for c in contacts:
        summary.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "relation": c.get("relation"),
            "created_at": c.get("created_at"),
            "has_embedding": bool(c.get("embedding"))
        })
    return summary


@app.delete("/api/contacts/{contact_id}")
async def delete_contact_endpoint(
    contact_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Removes an enrolled contact from the user's vault."""
    success = delete_voiceprint(user_id=current_user["id"], contact_id=contact_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found.")
    return {"success": True, "message": f"Contact {contact_id} deleted."}


# -------------------------------------------------------------
# File Audio Forensic Analysis (Audio Lab)
# -------------------------------------------------------------
@app.post("/api/analyze-file")
async def analyze_file(
    file: UploadFile = File(...),
    claimed_contact_id: Optional[str] = Form(None),
    simulate_telephony_channel: bool = Form(False, alias="simulate_telephony"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """Executes full 3-layer forensic analysis on an uploaded audio file."""
    t0 = time.perf_counter()
    try:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file uploaded.")

        # Step 1: Universal audio decoding (16kHz mono float32)
        audio = decode_audio_bytes(raw_bytes, target_sr=16000)
        if len(audio) < 4000:
            raise HTTPException(status_code=400, detail="Audio too short for forensic analysis (min 0.25s).")

        # Save decoded audio for developer inspection
        debug_wav_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "debug_last_chunk.wav")
        try:
            sf.write(debug_wav_path, audio, 16000, format="WAV", subtype="PCM_16")
        except Exception:
            pass

        # Optional Indian telephony simulation (ONLY if explicitly requested)
        if simulate_telephony_channel:
            audio = simulate_telephony(audio, sr=16000)

        # Step 2: Mel-spectrogram & Forensic Acoustic Telemetry
        spectrogram_b64, telemetry = generate_spectrogram_b64(audio, sr=16000)
        duration_sec = telemetry["duration_sec"]
        rms = telemetry["rms_energy"]

        # Strict Silence Gate (< 0.004 RMS or < 0.6s)
        if rms < 0.004 or duration_sec < 0.6:
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            print(f"[CHECK] rms={rms:.5f} dur={duration_sec:.2f}s fake_prob=0.00% real_prob=100.00% state=STANDBY", flush=True)
            return {
                "threat_state": "STANDBY",
                "risk_score": 0.0,
                "ai_clone_detection": {
                    "peak_score": 0.0,
                    "average_score": 0.0,
                    "timeline": []
                },
                "voiceprint_verification": {
                    "claimed_contact_id": claimed_contact_id,
                    "claimed_contact_name": None,
                    "similarity_pct": None
                },
                "scam_intent": {
                    "transcript": "",
                    "matched_keywords": []
                },
                "acoustic_telemetry": telemetry,
                "spectrogram_image": spectrogram_b64,
                "active_prevention": {
                    "liveness_challenges": [],
                    "forensic_hash": None
                },
                "latency_ms": latency_ms
            }

        # Step 3: Layer 1 - Anti-Spoofing Detection
        spoof_res = engine.analyze_spoofing(audio, sr=16000)
        peak_fake_score = spoof_res["peak_fake_score"]
        avg_fake_score = spoof_res["average_fake_score"]
        fake_prob = spoof_res["fake_prob"]
        real_prob = spoof_res["real_prob"]
        timeline = spoof_res["timeline"]

        # Step 4: Layer 2 - Voiceprint Verification (Scoped by current_user)
        voiceprint_similarity: Optional[float] = None
        claimed_contact = None
        has_claimed = bool(claimed_contact_id and claimed_contact_id.strip())

        if has_claimed:
            cid = claimed_contact_id.strip()
            if current_user:
                claimed_contact = get_voiceprint_by_id(current_user["id"], cid)
            else:
                claimed_contact = get_contact_by_id(cid)

            if claimed_contact and claimed_contact.get("embedding"):
                current_emb = engine.extract_embedding(audio, sr=16000)
                voiceprint_similarity = engine.compare_voiceprint(current_emb, claimed_contact["embedding"])

        # Step 5: Layer 3 - Speech Transcription & Scam Intent Gate
        nlp_res = engine.transcribe_and_scan(audio)
        transcript = nlp_res["transcript"]
        matched_keywords = nlp_res["matched_keywords"]

        # Step 6: Risk Fusion
        fusion = engine.fuse_risk(
            ai_score=peak_fake_score,
            voiceprint_similarity=voiceprint_similarity,
            claimed_contact_id=claimed_contact_id,
            matched_keywords=matched_keywords,
            audio_bytes=raw_bytes,
            rms=rms,
            duration_sec=duration_sec
        )

        latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        print(f"[CHECK] rms={rms:.5f} dur={duration_sec:.2f}s fake_prob={fake_prob:.2f}% real_prob={real_prob:.2f}% state={fusion['threat_state']}", flush=True)

        # Log incident if threat detected
        if fusion["threat_state"] not in ("VERIFIED_SAFE", "STANDBY") and current_user:
            incident = {
                "id": f"inc_{uuid.uuid4().hex[:8]}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "threat_state": fusion["threat_state"],
                "risk_score": fusion["risk_score"],
                "ai_score": peak_fake_score,
                "voiceprint_match": voiceprint_similarity,
                "claimed_contact": claimed_contact.get("name") if claimed_contact else None,
                "matched_keywords": matched_keywords,
                "transcript": transcript,
                "challenges": fusion["liveness_challenges"],
                "forensic_hash": fusion["forensic_hash"],
                "telemetry": telemetry
            }
            add_incident(user_id=current_user["id"], incident=incident)

        return {
            "threat_state": fusion["threat_state"],
            "risk_score": fusion["risk_score"],
            "ai_clone_detection": {
                "peak_score": peak_fake_score,
                "average_score": avg_fake_score,
                "timeline": timeline
            },
            "voiceprint_verification": {
                "claimed_contact_id": claimed_contact_id,
                "claimed_contact_name": claimed_contact.get("name") if claimed_contact else None,
                "similarity_pct": voiceprint_similarity
            },
            "scam_intent": {
                "transcript": transcript,
                "matched_keywords": matched_keywords
            },
            "acoustic_telemetry": telemetry,
            "spectrogram_image": spectrogram_b64,
            "active_prevention": {
                "liveness_challenges": fusion["liveness_challenges"],
                "forensic_hash": fusion["forensic_hash"]
            },
            "latency_ms": latency_ms
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forensic file analysis failed: {str(e)}")


@app.get("/api/incidents")
async def get_incidents(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieves forensic incident audit ledger for authenticated user."""
    return get_incidents_by_user(current_user["id"])


# -------------------------------------------------------------
# Real-Time WebSocket Audio Stream (Live Call Shield)
# -------------------------------------------------------------
@app.websocket("/ws/live-analyze")
async def live_analyze_stream(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """Real-time bi-directional WebSocket audio analysis stream."""
    await websocket.accept()
    claimed_contact_id: Optional[str] = None
    simulate_telephony_channel = False

    # Resolve authenticated user from query parameter or initial config frame
    current_user: Optional[Dict[str, Any]] = get_user_by_token(token) if token else None

    try:
        while True:
            message = await websocket.receive()

            # Handle JSON Control Messages
            if "text" in message and message["text"]:
                try:
                    import json
                    cfg = json.loads(message["text"])
                    if cfg.get("type") == "config":
                        claimed_contact_id = cfg.get("claimed_contact_id")
                        simulate_telephony_channel = bool(cfg.get("simulate_telephony", False))
                        config_token = cfg.get("token")
                        if config_token and not current_user:
                            current_user = get_user_by_token(config_token)

                        await websocket.send_json({
                            "type": "config_ack",
                            "claimed_contact_id": claimed_contact_id,
                            "simulate_telephony": simulate_telephony_channel,
                            "authenticated": bool(current_user)
                        })
                        continue
                except Exception:
                    pass

            # Handle Binary Audio Chunks
            if "bytes" in message and message["bytes"]:
                t_start = time.perf_counter()
                chunk_bytes = message["bytes"]

                try:
                    audio = decode_audio_bytes(chunk_bytes, target_sr=16000)
                    if len(audio) < 4000:
                        await websocket.send_json({
                            "type": "chunk_skipped",
                            "reason": "buffer_too_short"
                        })
                        continue

                    # Save last chunk for debugging
                    debug_wav_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "debug_last_chunk.wav")
                    try:
                        sf.write(debug_wav_path, audio, 16000, format="WAV", subtype="PCM_16")
                    except Exception:
                        pass

                    if simulate_telephony_channel:
                        audio = simulate_telephony(audio, sr=16000)

                    duration_sec = round(len(audio) / 16000, 2)
                    rms = float(np.sqrt(np.mean(audio**2))) if len(audio) > 0 else 0.0

                    # Silence Gate (< 0.004 RMS or < 0.6s)
                    if rms < 0.004 or duration_sec < 0.6:
                        chunk_latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
                        print(f"[CHECK] rms={rms:.5f} dur={duration_sec:.2f}s fake_prob=0.00% real_prob=100.00% state=STANDBY", flush=True)
                        await websocket.send_json({
                            "type": "telemetry",
                            "threat_state": "STANDBY",
                            "risk_score": 0.0,
                            "ai_score": 0.0,
                            "voiceprint_match": None,
                            "transcript": "",
                            "matched_keywords": [],
                            "challenges": [],
                            "forensic_hash": None,
                            "duration_sec": duration_sec,
                            "latency_ms": chunk_latency_ms
                        })
                        continue

                    # Layer 1: Anti-Spoofing
                    spoof_res = engine.analyze_spoofing(audio, sr=16000)
                    peak_fake_score = spoof_res["peak_fake_score"]
                    fake_prob = spoof_res["fake_prob"]
                    real_prob = spoof_res["real_prob"]

                    # Layer 2: Voiceprint Match (Scoped strictly by user)
                    voiceprint_similarity: Optional[float] = None
                    has_claimed = bool(claimed_contact_id and claimed_contact_id.strip())
                    if has_claimed:
                        cid = claimed_contact_id.strip()
                        if current_user:
                            contact = get_voiceprint_by_id(current_user["id"], cid)
                        else:
                            contact = get_contact_by_id(cid)

                        if contact and contact.get("embedding"):
                            curr_emb = engine.extract_embedding(audio, sr=16000)
                            voiceprint_similarity = engine.compare_voiceprint(curr_emb, contact["embedding"])

                    # Layer 3: Speech transcription & scam intent
                    nlp_res = engine.transcribe_and_scan(audio)
                    transcript = nlp_res["transcript"]
                    matched_keywords = nlp_res["matched_keywords"]

                    # Risk Fusion
                    fusion = engine.fuse_risk(
                        ai_score=peak_fake_score,
                        voiceprint_similarity=voiceprint_similarity,
                        claimed_contact_id=claimed_contact_id,
                        matched_keywords=matched_keywords,
                        audio_bytes=chunk_bytes,
                        rms=rms,
                        duration_sec=duration_sec
                    )

                    chunk_latency_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
                    print(f"[CHECK] rms={rms:.5f} dur={duration_sec:.2f}s fake_prob={fake_prob:.2f}% real_prob={real_prob:.2f}% state={fusion['threat_state']}", flush=True)

                    # Log incident if threat detected
                    if fusion["threat_state"] not in ("VERIFIED_SAFE", "STANDBY") and current_user:
                        incident = {
                            "id": f"inc_{uuid.uuid4().hex[:8]}",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "threat_state": fusion["threat_state"],
                            "risk_score": fusion["risk_score"],
                            "ai_score": peak_fake_score,
                            "voiceprint_match": voiceprint_similarity,
                            "matched_keywords": matched_keywords,
                            "transcript": transcript,
                            "challenges": fusion["liveness_challenges"],
                            "forensic_hash": fusion["forensic_hash"]
                        }
                        add_incident(user_id=current_user["id"], incident=incident)

                    # Stream back live result
                    await websocket.send_json({
                        "type": "telemetry",
                        "threat_state": fusion["threat_state"],
                        "risk_score": fusion["risk_score"],
                        "ai_score": peak_fake_score,
                        "voiceprint_match": voiceprint_similarity,
                        "transcript": transcript,
                        "matched_keywords": matched_keywords,
                        "challenges": fusion["liveness_challenges"],
                        "forensic_hash": fusion["forensic_hash"],
                        "duration_sec": duration_sec,
                        "latency_ms": chunk_latency_ms
                    })
                except Exception as stream_err:
                    await websocket.send_json({
                        "type": "error",
                        "message": str(stream_err)
                    })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[VoxShield AI WS] Connection closed: {e}")
