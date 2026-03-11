import json
import os
import pathlib
from datetime import datetime
from langchain_core.tools import tool

# Project root is 4 levels up from this file:
# tools/ -> graph/ -> src/ -> backend/ -> <project_root>
_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[4]
_DEFAULT_REPORT_DIR = _PROJECT_ROOT / "reports"

# Side-channel storage: populated when write_report runs so callers
# higher up the stack (e.g. run_with_hitl) can retrieve the paths
# without having to parse LLM-generated text.
_last_write_result: dict = {}


@tool
def write_report(report: str, filename: str = "") -> str:
    """
    Write a finished investigation report to disk as both a markdown file and a
    companion JSON file.

    Args:
        report:   The full report content in markdown format.
        filename: Optional filename (without extension). Defaults to a timestamped name.

    Returns:
        A JSON string with keys ``md_path`` and ``json_path`` pointing to the
        written files.
    """
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}"

    stem = filename.removesuffix(".md")

    env_dir = os.environ.get("REPORT_OUTPUT_DIR")
    output_dir = pathlib.Path(env_dir).resolve() if env_dir else _DEFAULT_REPORT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    md_path = output_dir / f"{stem}.md"
    json_path = output_dir / f"{stem}.json"

    with md_path.open("w", encoding="utf-8") as f:
        f.write(report)

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(
            {"content": report, "written_at": datetime.now().isoformat()},
            f,
            ensure_ascii=False,
            indent=2,
        )

    result = {"md_path": str(md_path), "json_path": str(json_path)}
    _last_write_result.update(result)
    return json.dumps(result)
