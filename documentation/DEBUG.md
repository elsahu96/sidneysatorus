# Sidney — Debug Log

This file records production and development bugs using Root Cause Analysis (RCA) methodology.
Each entry is a permanent record. Never delete entries; mark them resolved and add follow-ups.

---

## Template

```
### [BUG-NNN] Short title (YYYY-MM-DD)

**Status:** Open | Resolved | Monitoring
**Severity:** P0 Critical | P1 High | P2 Medium | P3 Low
**Component:** e.g. backend/api, graph/flow, frontend/ChatInterface

#### Symptom
What the user saw or what alert fired. Exact error message if available.

#### Timeline
- HH:MM — first observed
- HH:MM — investigated
- HH:MM — fix deployed

#### Root Cause
One or two sentences. What was actually broken and why.

#### Contributing Factors
Bullet list of conditions that allowed this bug to exist.

#### Evidence
Log lines, stack traces, or test output that confirmed the root cause.

#### Fix
What changed and in which files.

#### Verification
How the fix was confirmed to work.

#### Follow-up / Prevention
What should be done to stop this class of bug recurring.
```

---

## Bug Log

---

### [BUG-001] "Separator is not found, and chunk exceed the limit" crashes investigation (2026-04-13)

**Status:** Resolved
**Severity:** P0 Critical — every investigation with a non-trivial research phase failed
**Component:** `backend/src/api/investigate.py`, `backend/src/service/investigate_runner.py`

#### Symptom

Frontend toast: `Investigation failed: Separator is not found, and chunk exceed the limit`

The error surfaced after the research-agent finished its AskNews searches (~60–90 s into an investigation) and the pipeline attempted to hand off results to the writer-agent via the HITL prompt.

#### Timeline

- 20:30:07 — investigation started (pak-afghan border query)
- 20:30:09 — planning-agent started
- 20:30:27 — research-agent started; parallel AskNews searches began
- 20:31:54 — final Gemini call completed (research summary generated)
- 20:31:54 — `asyncio.exceptions.LimitOverrunError` raised; subprocess reader crashed
- 20:31:54 — frontend received `ERROR:` event, displayed toast

#### Root Cause

`asyncio.create_subprocess_exec` wraps the subprocess stdout in an `asyncio.StreamReader` with a default buffer limit of **64 KB** (65,536 bytes). When `investigate_runner.py` printed the HITL payload as a single newline-terminated JSON line:

```
HITL:{"agent": "research-agent", "content": "<30 KB research summary>", "sources": [...100 articles...], ...}
```

the line exceeded 64 KB. Python's `StreamReader.readline()` raised `LimitOverrunError: Separator is not found, and chunk exceed the limit` — the very same error message previously assumed to be a Gemini API chunk error.

#### Contributing Factors

- The error message `Separator is not found, and chunk exceed the limit` is also the text of a **Gemini API** error, which led previous investigation to focus on sanitising LLM payloads rather than the subprocess I/O layer.
- The HITL protocol sends everything over stdout as a single line per event — no streaming, no chunking — so payload size is unbounded.
- `research_summary` (up to 30 KB) + `sources` list (100 articles × ~400 bytes each = 40 KB) easily exceeded the 64 KB limit on complex queries.
- No tests covered the subprocess I/O path with a large HITL payload.

#### Evidence

```
2026-04-13 20:31:54 [ERROR] src.api.investigate: Unexpected error in investigation thread_id=1db6dcc8...
Traceback (most recent call last):
  File ".../asyncio/streams.py", line 550, in readline
    line = await self.readuntil(sep)
  File ".../asyncio/streams.py", line 628, in readuntil
    raise exceptions.LimitOverrunError(
asyncio.exceptions.LimitOverrunError: Separator is not found, and chunk exceed the limit

During handling of the above exception, another exception occurred:
  File ".../backend/src/api/investigate.py", line 92, in _run_investigation
    line_bytes = await proc.stdout.readline()
ValueError: Separator is not found, and chunk exceed the limit
```

#### Fix

**`backend/src/api/investigate.py`** — Raised the asyncio stream buffer from the default 64 KB to 10 MB:

```python
proc = await asyncio.create_subprocess_exec(
    ...,
    limit=10 * 1024 * 1024,   # 10 MB — default 64 KB too small for large HITL payloads
)
```

**`backend/src/service/investigate_runner.py`** — Added `_truncate_hitl()` as defense-in-depth to cap `content` at 50,000 chars and `sources` at 60 entries before serialising the HITL line:

```python
_HITL_CONTENT_LIMIT = 50_000
_HITL_SOURCES_LIMIT = 60

def _truncate_hitl(data: dict) -> dict:
    out = dict(data)
    if isinstance(out.get("content"), str) and len(out["content"]) > _HITL_CONTENT_LIMIT:
        out["content"] = out["content"][:_HITL_CONTENT_LIMIT] + "\n\n[truncated]"
    if isinstance(out.get("sources"), list) and len(out["sources"]) > _HITL_SOURCES_LIMIT:
        out["sources"] = out["sources"][:_HITL_SOURCES_LIMIT]
    return out

def _on_hitl(hitl_data: dict) -> dict:
    print(f"HITL:{json.dumps(_truncate_hitl(hitl_data))}", flush=True)
```

#### Verification

- Reran the same pak-afghan border query; investigation completed and report was written.
- Research summary at ~28 KB + 87 sources: total HITL line confirmed <50 KB after truncation.

#### Follow-up / Prevention

- [ ] Add an integration test that sends a `>64 KB` HITL payload through the subprocess protocol and asserts no crash.
- [ ] Consider replacing the single-line HITL stdout protocol with a length-prefixed or newline-delimited JSON-stream protocol so the limit is irrelevant.
- [ ] Add a comment in `asknews.py` / `writer.py` clarifying that `"Separator is not found"` can originate from **either** the Gemini API or Python's asyncio StreamReader — check the stack trace to distinguish them.
