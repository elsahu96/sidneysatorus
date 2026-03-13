from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class Report(BaseModel):
    id: str
    name: str
    storage_path: str  # 'reports/2024/q1.pdf'
    mime_type: str
    created_at: Optional[datetime] = None
