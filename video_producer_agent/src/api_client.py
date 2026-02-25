from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import time
import uuid
import random
from datetime import datetime
from .models import Shot, ShotVideoPoolItem, TaskResult, TaskStatus

class ApiClient(ABC):
    @abstractmethod
    def create_video_prompt(self, shot: Shot) -> str:
        pass

    @abstractmethod
    def submit_batch_generate(self, episode_id: str, shot_id: str, prompt: str, duration_sec: int) -> str:
        pass

    @abstractmethod
    def poll_task(self, task_id: str) -> TaskResult:
        pass

    @abstractmethod
    def get_video_pool(self, episode_id: str, shot_id: str) -> List[ShotVideoPoolItem]:
        pass

    @abstractmethod
    def select_video(self, episode_id: str, shot_id: str, pool_item_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_video(self, episode_id: str, shot_id: str, pool_item_id: str) -> Dict[str, Any]:
        pass

class MockApiClient(ApiClient):
    """
    Mock implementation of the API client for testing and development.
    Simulates task submission, polling with progress updates, and mock video candidate generation.
    """
    def __init__(self):
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._video_pools: Dict[str, List[ShotVideoPoolItem]] = {}

    def create_video_prompt(self, shot: Shot) -> str:
        # In a real scenario, this might call an LLM API to refine the prompt.
        # Here we just return a placeholder, the actual prompt logic is in PromptEngine.
        return f"Mock API Prompt for {shot.video_main_subject}"

    def submit_batch_generate(self, episode_id: str, shot_id: str, prompt: str, duration_sec: int) -> str:
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = {
            "created_at": time.time(),
            "episode_id": episode_id,
            "shot_id": shot_id,
            "status": TaskStatus.PENDING,
            "prompt": prompt
        }
        # Simulate a delay for task pickup
        return task_id

    def poll_task(self, task_id: str) -> TaskResult:
        if task_id not in self._tasks:
            return TaskResult(task_id=task_id, status=TaskStatus.FAILED, error="Task not found")

        task_info = self._tasks[task_id]
        elapsed = time.time() - task_info["created_at"]
        
        # Simulation Logic:
        # 0-2s: Pending
        # 2-5s: Running
        # >5s: Success
        
        if elapsed < 2:
            status = TaskStatus.PENDING
            progress = 0.0
        elif elapsed < 5:
            status = TaskStatus.RUNNING
            progress = min(100.0, (elapsed - 2) / 3 * 100)
        else:
            status = TaskStatus.SUCCESS
            progress = 100.0
            
            # Generate mock results if success and not yet populated
            key = f"{task_info['episode_id']}_{task_info['shot_id']}"
            if key not in self._video_pools:
                self._video_pools[key] = self._generate_mock_candidates()

        task_info["status"] = status
        return TaskResult(task_id=task_id, status=status, progress=progress)

    def _generate_mock_candidates(self) -> List[ShotVideoPoolItem]:
        candidates = []
        for i in range(3):
            candidates.append(ShotVideoPoolItem(
                id=str(uuid.uuid4()),
                url=f"https://mock-storage.com/video_{i}.mp4",
                status=TaskStatus.SUCCESS,
                created_at=datetime.now().isoformat(),
                meta={
                    "width": 1024,
                    "height": 576,
                    "seed": random.randint(1000, 9999),
                    "consistency_score": random.uniform(0.7, 0.99),
                    "watermark_detected": random.choice([True, False, False]) # Occasional bad result
                }
            ))
        return candidates

    def get_video_pool(self, episode_id: str, shot_id: str) -> List[ShotVideoPoolItem]:
        key = f"{episode_id}_{shot_id}"
        return self._video_pools.get(key, [])

    def select_video(self, episode_id: str, shot_id: str, pool_item_id: str) -> Dict[str, Any]:
        return {"success": True, "selected_id": pool_item_id, "message": "Video selected and locked"}

    def delete_video(self, episode_id: str, shot_id: str, pool_item_id: str) -> Dict[str, Any]:
        return {"success": True, "deleted_id": pool_item_id, "message": "Video deleted from pool"}
