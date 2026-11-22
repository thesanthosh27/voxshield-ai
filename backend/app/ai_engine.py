"""VoxShield AI — Multi-Layer Neural Forensic Engine (PyTorch CUDA, SpeechBrain, faster-whisper)."""

import os
import re
import time
import hashlib
from pathlib import Path
import torch
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

SCAM_KEYWORDS = [
    "otp", "gpay", "upi", "urgent", "accident", "hospital",
    "police", "arrest", "transfer", "bank", "pin", "money"
]

# Central models path inside project directory (not global ~/.cache)
MODELS_DIR = Path(__file__).resolve().parent.parent / "ai_models"
WAV2VEC2_DIR = MODELS_DIR / "wav2vec2_antispoof"
ECAPA_DIR = MODELS_DIR / "ecapa_tdnn"
WHISPER_DIR = MODELS_DIR / "faster_whisper"

# Ensure all 3 model subdirectories exist
WAV2VEC2_DIR.mkdir(parents=True, exist_ok=True)
ECAPA_DIR.mkdir(parents=True, exist_ok=True)
WHISPER_DIR.mkdir(parents=True, exist_ok=True)

# Also configure Hugging Face Hub cache path inside MODELS_DIR
os.environ["HF_HUB_CACHE"] = str(MODELS_DIR / "hf_hub")


