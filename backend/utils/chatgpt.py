import os
from langchain_openai import OpenAIEmbeddings
import openai
import asyncio
import time
from openai import AsyncOpenAI
import dotenv


def load_dotenv():
    """Load the .env file normally and also from the current directory."""
    # Ref: https://stackoverflow.com/a/78972639/
    dotenv.load_dotenv()
    dotenv.load_dotenv(dotenv.find_dotenv(usecwd=True))

load_dotenv()
embed_model = "text-embedding-3-small"
model = os.environ['MODEL']

# Replace with your OpenAI API key
api_key = os.environ['OPENAI_API_KEY']
openai.api_key = api_key

open_ai_client = AsyncOpenAI(
    # This is the default and can be omitted
    api_key=os.environ.get("OPENAI_API_KEY"),
)

dense_embedding = OpenAIEmbeddings(async_client=open_ai_client,model="text-embedding-3-small")

async def emb_text(text):
    response = await open_ai_client.embeddings.create(input=text, model=embed_model)
    response = response.data[0].embedding
    return response

async def run_chatgpt(user_prompt, system_prompt='', temperature=0.7) -> None:
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
