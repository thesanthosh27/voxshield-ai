"""Universal Audio Decoder, Telephony Simulator, and Forensics Utilities for VoxShield AI."""

import io
import base64
import numpy as np
import scipy.signal
import soundfile as sf
import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from typing import Tuple, Dict, Any


def decode_audio_bytes(audio_bytes: bytes, target_sr: int = 16000) -> np.ndarray:
    """Decodes ANY audio format (.wav, .ogg, .mp3, .webm, .m4a) from raw bytes into a 16kHz mono float32 numpy array.
    
    Fast path: if bytes start with b'RIFF' or b'RIFX', decodes directly using soundfile (zero-corruption WAV path).
    Compressed path: uses PyAV (av) for .ogg (WhatsApp), .mp3, .webm, .m4a.
    Converts to mono float32 and uses librosa.resample ONLY if orig_sr != 16000.
    Clips amplitude cleanly in [-1.0, 1.0].
    """
    if not audio_bytes:
        return np.zeros(0, dtype=np.float32)

    # 1. Fast path for WAV / PCM RIFF headers
    if len(audio_bytes) >= 12 and (audio_bytes[:4] in (b"RIFF", b"RIFX") or audio_bytes[8:12] == b"WAVE"):
        try:
            bio = io.BytesIO(audio_bytes)
            audio, sr = sf.read(bio, dtype="float32")
            if audio.ndim > 1:
                audio = np.mean(audio, axis=-1)
            if sr != target_sr:
                audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
            return np.clip(audio.astype(np.float32), -1.0, 1.0)
        except Exception:
            pass

    # 2. PyAV for compressed containers (.ogg, .mp3, .webm, .m4a)
    try:
        import av
        bio = io.BytesIO(audio_bytes)
        container = av.open(bio)
        audio_stream = next((s for s in container.streams if s.type == "audio"), None)
        
        if audio_stream is not None:
            resampler = av.AudioResampler(format="fltp", layout="mono", rate=target_sr)
            chunks = []
            
            for packet in container.demux(audio_stream):
                for frame in packet.decode():
                    resampled = resampler.resample(frame)
                    if resampled:
                        for r in resampled:
                            arr = r.to_ndarray().flatten()
                            if arr.size > 0:
                                chunks.append(arr)
                                
            flushed = resampler.resample(None)
            if flushed:
                for r in flushed:
                    arr = r.to_ndarray().flatten()
                    if arr.size > 0:
                        chunks.append(arr)
                        
            if chunks:
                audio = np.concatenate(chunks).astype(np.float32)
                return np.clip(audio, -1.0, 1.0)
    except Exception:
        pass

    # 3. Fallback via soundfile
    try:
        bio = io.BytesIO(audio_bytes)
        audio, sr = sf.read(bio, dtype="float32")
        if audio.ndim > 1:
            audio = np.mean(audio, axis=-1)
        if sr != target_sr:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
        return np.clip(audio.astype(np.float32), -1.0, 1.0)
    except Exception as err:
        raise ValueError(f"Universal audio decoding failed for payload: {err}")


def simulate_telephony(audio: np.ndarray, sr: int = 16000) -> np.ndarray:
    """Applies realistic Indian phone-call degradation to stress-test codec resilience.
    
    Pipeline:
    1. 300Hz-3400Hz 4th-order Butterworth bandpass filter.
    2. Downsample to 8kHz and upsample back to 16kHz.
    3. Add subtle ambient telephony noise at ~18dB SNR.
    
    ONLY runs when explicitly requested as True; NEVER run by default.
    """
    if len(audio) == 0:
        return audio

    # Step 1: Bandpass filter 300Hz - 3400Hz
    sos = scipy.signal.butter(4, [300.0, 3400.0], btype="bandpass", fs=sr, output="sos")
    filtered = scipy.signal.sosfiltfilt(sos, audio)

    # Step 2: Downsample to 8kHz, then upsample back to 16kHz
    down = scipy.signal.resample_poly(filtered, up=1, down=2)
    up = scipy.signal.resample_poly(down, up=2, down=1)
    
    # Align length with original input
    if len(up) < len(audio):
        up = np.pad(up, (0, len(audio) - len(up)))
    elif len(up) > len(audio):
        up = up[:len(audio)]

    # Step 3: Add subtle ambient telephony noise at ~18dB SNR
    sig_power = float(np.mean(up ** 2))
    if sig_power > 1e-10:
        snr_linear = 10.0 ** (18.0 / 10.0)  # ~63.1
        noise_variance = sig_power / snr_linear
        noise = np.random.normal(0.0, np.sqrt(noise_variance), size=len(up)).astype(np.float32)
        degraded = up + noise
    else:
        degraded = up

    return np.clip(degraded.astype(np.float32), -1.0, 1.0)


