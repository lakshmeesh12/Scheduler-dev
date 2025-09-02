import os
import concurrent
from langchain_openai import OpenAIEmbeddings
import openai
import asyncio
import time
from openai import AsyncOpenAI
import dotenv
from uuid import uuid4
from typing import Dict, List, Optional, Any
import logging
from dataclasses import dataclass
import multiprocessing as mp

dotenv.load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

embed_model = "text-embedding-3-small"
model = os.environ['MODEL']

api_key = os.environ['OPENAI_API_KEY']
openai.api_key = api_key

open_ai_client = AsyncOpenAI(
    # This is the default and can be omitted
    api_key=os.environ.get("OPENAI_API_KEY"),
)

dense_embedding = OpenAIEmbeddings(async_client=open_ai_client,model="text-embedding-3-small")

MAX_CONCURRENT_TASKS = min(20, (os.cpu_count() or 4) * 5)
semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)


async def emb_text(text):
    response = await open_ai_client.embeddings.create(input=text, model=embed_model)
    response = response.data[0].embedding
    return response

async def run_chatgpt(user_prompt, system_prompt='', temperature=0.7) -> None:
  async with semaphore:
    try:
      chat_completion = await open_ai_client.chat.completions.create(
          messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
          ],
          model=model,
          temperature=temperature,
          # response_format={"type": "json_object"}
      )
    
      return chat_completion.choices[0].message.content
    except Exception as err:
      print(str(err), 'while running chatgpt')
      return ""

@dataclass
class ProcessingResult:
    """Data class to hold processing results"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    file_path: Optional[str] = None

class ChatGPTProcessor:
    def __init__(self, model: str, open_ai_client=open_ai_client, 
                 max_workers: Optional[int] = None,
                 rate_limit_per_minute: int = 60, batch_size: int = 10):
        """
        Initialize the processor with configurable parameters
        
        Args:
            open_ai_client: OpenAI client instance
            model: Model name to use
            max_workers: Maximum number of concurrent workers (defaults to CPU count)
            rate_limit_per_minute: API rate limit per minute
            batch_size: Number of files to process in each batch
        """
        self.open_ai_client = open_ai_client
        self.model = model
        self.max_workers = max_workers or min(mp.cpu_count(), 32)  # Cap at 32 for API limits
        self.rate_limit_per_minute = rate_limit_per_minute
        self.batch_size = batch_size
        self.semaphore = asyncio.Semaphore(self.max_workers)
        self.rate_limiter = asyncio.Semaphore(rate_limit_per_minute)
        
        logger.info(f"Initialized processor with {self.max_workers} workers")

    async def run_chatgpt(self, user_prompt: str, system_prompt: str = '', 
                         temperature: float = 0.7, retries: int = 3) -> Optional[str]:
        """
        Enhanced ChatGPT API call with rate limiting, retries, and proper error handling
        """
        for attempt in range(retries):
            try:
                async with self.rate_limiter:  # Rate limiting
                    await asyncio.sleep(60 / self.rate_limit_per_minute)  # Distribute requests evenly
   
                    chat_completion = await self.open_ai_client.chat.completions.create(
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        model=self.model,
                        temperature=temperature,
                        timeout=30.0  # Add timeout
                    )
                    
                    return chat_completion.choices[0].message.content
                    
            except Exception as err:
                logger.warning(f"Attempt {attempt + 1} failed: {str(err)}")
                if attempt == retries - 1:
                    logger.error(f"All {retries} attempts failed for prompt")
                    return None
                await asyncio.sleep(2 ** attempt)
        
        return None


def run_chatgpt_prompt(user_prompt, system_prompt="", temperature=0.6):
  """Runs a prompt using the ChatGPT 4-o-mini model.

  Args:
    prompt: The prompt to send to ChatGPT.

  Returns:
    The response from ChatGPT.
  """
  try:
    start = time.time()
    response = openai.chat.completions.create(
      model=model,  # Use the appropriate model name
      messages=[
          {"role": "system", "content": system_prompt},
          {"role": "user", "content": user_prompt}
      ],
      temperature=temperature,  # Adjust temperature for creativity
      # response_format={"type": "json_object"}
      )
    end = time.time()
    print(end-start, "seconds")
    return response.choices[0].message.content
  except Exception as e:
    print(f"Error running prompt: {e}")
    return None


if __name__=='__main__':
    prompt = "Write pandas code for pivot table with dataframe containing sales id, sales date, sales segment, and sales value."
    response = asyncio.run(run_chatgpt(prompt))
    print(response)
