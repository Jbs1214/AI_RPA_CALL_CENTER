"""요청 본문 모델(여러 라우터가 같이 쓴다)."""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class AnalysisIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Optional[str] = None
    category: Optional[str] = None
    customer_question: Optional[str] = None
    action_taken: Optional[str] = None
    follow_up_needed: Optional[bool] = None
    needs_review: Optional[bool] = None
    confidence: Optional[float] = Field(None, ge=0, le=1)
    transcript: Optional[str] = None
    analysis_json: Optional[Any] = None
    error_message: Optional[str] = None


class CallIn(AnalysisIn):
    called_at: datetime
    agent_name: str
    source_filename: str
    file_hash: str
    customer_company: Optional[str] = None
    customer_phone: Optional[str] = None


class CallPatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category: Optional[str] = None
    customer_question: Optional[str] = None
    action_taken: Optional[str] = None
    follow_up_needed: Optional[bool] = None
    needs_review: Optional[bool] = None
    customer_company: Optional[str] = None
    customer_phone: Optional[str] = None


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message: str
    history: list[ChatTurn] = []                   # 선택. 최근 6개만 쓰고 AI 방식에서만 쓴다
