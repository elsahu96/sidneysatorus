from pathlib import Path as _Path


def _load_md_prompt(filename: str) -> str:
    """Extract the triple-quoted string content from a prompt .md file."""
    return (_Path(__file__).parent / filename).read_text(encoding="utf-8")


def format_prompt(prompt: str, **kwargs) -> str:
    """Substitute named placeholders using string replacement.

    Safe alternative to str.format() for prompts that contain JSON examples
    with bare { } braces, which would cause KeyError with str.format().
    """
    for key, value in kwargs.items():
        prompt = prompt.replace("{" + key + "}", value)
    return prompt


PLANNING_AGENT_PROMPT = _load_md_prompt("planning_agent.md")
PLAN_REVIEWER_AGENT_PROMPT = _load_md_prompt("planning_review.md")

RESEARCH_AGENT_PROMPT = _load_md_prompt("research_agent.md")
WRITER_AGENT_PROMPT = _load_md_prompt("writer_agent.md")
QUICK_SEARCH_PLANNING_AGENT_PROMPT = _load_md_prompt("quick_planning_agent.md")
QUICK_SEARCH_WRITER_AGENT_PROMPT = _load_md_prompt("quick_writing_agent.md")
QUICK_SEARCH_RESEARCH_AGENT_PROMPT = _load_md_prompt("quick_research_agent.md")
