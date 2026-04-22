"""
Subprocess entrypoint for investigations.

Spawned by investigate.py via asyncio.create_subprocess_exec so the
LangGraph pipeline runs in a separate OS process that can be SIGKILL-ed.

stdout protocol:
  PROGRESS:{agent_name}   — agent is starting
  HITL:{json}             — waiting for user review (stdin)
  RESULT:{json_path}      — success
  CANCELLED               — user rejected a stage
  ERROR:{message}         — unrecoverable error

stdin:  one JSON line per HITL, e.g.:
  {"approved": true}
  {"approved": true, "edited_content": "Modified plan..."}
  {"approved": true, "additional_urls": ["https://..."]}

Exit codes: 0 = success or cancelled, 1 = error.
"""

import json
import sys
import argparse


def _on_progress(agent_name: str) -> None:
    print(f"PROGRESS:{agent_name}", flush=True)


_HITL_CONTENT_LIMIT = (
    50_000  # chars — cap per-field to keep the stdout line under 10 MB
)
_HITL_SOURCES_LIMIT = 60  # max sources to include in the HITL payload


def _truncate_hitl(data: dict) -> dict:
    """Trim large fields so the serialised HITL line stays well inside the stream limit."""
    out = dict(data)
    if (
        isinstance(out.get("content"), str)
        and len(out["content"]) > _HITL_CONTENT_LIMIT
    ):
        out["content"] = out["content"][:_HITL_CONTENT_LIMIT] + "\n\n[truncated]"
    if (
        isinstance(out.get("sources"), list)
        and len(out["sources"]) > _HITL_SOURCES_LIMIT
    ):
        out["sources"] = out["sources"][:_HITL_SOURCES_LIMIT]
    return out


def _on_hitl(hitl_data: dict) -> dict:
    """Send HITL event to stdout, block until decision arrives on stdin."""
    print(f"HITL:{json.dumps(_truncate_hitl(hitl_data))}", flush=True)
    try:
        line = sys.stdin.readline().strip()
        return json.loads(line)
    except Exception:
        return {"approved": False}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--thread-id", required=True)
    parser.add_argument("--quick-search", action="store_true", default=False)
    args = parser.parse_args()

    from dotenv import load_dotenv

    load_dotenv()

    try:
        from src.graph.flow import run_pipeline_stages
    except Exception as exc:
        print(f"ERROR:Failed to load investigation engine: {exc}", flush=True)
        sys.exit(1)

    try:
        result = run_pipeline_stages(
            task=args.query,
            thread_id=args.thread_id,
            on_progress=_on_progress,
            on_hitl=_on_hitl,
            quick_search=args.quick_search,
        )
    except Exception as exc:
        import traceback

        traceback.print_exc(file=sys.stderr)  # full traceback → Cloud Run logs
        print(f"ERROR:Investigation engine error: {exc}", flush=True)
        sys.exit(1)

    if result:
        print(f"RESULT:{result}", flush=True)
        sys.exit(0)
    else:
        print("CANCELLED", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