def generate_spectrogram_b64(audio: np.ndarray, sr: int = 16000) -> Tuple[str, Dict[str, Any]]:
    """Generates an obsidian-themed Mel-spectrogram PNG base64 string + acoustic telemetry.
    
    Acoustic telemetry includes:
    - snr_db: Estimated SNR in dB
    - spectral_flatness: Mean spectral flatness (Wiener entropy)
    - pitch_variance: Variance of fundamental frequencies
    - duration_sec: Length of audio in seconds
    - zero_crossing_rate: Average zero crossing rate
    - rms_energy: Root mean square energy
    """
    duration_sec = round(len(audio) / sr, 2)
    rms_energy = float(np.sqrt(np.mean(audio**2))) if len(audio) > 0 else 0.0
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(audio))) if len(audio) > 0 else 0.0

    # Spectral flatness (Wiener entropy, measure of noisiness vs harmonic tone)
    if len(audio) >= 512:
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=audio)))
    else:
        flatness = 0.0

    # Pitch variance (F0 estimation variance)
    pitch_variance = 0.0
    if len(audio) >= 1024:
        try:
            pitches, magnitudes = librosa.piptrack(y=audio, sr=sr)
            thresh = np.median(magnitudes)
            voiced = pitches[magnitudes > thresh]
            voiced = voiced[voiced > 50]  # filter sub-audible low rumble
            if len(voiced) > 10:
                pitch_variance = float(np.var(voiced))
        except Exception:
            pitch_variance = 0.0

    # Estimated SNR (dB) using frame energy percentile estimation
    if len(audio) >= int(0.2 * sr):
        frame_len = int(0.025 * sr)
        hop_len = int(0.010 * sr)
        try:
            frames = librosa.util.frame(audio, frame_length=frame_len, hop_length=hop_len)
            frame_energies = np.mean(frames**2, axis=0)
            noise_pow = float(np.percentile(frame_energies, 10)) + 1e-12
            sig_pow = float(np.mean(frame_energies)) + 1e-12
            snr_db = round(float(10.0 * np.log10(sig_pow / noise_pow)), 2)
            snr_db = max(0.0, min(60.0, snr_db))
        except Exception:
            snr_db = 22.0
    else:
        snr_db = 20.0

    telemetry = {
        "snr_db": round(snr_db, 2),
        "spectral_flatness": round(flatness, 4),
        "pitch_variance": round(pitch_variance, 2),
        "duration_sec": duration_sec,
        "zero_crossing_rate": round(zcr, 4),
        "rms_energy": round(rms_energy, 5)
    }

    # Generate Obsidian-style Mel Spectrogram
    fig = plt.figure(figsize=(7, 2.5), dpi=90)
    ax = fig.add_subplot(111)
    fig.patch.set_facecolor("#07080A")
    ax.set_facecolor("#07080A")

    if len(audio) >= 512:
        try:
            S = librosa.feature.melspectrogram(y=audio, sr=sr, n_mels=128, fmax=8000)
            S_dB = librosa.power_to_db(S, ref=np.max)
            librosa.display.specshow(S_dB, sr=sr, x_axis=None, y_axis=None, cmap="magma", ax=ax)
        except Exception:
            ax.text(0.5, 0.5, "Spectrogram unavailable", color="#666", ha="center", va="center")
    else:
        ax.text(0.5, 0.5, "Audio buffer too short", color="#666", ha="center", va="center")

    ax.axis("off")
    plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
    plt.margins(0, 0)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0, facecolor="#07080A")
    plt.close(fig)
    buf.seek(0)
    b64_str = base64.b64encode(buf.read()).decode("utf-8")
    spectrogram_b64 = f"data:image/png;base64,{b64_str}"

    return spectrogram_b64, telemetry
