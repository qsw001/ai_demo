import json
import logging
import time
import re
import httpx
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.settings import API_KEY, API_BASE, MODEL_NAME

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self):
        if not API_KEY:
            logger.warning("API_KEY is missing!")
        
        # Custom httpx client with longer read timeout
        self.http_client = httpx.Client(
            timeout=httpx.Timeout(connect=5.0, read=25.0, write=10.0, pool=5.0),
            transport=httpx.HTTPTransport(retries=3)
        )

        self.llm = ChatOpenAI(
            model=MODEL_NAME,
            openai_api_key=API_KEY,
            openai_api_base=API_BASE,
            temperature=0.3,
            max_tokens=1024,
            http_client=self.http_client,
            max_retries=0 # We handle retries manually
        )
        
        self.parser = JsonOutputParser()

        # Double curly braces for JSON template to escape them in prompt formatting
        system_prompt = """
You are a helpful English Dictionary Assistant. 
Output STRICT JSON only. No markdown, no code blocks, no explanation.
Target audience: General users, prefer common usage.

Return JSON format:
{{
  "query": "string (the word queried)",
  "ipa": "string (IPA pronunciation)",
  "pos": [{{"p":"n./v./adj./etc", "meaning_zh":"Chinese meaning"}}],
  "usage": ["common phrase 1", "usage 2", ... (max 6)],
  "forms": {{"plural":"", "past":"", "pp":"", "ing":"", "comparative":"", "superlative":""}},
  "examples": [{{"en":"...", "zh":"..."}}, ... (2-4 items)],
  "notes": ["Common mistakes or synonyms" ... (max 3)]
}}

If query is CHINESE, find the best matching English word first, then provide details for that English word, and mention the mapping in 'notes'.
If query is not an English word, provide the closest English translation/explanation and explain in 'notes'.
If fields are unknown, use empty string or empty list.
"""
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "{query}")
        ])
        
        self.chain = self.prompt | self.llm | self.parser

    def query_word(self, word, attempt=1, max_attempts=3):
        try:
            logger.info(f"Querying LLM for: {word} (Attempt {attempt}/{max_attempts})")
            
            # Decide chain based on attempt
            current_chain = self.chain
            
            # Third attempt: use strict JSON fix prompt
            if attempt == max_attempts:
                retry_prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are a JSON generator. Output ONLY valid JSON. No markdown. Fix the response for query: " + word),
                    ("user", "Return strict JSON format.")
                ])
                current_chain = retry_prompt | self.llm | self.parser

            result = current_chain.invoke({"query": word})
            return result

        except Exception as e:
            logger.warning(f"Attempt {attempt} failed: {e}")
            
            # Analyze error type
            error_type = "network"
            error_msg = str(e)
            
            if isinstance(e, httpx.TimeoutException):
                error_type = "timeout"
            elif "401" in str(e) or "403" in str(e):
                error_type = "auth"
            elif "json" in str(e).lower():
                error_type = "bad_json"

            # Retry logic
            if attempt < max_attempts:
                # Exponential backoff
                sleep_time = 0.4 * (2 ** (attempt - 1))
                time.sleep(sleep_time)
                # Recursively call next attempt
                # If error is Auth, no need to retry usually, but let's keep it simple
                if error_type == "auth":
                     return {"error": {"type": error_type, "message": error_msg, "attempts": attempt}}
                
                return self.query_word(word, attempt + 1, max_attempts)
            else:
                return {"error": {"type": error_type, "message": error_msg, "attempts": attempt}}

if __name__ == "__main__":
    # Test
    client = LLMClient()
    res = client.query_word("apple")
    print(json.dumps(res, indent=2, ensure_ascii=False))
