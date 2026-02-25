from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"

class Shot(BaseModel):
    episode_id: str
    shot_id: str
    video_main_subject: str
    video_shoot_desc: str
    video_duration_sec: int = 5
    video_use_voice_duration: bool = False
    
    # Optional fields for customization
    camera: Optional[str] = None
    lighting: Optional[str] = None
    style: Optional[str] = None
    
class ShotVideoPoolItem(BaseModel):
    id: str
    url: str
    status: TaskStatus
    created_at: str
    meta: Optional[Dict] = Field(default_factory=dict)
    score: Optional[float] = None
    
class TaskResult(BaseModel):
    task_id: str
    status: TaskStatus
    progress: float = 0.0
    error: Optional[str] = None
    
class FinalResult(BaseModel):
    episode_id: str
    shot_id: str
    task_id: Optional[str] = None
    selected_video: Optional[ShotVideoPoolItem] = None
    video_pool: List[ShotVideoPoolItem] = Field(default_factory=list)
    logs: List[Dict] = Field(default_factory=list)
    error: Optional[str] = None
