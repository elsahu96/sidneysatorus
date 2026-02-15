# Reporter Agent

The Reporter Agent is an LlmAgent that synthesizes intelligence reports from search results and file uploads, then generates professional HTML and PDF outputs using the `generate_report_files` custom tool.

## Architecture

The Reporter Agent uses:
- **LlmAgent**: Powered by Google Gemini to synthesize markdown reports
- **Custom Tool**: `generate_report_files` that converts markdown to HTML/PDF

## generate_report_files Tool

### Purpose

Converts synthesized markdown text to professional HTML and PDF reports using:
1. **Markdown to HTML**: Converts markdown with professional CSS styling
2. **HTML to PDF**: Uses Playwright (headless Chromium) to render HTML and generate PDF

### Input Parameters

```python
generate_report_files(
    markdown_text: str,                    # Required: Synthesized markdown content
    file_uploads: Optional[List[Dict]] = None,  # Optional: List of uploaded files
    session_id: Optional[str] = None       # Optional: Session ID for file naming
)
```

**File Uploads Format:**
```python
[
    {
        "filename": "document.pdf",
        "content": "base64_encoded_content",
        "mime_type": "application/pdf"
    }
]
```

### Output

Returns a dictionary with:
```python
{
    "status": "success",
    "html_content": "<html>...</html>",  # Full HTML string
    "pdf_path": "/tmp/reports/report_abc123.pdf",
    "html_path": "/tmp/reports/report_abc123.html",
    "message": "Report files generated successfully"
}
```

### Features

- **Professional CSS Styling**: Modern, responsive design with:
  - Gradient backgrounds for summaries
  - Styled entity badges
  - Source cards with hover effects
  - Print-optimized styles
  - Professional typography

- **PDF Generation**: Uses Playwright for high-quality PDF output:
  - A4 format
  - Professional margins
  - Print background enabled
  - CSS page size support

- **File Attachments**: Supports including uploaded files in the report

## Usage Example

```python
from src.agents.reporter import create_reporter_agent
from google.adk.runner import InMemoryRunner

# Create the reporter agent
reporter = create_reporter_agent()

# Create runner and session
runner = InMemoryRunner(reporter, "reporter")
session = runner.session_service().create_session("reporter", "user123")

# Ensure session state has research_context and search_results
session.state["research_context"] = {...}
session.state["search_results"] = {...}

# Run the agent
query = "Generate a report from the research context and search results"
events = runner.run_async("user123", session.id, query)

# Access results
report_data = session.state.get("report_data")
if report_data:
    html_content = report_data.get("html_content")
    pdf_path = report_data.get("pdf_path")
```

## Setup

### Install Playwright

```bash
pip install playwright
playwright install chromium
```

### Environment Variables

```bash
REPORT_OUTPUT_DIR=/tmp/reports  # Optional, defaults to /tmp/reports
GEMINI_MODEL=gemini-2.0-flash   # Optional, defaults to gemini-2.0-flash
```

## A2A Artifacts

The tool returns both HTML content and PDF file paths as A2A artifacts:
- **HTML Content**: Full HTML string that can be streamed or served directly
- **PDF Path**: File system path to the generated PDF file

These artifacts are accessible to consuming agents via the A2A protocol.

## CSS Styling

The generated HTML includes professional CSS with:
- Responsive design
- Print media queries
- Professional color scheme (blues and grays)
- Styled tables, code blocks, and blockquotes
- Entity badges and source cards
- Gradient backgrounds for emphasis

## Error Handling

The tool returns error information in the response dictionary:
```python
{
    "status": "error",
    "error_message": "Error description",
    "html_content": None,
    "pdf_path": None,
    "html_path": None
}
```
