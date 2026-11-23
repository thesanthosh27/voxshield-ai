import modal

app = modal.App("voxshield-ai-backend")

MODEL_ZIP_URL = (
    "https://github.com/thesanthosh27/voxshield-ai/releases/download/"
    "v1.0-models/ai_models.zip"
)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "curl", "unzip")
    .pip_install_from_requirements("requirements.txt")
    .run_commands(
        "mkdir -p /root/ai_models/hf_hub /root/data",
        f"curl -L --fail -o /tmp/ai_models.zip {MODEL_ZIP_URL}",
        "unzip -q /tmp/ai_models.zip -d /root/ai_models",
        "rm /tmp/ai_models.zip",
        "ls -la /root/ai_models",
    )
    .add_local_dir("app", remote_path="/root/app")
)


@app.function(
    image=image,
    cpu=4.0,
    memory=4096,
    secrets=[modal.Secret.from_name("voxshield-secrets")],
    scaledown_window=60,
    timeout=600,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app():
    import sys

    if "/root" not in sys.path:
        sys.path.insert(0, "/root")
    from app.main import app as web_app

    return web_app