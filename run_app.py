import subprocess
import sys
import os
import time
import argparse
import socket
import webbrowser

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def find_available_port(start_port: int) -> int:
    port = start_port
    while port < start_port + 100:
        if not is_port_in_use(port):
            return port
        port += 1
    return start_port

def ensure_models_extracted(base_dir: str):
    import zipfile
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    required_artifacts = {
        "diabetes_model.pkl": "diabetes_artifacts.zip",
        "heart_model.pkl": "heart_artifacts.zip",
        "chest_xray_model.keras": "chest_xray_artifacts.zip",
        "brain_tumor_model.keras": "brain_tumor_artifacts.zip",
        "kidney_stone_efficientnet_model.keras": "kidney_stone_artifacts.zip",
        "skin_cancer_model.keras": "skin_cancer_artifacts.zip",
        "eye_disease_traced_model.pt": "eye_disease_artifacts.zip",
        "liver_model.pkl": "liver_disease_artifacts.zip",
        "breast_cancer_model.pkl": "breast_cancer_artifacts.zip",
    }

    missing = [f for f in required_artifacts if not os.path.exists(os.path.join(models_dir, f))]
    if not missing:
        return

    print("📦 Extracting missing disease model artifacts...")
    search_dirs = [models_dir, os.path.abspath(os.path.join(base_dir, "..", "models"))]

    for req_file in missing:
        zip_name = required_artifacts[req_file]
        zip_path = None
        for sdir in search_dirs:
            candidate = os.path.join(sdir, zip_name)
            if os.path.exists(candidate):
                zip_path = candidate
                break
        if not zip_path:
            continue

        try:
            with zipfile.ZipFile(zip_path, "r") as z:
                if req_file == "diabetes_model.pkl":
                    for m in z.namelist():
                        if m.endswith("diabetes_model.pkl") and not m.startswith("__MACOSX"):
                            with open(os.path.join(models_dir, "diabetes_model.pkl"), "wb") as f:
                                f.write(z.read(m))
                        elif m.endswith("diabetes_scaler.pkl") and not m.startswith("__MACOSX"):
                            with open(os.path.join(models_dir, "diabetes_scaler.pkl"), "wb") as f:
                                f.write(z.read(m))
                else:
                    for m in z.namelist():
                        if not m.startswith("__MACOSX") and not m.endswith("/"):
                            target_filename = m
                            if m == "classes.json":
                                prefix = zip_name.replace("_artifacts.zip", "")
                                target_filename = f"{prefix}_classes.json"
                            elif m == "metrics.json":
                                prefix = zip_name.replace("_artifacts.zip", "")
                                target_filename = f"{prefix}_metrics.json"
                            with open(os.path.join(models_dir, target_filename), "wb") as f:
                                f.write(z.read(m))
        except Exception as e:
            print(f"⚠️ Warning: Failed extracting {zip_name}: {e}")

    # Create alias for pneumonia if needed
    chest_keras = os.path.join(models_dir, "chest_xray_model.keras")
    xray_alias = os.path.join(models_dir, "xrays_pneumonia.keras")
    if os.path.exists(chest_keras) and not os.path.exists(xray_alias):
        try:
            os.symlink("chest_xray_model.keras", xray_alias)
        except Exception:
            pass

def main():
    parser = argparse.ArgumentParser(description="MedSynapse AI Diagnostic Launcher")
    parser.add_argument("--port", "-p", type=int, default=int(os.environ.get("PORT", 8080)), help="Port to run the application on (default: 8080)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface to bind to (default: 0.0.0.0)")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open the browser")
    args = parser.parse_args()

    port = args.port
    if is_port_in_use(port):
        new_port = find_available_port(port + 1)
        print(f"⚠️ Port {port} is currently in use. Automatically switching to available port {new_port}...")
        port = new_port

    print("=" * 65)
    print("🏥 MedSynapse: AI Multi-Disease Platform & Medical Report OCR")
    print("=" * 65)

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Automatically extract model artifacts if not present
    ensure_models_extracted(base_dir)

    dist_dir = os.path.join(base_dir, "frontend", "dist")
    frontend_dir = os.path.join(base_dir, "frontend")
    node_modules_dir = os.path.join(frontend_dir, "node_modules")

    # Install frontend dependencies if not present
    if not os.path.exists(node_modules_dir):
        print("📦 Installing frontend dependencies...")
        subprocess.run(["npm", "install"], cwd=frontend_dir, check=True)

    # If dist is not built, build it
    if not os.path.exists(dist_dir):
        print("📦 Building React frontend production bundle...")
        subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)

    url = f"http://localhost:{port}"
    print(f"\n🚀 MedSynapse Server is running at: {url}")
    print("📡 Diagnostic Modules: All 9 AI Disease Models Active (Diabetes, Heart, Pneumonia, Brain Tumor, Kidney CT, Skin Cancer, Liver, Eye, Breast)")
    print("💡 Press Ctrl+C to stop the server\n")

    if not args.no_browser:
        time.sleep(0.8)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    subprocess.run([sys.executable, "-m", "uvicorn", "backend.main:app", "--host", args.host, "--port", str(port), "--reload", "--reload-dir", "backend"])

if __name__ == "__main__":
    main()
