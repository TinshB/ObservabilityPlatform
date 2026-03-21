"""Generate Python gRPC stubs from .proto files."""

import subprocess
import sys
from pathlib import Path

PROTO_DIR = Path(__file__).parent / "protos"
OUT_DIR = Path(__file__).parent / "generated"

def main():
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "__init__.py").touch()

    proto_files = list(PROTO_DIR.glob("*.proto"))
    if not proto_files:
        print("No .proto files found in", PROTO_DIR)
        sys.exit(1)

    for proto in proto_files:
        print(f"Generating stubs for {proto.name}...")
        subprocess.check_call([
            sys.executable, "-m", "grpc_tools.protoc",
            f"--proto_path={PROTO_DIR}",
            f"--python_out={OUT_DIR}",
            f"--grpc_python_out={OUT_DIR}",
            str(proto),
        ])

    print(f"Generated stubs in {OUT_DIR}")

if __name__ == "__main__":
    main()
