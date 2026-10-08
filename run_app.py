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

def main():
    parser = argparse.ArgumentParser(description="MedSynapse 2.0 AI Diagnostic Launcher")
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
    print("🏥 MedSynapse 2.0: AI Multi-Disease Platform & Medical Report OCR")
    print("=" * 65)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(base_dir, "frontend", "dist")

    # If dist is not built, build it
    if not os.path.exists(dist_dir):
        print("📦 Building React frontend production bundle...")
        subprocess.run(["npm", "run", "build"], cwd=os.path.join(base_dir, "frontend"), check=True)

    url = f"http://localhost:{port}"
    print(f"\n🚀 MedSynapse Server is running at: {url}")
    print("📡 Diagnostic Modules: Smart Lab Report OCR + Diabetes + Heart + Pneumonia X-Ray")
    print("💡 Press Ctrl+C to stop the server\n")

    if not args.no_browser:
        time.sleep(0.8)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    subprocess.run([sys.executable, "-m", "uvicorn", "backend.main:app", "--host", args.host, "--port", str(port), "--reload"])

if __name__ == "__main__":
    main()
