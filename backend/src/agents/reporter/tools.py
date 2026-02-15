"""
Custom tools for Reporter Agent: generate_report_files tool.
"""

import os
import base64
from typing import Dict, Any, Optional, List
from pathlib import Path
from markdown import markdown
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()


def generate_report_files(
    markdown_text: str,
    file_uploads: Optional[List[Dict[str, Any]]] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Converts markdown text to professional HTML and generates a PDF report.
    
    This tool takes synthesized markdown content and optional binary file uploads,
    converts the markdown to a clean HTML template with professional CSS styling,
    and then uses a headless browser (Playwright) to print the HTML to PDF.
    
    Args:
        markdown_text (str): The synthesized markdown text content for the report.
        file_uploads (List[Dict[str, Any]], optional): List of uploaded files with structure:
            [
                {
                    "filename": "file.pdf",
                    "content": "base64_encoded_content",
                    "mime_type": "application/pdf"
                }
            ]
        session_id (str, optional): Session ID for file naming. If not provided, generates a unique ID.
    
    Returns:
        Dict[str, Any]: A dictionary containing:
            {
                "status": "success",
                "html_content": "<html>...</html>",  # Full HTML string
                "pdf_path": "/path/to/report.pdf",    # Path to generated PDF file
                "html_path": "/path/to/report.html"   # Path to generated HTML file
            }
    """
    try:
        # Setup output directory
        output_dir = Path(os.getenv("REPORT_OUTPUT_DIR", "/tmp/reports"))
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique session ID if not provided
        if not session_id:
            import uuid
            session_id = str(uuid.uuid4())[:8]
        
        # Convert markdown to HTML with professional styling
        html_content = _markdown_to_html(markdown_text, file_uploads)
        
        # Save HTML file
        html_path = output_dir / f"report_{session_id}.html"
        html_path.write_text(html_content, encoding='utf-8')
        
        # Generate PDF using Playwright
        pdf_path = output_dir / f"report_{session_id}.pdf"
        _html_to_pdf_sync(html_content, str(pdf_path))
        
        return {
            "status": "success",
            "html_content": html_content,
            "pdf_path": str(pdf_path),
            "html_path": str(html_path),
            "message": "Report files generated successfully"
        }
    
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e),
            "html_content": None,
            "pdf_path": None,
            "html_path": None
        }


def _markdown_to_html(markdown_text: str, file_uploads: Optional[List[Dict[str, Any]]] = None) -> str:
    """
    Convert markdown text to professional HTML with CSS styling.
    
    Args:
        markdown_text: The markdown content to convert
        file_uploads: Optional list of file uploads to include
    
    Returns:
        Complete HTML document as string
    """
    # Convert markdown to HTML
    html_body = markdown(markdown_text, extensions=['extra', 'codehilite', 'tables'])
    
    # Professional CSS styling
    css_styles = """
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                         'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                         sans-serif;
            line-height: 1.6;
            color: #333;
            background: #ffffff;
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1 {
            color: #1a1a1a;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 30px;
            font-size: 2.5em;
            font-weight: 700;
        }
        
        h2 {
            color: #2563eb;
            margin-top: 40px;
            margin-bottom: 20px;
            font-size: 1.8em;
            font-weight: 600;
            border-left: 4px solid #2563eb;
            padding-left: 15px;
        }
        
        h3 {
            color: #475569;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.4em;
            font-weight: 600;
        }
        
        h4 {
            color: #64748b;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 1.2em;
            font-weight: 600;
        }
        
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        
        .summary {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 25px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
            margin: 30px 0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .entity {
            display: inline-block;
            margin: 5px 10px 5px 0;
            padding: 8px 15px;
            background: #e0e7ff;
            border-radius: 20px;
            font-size: 0.9em;
            color: #4338ca;
            font-weight: 500;
        }
        
        .source {
            margin: 15px 0;
            padding: 15px;
            border-left: 3px solid #2563eb;
            background: #f8fafc;
            border-radius: 4px;
        }
        
        .source a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;
        }
        
        .source a:hover {
            text-decoration: underline;
        }
        
        .source small {
            color: #64748b;
            font-size: 0.85em;
        }
        
        ul, ol {
            margin: 15px 0 15px 30px;
        }
        
        li {
            margin-bottom: 8px;
        }
        
        code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            color: #e11d48;
        }
        
        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        pre code {
            background: transparent;
            color: inherit;
            padding: 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        th {
            background: #2563eb;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        tr:hover {
            background: #f8fafc;
        }
        
        blockquote {
            border-left: 4px solid #2563eb;
            padding-left: 20px;
            margin: 20px 0;
            color: #475569;
            font-style: italic;
        }
        
        .file-attachment {
            background: #f8fafc;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #e2e8f0;
        }
        
        .file-attachment strong {
            color: #2563eb;
        }
        
        @media print {
            body {
                padding: 20px;
            }
            
            .summary {
                page-break-inside: avoid;
            }
            
            h2 {
                page-break-after: avoid;
            }
        }
    </style>
    """
    
    # Build file attachments section if files are provided
    file_section = ""
    if file_uploads:
        file_section = "<h2>Attached Files</h2>"
        for file_data in file_uploads:
            filename = file_data.get("filename", "unknown")
            mime_type = file_data.get("mime_type", "application/octet-stream")
            file_section += f"""
            <div class="file-attachment">
                <strong>📎 {filename}</strong><br>
                <small>Type: {mime_type}</small>
            </div>
            """
    
    # Construct full HTML document
    html_document = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Intelligence Report</title>
    {css_styles}
</head>
<body>
    {html_body}
    {file_section}
</body>
</html>
    """
    
    return html_document


def _html_to_pdf_sync(html_content: str, pdf_path: str):
    """
    Convert HTML content to PDF using Playwright synchronously.
    
    Args:
        html_content: The HTML content as string
        pdf_path: Path where PDF should be saved
    """
    import asyncio
    
    async def _async_html_to_pdf():
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Set content and wait for it to load
            await page.set_content(html_content, wait_until="networkidle")
            
            # Generate PDF with professional settings
            await page.pdf(
                path=pdf_path,
                format="A4",
                margin={
                    "top": "20mm",
                    "right": "15mm",
                    "bottom": "20mm",
                    "left": "15mm"
                },
                print_background=True,
                prefer_css_page_size=True
            )
            
            await browser.close()
    
    # Run async function
    asyncio.run(_async_html_to_pdf())
