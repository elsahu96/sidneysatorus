"""
Subprocess entrypoint for investigations.

Spawned by investigate.py via asyncio.create_subprocess_exec so the
LangGraph pipeline runs in a separate OS process that can be SIGKILL-ed.

Writes the report json_path to stdout on success, nothing on failure.
Exit codes: 0 = success, 1 = error.
"""

import sys
import argparse


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--thread-id", required=True)
    args = parser.parse_args()

    # Imports are deferred so startup cost is paid only when actually running
    from dotenv import load_dotenv
    load_dotenv()

    from src.graph.flow import run_with_hitl

    result = run_with_hitl(task=args.query, thread_id=args.thread_id, auto_approve=True)
    if result:
        print(result, end="")
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
