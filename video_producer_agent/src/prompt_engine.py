import os
from .models import Shot
from .config import Config

class PromptEngine:
    def __init__(self, config: Config):
        self.config = config
        self.video_template = self._load_template("video_prompt_template.txt")
        self.negative_template = self._load_template("negative_prompt_template.txt")

    def _load_template(self, filename: str) -> str:
        path = self.config.get_template_path(filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except FileNotFoundError:
            # Fallback defaults if file missing
            if "negative" in filename:
                return "low quality, bad anatomy, watermark, {negative_constraints}"
            return "(Subject: {subject}), (Action: {shoot_desc}), {style}, {camera}, {lighting}"

    def generate_prompt(self, shot: Shot) -> str:
        # Default values
        style = shot.style or self.config.VIDEO_STYLE or "cinematic"
        camera = shot.camera or "static camera, wide angle"
        lighting = shot.lighting or "natural lighting, soft shadows"
        
        # Safety check for format keys
        try:
            prompt = self.video_template.format(
                subject=shot.video_main_subject,
                shoot_desc=shot.video_shoot_desc,
                style=style,
                camera=camera,
                lighting=lighting
            )
        except KeyError as e:
            # If template has unknown keys, fallback
            prompt = f"{shot.video_main_subject}, {shot.video_shoot_desc}, {style}"
            
        return prompt

    def generate_negative_prompt(self, extra_constraints: str = "") -> str:
        try:
            return self.negative_template.format(negative_constraints=extra_constraints)
        except KeyError:
             return "low quality, bad anatomy, watermark"