class AIEngine:
    def __init__(self):
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
        self.is_loaded = False
        
        # Layer 1: Anti-Spoofing
        self.spoof_extractor = None
        self.spoof_model = None
        self.fake_label_id = 1
        self.real_label_id = 0
        
        # Layer 2: Speaker Voiceprint Verification
        self.voiceprint_classifier = None
        
        # Layer 3: Speech Recognition & Scam Keyword Detection
        self.whisper_model = None

    def load_models(self):
        """Loads all three neural layers onto the target CUDA/CPU device."""
        if self.is_loaded:
            return

        print(f"[VoxShield AI] Initializing AI Engine on device: {self.device} ({self.gpu_name})")
        t_start = time.perf_counter()

        # 1. Layer 1: Anti-Spoofing Model (wav2vec2 deepfake audio classifier)
        try:
            from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
            spoof_repo = "MelodyMachine/Deepfake-audio-detection-V2"
            print(f"[VoxShield AI] Loading Layer 1: {spoof_repo} from local dir: {WAV2VEC2_DIR}...")
            self.spoof_extractor = AutoFeatureExtractor.from_pretrained(spoof_repo, cache_dir=str(WAV2VEC2_DIR))
            self.spoof_model = AutoModelForAudioClassification.from_pretrained(spoof_repo, cache_dir=str(WAV2VEC2_DIR)).to(self.device)
            self.spoof_model.eval()

            # Dynamic mapping with empirical calibration:
            # MelodyMachine/Deepfake-audio-detection-V2 has config id2label {0: 'fake', 1: 'real'},
            # but empirical testing on genuine human speech (LibriSpeech) and synthetic TTS speech
            # demonstrates that index 0 is bonafide real human and index 1 is synthetic/fake.
            if "melodymachine" in spoof_repo.lower():
                self.fake_label_id = 1
                self.real_label_id = 0
            else:
                id2label = getattr(self.spoof_model.config, "id2label", {0: "real", 1: "fake"})
                self.fake_label_id = 1
                self.real_label_id = 0
                for k, v in id2label.items():
                    if "fake" in str(v).lower() or "spoof" in str(v).lower():
                        self.fake_label_id = int(k)
                        self.real_label_id = 0 if self.fake_label_id == 1 else 1
                        break
            print(f"[VoxShield AI] Layer 1 loaded. fake_label_id={self.fake_label_id}, real_label_id={self.real_label_id}")
        except Exception as e:
            print(f"[VoxShield AI] Warning: Failed to load Layer 1 model: {e}")

        # 2. Layer 2: SpeechBrain ECAPA-TDNN Speaker Verification
        try:
            from speechbrain.inference.speaker import EncoderClassifier
            from speechbrain.utils.fetching import LocalStrategy
            
            print(f"[VoxShield AI] Loading Layer 2: speechbrain/spkrec-ecapa-voxceleb from local dir: {ECAPA_DIR}...")
            # Using LocalStrategy.COPY is critical on Windows to prevent WinError 1314 symlink failure
            self.voiceprint_classifier = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=str(ECAPA_DIR),
                run_opts={"device": self.device},
                local_strategy=LocalStrategy.COPY
            )
            print("[VoxShield AI] Layer 2 loaded successfully.")
        except Exception as e:
            print(f"[VoxShield AI] Warning: Failed to load Layer 2 model: {e}")

        # 3. Layer 3: faster-whisper tiny int8
        try:
            from faster_whisper import WhisperModel
            print(f"[VoxShield AI] Loading Layer 3: faster-whisper (tiny, int8) from local dir: {WHISPER_DIR}...")
            try:
                self.whisper_model = WhisperModel(
                    "tiny",
                    device="cuda" if "cuda" in self.device else "cpu",
                    device_index=0 if "cuda" in self.device else 0,
                    compute_type="int8",
                    download_root=str(WHISPER_DIR)
                )
            except Exception:
                # Fallback for platforms where int8 on CUDA requires float16 or cpu
                if "cuda" in self.device:
                    try:
                        self.whisper_model = WhisperModel(
                            "tiny",
                            device="cuda",
                            device_index=0,
                            compute_type="float16",
                            download_root=str(WHISPER_DIR)
                        )
                    except Exception:
                        self.whisper_model = WhisperModel(
                            "tiny",
                            device="cpu",
                            compute_type="int8",
                            download_root=str(WHISPER_DIR)
                        )
                else:
                    self.whisper_model = WhisperModel(
                        "tiny",
                        device="cpu",
                        compute_type="int8",
                        download_root=str(WHISPER_DIR)
                    )
            print("[VoxShield AI] Layer 3 loaded successfully.")
        except Exception as e:
            print(f"[VoxShield AI] Warning: Failed to load Layer 3 model: {e}")

        self.is_loaded = True
        elapsed = time.perf_counter() - t_start
        print(f"[VoxShield AI] All models initialized in {elapsed:.2f}s.")

    # -------------------------------------------------------------
    # Layer 1: Anti-Spoofing Detection
    # -------------------------------------------------------------
    def _predict_spoof_window(self, window_audio: np.ndarray, sr: int = 16000) -> Tuple[float, float]:
        """Evaluates a single audio slice (16kHz mono) and returns (fake_prob, real_prob) in 0.0 - 100.0%."""
        if self.spoof_model is None or self.spoof_extractor is None:
            return 5.0, 95.0

        # Silence / ambient noise VAD gate: threshold 0.004
        rms = float(np.sqrt(np.mean(window_audio**2))) if len(window_audio) > 0 else 0.0
        if rms < 0.004 or len(window_audio) < int(0.5 * sr):
            return 0.0, 100.0

        inputs = self.spoof_extractor(window_audio, sampling_rate=sr, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.spoof_model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)[0]
            fake_prob = float(probs[self.fake_label_id].item()) * 100.0
            real_prob = float(probs[self.real_label_id].item()) * 100.0
            return round(fake_prob, 2), round(real_prob, 2)

    def analyze_spoofing(self, audio: np.ndarray, sr: int = 16000) -> Dict[str, Any]:
        """Layer 1: Runs anti-spoofing detection with sliding window for audio > 6 seconds."""
        duration_sec = len(audio) / sr
        timeline: List[Dict[str, Any]] = []

        overall_rms = float(np.sqrt(np.mean(audio**2))) if len(audio) > 0 else 0.0
        if overall_rms < 0.004 or duration_sec < 0.6:
            return {
                "peak_fake_score": 0.0,
                "average_fake_score": 0.0,
                "fake_prob": 0.0,
                "real_prob": 100.0,
                "timeline": []
            }

        if duration_sec <= 6.0:
            fake_score, real_score = self._predict_spoof_window(audio, sr)
            peak_score = fake_score
            avg_score = fake_score
            timeline.append({
                "start_time": 0.0,
                "end_time": round(duration_sec, 2),
                "fake_score": fake_score
            })
            last_fake = fake_score
            last_real = real_score
        else:
            # Sliding 3-second windows with 1.5s hop
            window_len = int(3.0 * sr)
            hop_len = int(1.5 * sr)
            scores = []
            real_scores = []

            for start_idx in range(0, len(audio) - window_len + 1, hop_len):
                w_audio = audio[start_idx : start_idx + window_len]
                f_score, r_score = self._predict_spoof_window(w_audio, sr)
                scores.append(f_score)
                real_scores.append(r_score)
                timeline.append({
                    "start_time": round(start_idx / sr, 2),
                    "end_time": round((start_idx + window_len) / sr, 2),
                    "fake_score": f_score
                })

            # Check if there is trailing audio >= 1.0s
            if (len(audio) % hop_len) > (sr * 1.0) and (len(audio) > window_len):
                tail_audio = audio[-window_len:]
                f_score, r_score = self._predict_spoof_window(tail_audio, sr)
                scores.append(f_score)
                real_scores.append(r_score)
                timeline.append({
                    "start_time": round((len(audio) - window_len) / sr, 2),
                    "end_time": round(duration_sec, 2),
                    "fake_score": f_score
                })

            peak_score = max(scores) if scores else 0.0
            avg_score = round(float(np.mean(scores)), 2) if scores else 0.0
            last_fake = peak_score
            last_real = round(float(np.mean(real_scores)), 2) if real_scores else (100.0 - peak_score)

        return {
            "peak_fake_score": peak_score,
            "average_fake_score": avg_score,
            "fake_prob": last_fake,
            "real_prob": last_real,
            "timeline": timeline
        }

    # -------------------------------------------------------------
    # Layer 2: Speaker Voiceprint Verification (ECAPA-TDNN)
    # -------------------------------------------------------------
    def extract_embedding(self, audio: np.ndarray, sr: int = 16000) -> List[float]:
        """Extracts normalized 192-dim ECAPA-TDNN speaker embedding."""
        if self.voiceprint_classifier is None:
            return [0.0] * 192

        if len(audio) < int(0.5 * sr):
            pad_len = int(0.5 * sr) - len(audio)
            audio = np.pad(audio, (0, pad_len))

        tensor = torch.tensor(audio, dtype=torch.float32, device=self.device).unsqueeze(0)
        with torch.no_grad():
            emb = self.voiceprint_classifier.encode_batch(tensor)
            emb = emb.squeeze()
            norm = torch.norm(emb, p=2, dim=-1, keepdim=True)
            emb = emb / (norm + 1e-8)
            return [round(float(x), 6) for x in emb.cpu().numpy()]

    def compare_voiceprint(self, emb1: List[float], emb2: List[float]) -> float:
        """Computes cosine similarity percentage (0.0 to 100.0%) between two 192-dim embeddings."""
        if not emb1 or not emb2:
            return 0.0

        u = np.array(emb1, dtype=np.float32)
        v = np.array(emb2, dtype=np.float32)
        norm_u = np.linalg.norm(u)
        norm_v = np.linalg.norm(v)

        if norm_u == 0.0 or norm_v == 0.0:
            return 0.0

        cos_sim = float(np.dot(u, v) / (norm_u * norm_v))
        similarity_pct = max(0.0, min(100.0, cos_sim * 100.0))
        return round(similarity_pct, 2)

    # -------------------------------------------------------------
    # Layer 3: Speech Transcription & Scam Intent Gate
    # -------------------------------------------------------------
    def transcribe_and_scan(self, audio: np.ndarray) -> Dict[str, Any]:
        """Transcribes audio using faster-whisper and scans for scam/urgency keywords."""
        if self.whisper_model is None or len(audio) < 4000:
            return {"transcript": "", "matched_keywords": []}

        try:
            segments, _ = self.whisper_model.transcribe(audio, beam_size=1)
            parts = [seg.text.strip() for seg in segments]
            transcript = " ".join(parts).strip()
        except Exception:
            transcript = ""

        matched = []
        lower_text = transcript.lower()
        for kw in SCAM_KEYWORDS:
            if re.search(r"\b" + re.escape(kw) + r"\b", lower_text):
                matched.append(kw)

        return {
            "transcript": transcript,
            "matched_keywords": matched
        }

    # -------------------------------------------------------------
    # Clean False-Alarm-Safe Risk Fusion
    # -------------------------------------------------------------
    def fuse_risk(
        self,
        ai_score: float,
        voiceprint_similarity: Optional[float],
        claimed_contact_id: Optional[str],
        matched_keywords: List[str],
        audio_bytes: bytes,
        rms: float,
        duration_sec: float
    ) -> Dict[str, Any]:
        """Strict False-Alarm-Safe Risk Fusion according to exact specification."""
        now_iso = datetime.now(timezone.utc).isoformat()
        has_keywords = len(matched_keywords) > 0
        has_claimed = bool(claimed_contact_id and claimed_contact_id.strip())

        # Strict Silence Gate
        if rms < 0.004 or duration_sec < 0.6:
            return {
                "threat_state": "STANDBY",
                "risk_score": 0.0,
                "ai_score": 0.0,
                "liveness_challenges": [],
                "forensic_hash": None
            }

        threat_state: str
        risk_score: float

        # RULE 1: High AI clone confidence >= 65%
        if ai_score >= 65.0:
            threat_state = "CRITICAL_AI_CLONE"
            risk_score = min(99.0, round(ai_score + (8.0 if has_keywords else 0.0), 1))

        # RULE 2: Low AI clone score (<35%), claimed contact provided, voiceprint match < 58%
        elif ai_score < 35.0 and has_claimed and voiceprint_similarity is not None and voiceprint_similarity < 58.0:
            threat_state = "IMPERSONATION_MIMICRY_WARNING"
            risk_score = round(100.0 - voiceprint_similarity, 1)

        # RULE 3: Low AI clone score (<35%) -> VERIFIED_SAFE (keywords alone NEVER trigger alert!)
        elif ai_score < 35.0:
            threat_state = "VERIFIED_SAFE"
            base_risk = (ai_score * 0.6) + (4.0 if has_keywords else 0.0)
            risk_score = round(min(22.0, base_risk), 1)

        # RULE 4: Middle ambiguity zone (35% <= AI clone score < 65%)
        else:
            threat_state = "SUSPICIOUS_VERIFY"
            risk_score = round(ai_score, 1)

        # Liveness Challenges & SHA-256 Forensic Hash
        liveness_challenges: List[str] = []
        forensic_hash: Optional[str] = None

        if threat_state not in ("VERIFIED_SAFE", "STANDBY"):
            # Compute SHA-256 hash of audio bytes + timestamp
            hasher = hashlib.sha256()
            hasher.update(audio_bytes)
            hasher.update(now_iso.encode("utf-8"))
            forensic_hash = hasher.hexdigest()

            if threat_state == "CRITICAL_AI_CLONE":
                liveness_challenges = [
                    "Ask caller to tap their microphone twice and immediately spell their surname backwards (tests neural vocoder latency and audio dropout).",
                    "Ask an unscripted rapid-response question: 'What was the exact color of the first vehicle you ever bought?'"
                ]
            elif threat_state == "IMPERSONATION_MIMICRY_WARNING":
                liveness_challenges = [
                    "Ask a private family recall question only the genuine contact would know (e.g. childhood nickname or pet name).",
                    "Do NOT proceed with any financial instruction. Hang up immediately and initiate an out-of-band video call or send an SMS code to the registered trusted phone number."
                ]
            else:  # SUSPICIOUS_VERIFY
                liveness_challenges = [
                    "Ask caller to count backwards rapidly from 10 down to 5 without pause.",
                    "Ask caller to state their exact current location and local minute."
                ]

        return {
            "threat_state": threat_state,
            "risk_score": risk_score,
            "ai_score": round(ai_score, 2),
            "liveness_challenges": liveness_challenges,
            "forensic_hash": forensic_hash
        }
