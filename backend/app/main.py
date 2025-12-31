# defines routes (endpoints like / or /summarize), handle HTTP requests
from fastapi import FastAPI
# define schemas for request bodies (FastAPI relies on this to auto-validate input)
from pydantic import BaseModel
from typing import List
# OpenAI Python SDK (handle authentication & HTTP calls to OpenAI's API)
import openai

# main application/server object (all routes attached to this object)
app = FastAPI()

# root route that runs when POST request is made to "/"
@app.get("/")
def root():
    # FastAPI converts dictionary to JSON, sends it as HTTP response
    # message to check if backend is running properly
    return {"message": "Backend is running!"}

# define request body schema
# any POST request to /summarize must match this
class SummarizeRequest(BaseModel):
    content: List[dict]
    apiKey: str                 # requires request to include OpenAI API key
    mode: str = "default"       # if mode not provided, default to "default"

# declare POST endpoint at /summarize
@app.post("/summarize")
# request is typed object, not raw JSON
def summarize(request: SummarizeRequest):
    # sets user-provided OpenAI API key for this request
    openai.api_key = request.apiKey

    # concatenate all text content from request into single string
    text = " ".join(item["text"] for item in request.content if "text" in item)

    # make request to OpenAI's Chat Completion API
    # sends text to the model, asks for generated response
    response = openai.ChatCompletion.create(
        model = "gpt-4.1-mini",
        # define prompt
        messages = [
            {"role": "system", "content": "Summarize the following content."},
            {"role": "user", "content": text},
        ],
        # limit length of generated summary
        max_tokens = 200,
        # control randomness of output
        temperature = 0.3,
    )

    # return generated summary in response
    # wrap in a JSON object, FastAPI converts it to JSON, sends to extension
    return {"summary": response.choices[0].message.content}