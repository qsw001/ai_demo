from typing import List, Optional
from .models import ShotVideoPoolItem, TaskStatus, Shot

class ScoringEngine:
    def __init__(self, weights=None):
        self.weights = weights or {
            "status": 100,      # Status check (hard filter)
            "consistency": 30,  # Consistency score from meta
            "error_penalty": -50, # Penalty for errors/watermarks
            "preference": 10    # User preference match
        }

    def score_candidates(self, candidates: List[ShotVideoPoolItem], preferences: Optional[List[str]] = None) -> List[ShotVideoPoolItem]:
        scored_candidates = []
        for item in candidates:
            score = 0.0
            
            # 1. Status Check
            if item.status != TaskStatus.SUCCESS:
                item.score = -999.0 # Effectively disqualify
                scored_candidates.append(item)
                continue
                
            score += self.weights["status"] # Base score for success
            
            # 2. Consistency (if available in meta)
            if item.meta and "consistency_score" in item.meta:
                score += item.meta["consistency_score"] * self.weights["consistency"]
            
            # 3. Penalties
            if item.meta and item.meta.get("watermark_detected", False):
                score += self.weights["error_penalty"]
                
            # 4. Preferences (simple keyword match in meta or status - placeholder logic)
            # In a real system, this might analyze video features.
            if preferences:
                # Placeholder: if preference in url or meta
                pass

            item.score = round(score, 2)
            scored_candidates.append(item)
            
        # Sort by score descending
        return sorted(scored_candidates, key=lambda x: x.score or -999, reverse=True)
