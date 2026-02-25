import time
import logging
from typing import Optional, List
from .models import Shot, FinalResult, TaskStatus, ShotVideoPoolItem
from .api_client import ApiClient, MockApiClient
from .prompt_engine import PromptEngine
from .scoring import ScoringEngine
from .config import Config

class VideoProducerAgent:
    def __init__(self, config: Config, api_client: ApiClient = None):
        self.config = config
        self.api = api_client or MockApiClient()
        self.prompt_engine = PromptEngine(config)
        self.scoring_engine = ScoringEngine()
        self.logger = logging.getLogger("VideoProducerAgent")

    def run_for_shot(self, shot: Shot) -> FinalResult:
        self.logger.info(f"Starting workflow for shot {shot.episode_id}/{shot.shot_id}")
        
        result = FinalResult(
            episode_id=shot.episode_id,
            shot_id=shot.shot_id
        )

        try:
            # 1. Generate Prompt
            prompt = self.prompt_engine.generate_prompt(shot)
            self.logger.info(f"Generated prompt: {prompt}")

            # 2. Submit Task
            task_id = self.api.submit_batch_generate(
                episode_id=shot.episode_id,
                shot_id=shot.shot_id,
                prompt=prompt,
                duration_sec=shot.video_duration_sec
            )
            result.task_id = task_id
            self.logger.info(f"Submitted task: {task_id}")

            # 3. Poll for Completion
            task_status = self._poll_until_complete(task_id)
            if task_status != TaskStatus.SUCCESS:
                self.logger.error(f"Task failed with status: {task_status}")
                result.error = f"Task failed: {task_status}"
                return result

            # 4. Fetch Candidates
            candidates = self.api.get_video_pool(shot.episode_id, shot.shot_id)
            self.logger.info(f"Fetched {len(candidates)} candidates")

            # 5. Score & Select
            ranked_candidates = self.scoring_engine.score_candidates(candidates)
            result.video_pool = ranked_candidates
            
            if not ranked_candidates:
                self.logger.warning("No candidates returned from API")
                return result

            best_candidate = ranked_candidates[0]
            if best_candidate.score and best_candidate.score < 0:
                 self.logger.warning("Best candidate has negative score, skipping selection")
                 result.error = "No suitable candidate found (low score)"
                 return result

            self.logger.info(f"Selected candidate {best_candidate.id} with score {best_candidate.score}")

            # 6. Call Select API
            select_resp = self.api.select_video(shot.episode_id, shot.shot_id, best_candidate.id)
            if select_resp.get("success"):
                result.selected_video = best_candidate
                self.logger.info("Video selection confirmed by API")
            else:
                self.logger.error("API failed to confirm selection")
                result.error = "API selection failed"

            # 7. Optional Cleanup (Delete rejected)
            # self._cleanup_rejected(shot, ranked_candidates)

        except Exception as e:
            self.logger.exception("Workflow failed with exception")
            result.error = str(e)

        return result

    def _poll_until_complete(self, task_id: str) -> TaskStatus:
        start_time = time.time()
        while (time.time() - start_time) < self.config.TIMEOUT:
            task_result = self.api.poll_task(task_id)
            self.logger.info(f"Task {task_id} status: {task_result.status}, progress: {task_result.progress:.1f}%")
            
            if task_result.status in [TaskStatus.SUCCESS, TaskStatus.FAILED]:
                return task_result.status
            
            time.sleep(self.config.POLL_INTERVAL)
            
        return TaskStatus.TIMEOUT

    def _cleanup_rejected(self, shot: Shot, ranked_candidates: List[ShotVideoPoolItem]):
        # Implementation for deleting non-selected videos
        pass
