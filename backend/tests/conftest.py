import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Default to DB-skipped startup during local test runs unless explicitly disabled.
os.environ.setdefault("ENGAGEAI_SKIP_DB_CONNECT", "1")
