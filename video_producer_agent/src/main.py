import argparse
import json
import os
from .models import Shot
from .config import Config
from .agent import VideoProducerAgent
from .utils import setup_logging
from .api_client import MockApiClient

def main():
    parser = argparse.ArgumentParser(description="Video Producer Agent CLI")
    
    # Mode 1: Direct arguments
    parser.add_argument("--episode-id", type=str, help="Episode ID")
    parser.add_argument("--shot-id", type=str, help="Shot ID")
    parser.add_argument("--main-subject", type=str, help="Main subject description")
    parser.add_argument("--shoot-desc", type=str, help="Shot description")
    parser.add_argument("--duration", type=int, default=5, help="Duration in seconds")
    parser.add_argument("--style", type=str, default="cinematic", help="Video style")
    
    # Mode 2: JSON file
    parser.add_argument("--input", type=str, help="Path to shot JSON file")
    
    args = parser.parse_args()
    
    # Setup Logging
    config = Config()
    logger, log_path = setup_logging(config)
    logger.info("Video Producer Agent Started")

    try:
        if args.input:
            if not os.path.exists(args.input):
                logger.error(f"Input file not found: {args.input}")
                return
            
            with open(args.input, "r", encoding="utf-8") as f:
                data = json.load(f)
                shot = Shot(**data)
        elif args.episode_id and args.shot_id and args.main_subject:
            shot = Shot(
                episode_id=args.episode_id,
                shot_id=args.shot_id,
                video_main_subject=args.main_subject,
                video_shoot_desc=args.shoot_desc or "",
                video_duration_sec=args.duration,
                style=args.style
            )
        else:
            parser.print_help()
            return

        logger.info(f"Processing shot: {shot.shot_id}")
        
        # Initialize Agent
        # Note: In production, swap MockApiClient() with RealApiClient(config)
        agent = VideoProducerAgent(config, api_client=MockApiClient())
        
        # Run Workflow
        result = agent.run_for_shot(shot)
        
        # Output Result
        try:
            output_json = result.model_dump_json(indent=2)
        except AttributeError:
            # Fallback for Pydantic v1
            output_json = result.json(indent=2)
        
        print(output_json)
        
        # Save Result to file
        with open("final_result.json", "w", encoding="utf-8") as f:
            f.write(output_json)
            
        logger.info(f"Workflow completed. Result saved to final_result.json")

    except Exception as e:
        logger.exception("Critical error in main execution")
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
