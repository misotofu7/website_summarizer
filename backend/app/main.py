# defines routes (endpoints like / or /summarize), handle HTTP requests
from fastapi import FastAPI, HTTPException, Request
# define schemas for request bodies (FastAPI relies on this to auto-validate input)
from pydantic import BaseModel
from typing import List
import time
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
    mode: str = "like_i_am_5"       # if mode not provided, default to "default"

ALLOWED_MODES = {"like_i_am_5", "expert", "bullet_points"}

# native in-memory rate limit: 10 requests / 60 seconds per IP
RATE_WINDOW_SECONDS = 60
RATE_MAX_REQUESTS = 10
# ip --> (window_start, count)
_rate = {}

def rate_limit(ip: str):
    now = time.time()
    window_start, count = _rate.get(ip, (now, 0))
    if now - window_start > RATE_WINDOW_SECONDS:
        _rate[ip] = (now, 1)
        return
    if count >= RATE_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute")
    _rate[ip] = (window_start, count + 1)

# instructions to send to AI model for summarization
def build_system_prompt(mode:str) -> str:
    if mode == "like_i_am_5":
        return "Explain simply like I'm 5. Use short sentences."
    elif mode == "expert":
        return "Summarize for an expert. Be concise, technical, and precise."
    elif mode == "bullet_points":
        return "Summarize as bullet points. Use clear, scannable bullets."
    return "Summarize the following content."

# declare POST endpoint at /summarize
@app.post("/summarize")
# request is typed object, not raw JSON
def summarize(request: SummarizeRequest):
    # rate limit
    if http_request.client:
        client_ip = http_request.client.host
    else:
        client_ip = "unknown"
    rate_limit(client_ip)

    # validate mode
    if request.mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode.")

    # validate API key shape (basic)
    if not request.apiKey or not request.apiKey.startswith("sk-"):
        raise HTTPException(status_code=400, detail="Invalid API key.")

    # concatenate all text content from request into single string
    text = " ".join(item.get("text", "") for item in request.content if isinstance(item, dict)).strip()

    # block extremely large inputs (prevent too large costs)
    MAX_CHARS = 25_000
    if len(text) > MAX_CHARS:
        raise HTTPException(status_code=413, detail=f"Page too long. Please try a shorter page (max {MAX_CHARS} chars).")

    # sets user-provided OpenAI API key for this request
    openai.api_key = request.apiKey

    try:
        # make request to OpenAI's Chat Completion API
        # sends text to the model, asks for generated response
        response = openai.ChatCompletion.create(
            model = "gpt-4.1-mini",
            # define prompt
            messages = [
                {"role": "system", "content": build_system_prompt(request.mode)},
                {"role": "user", "content": text},
            ],
            # limit length of generated summary
            max_tokens = 250,
            # control randomness of output
            temperature = 0.3,
        )
        return {"summary": response.choices[0].message.content}
    except Exception as e:
        # don't include apiKey in any logs or errors returned (CRITICAL SECURITY)
        raise HTTPException(status_code=500, detail="Summarization failed. Check API key/billing and try again.")

    # return generated summary in response
    # wrap in a JSON object, FastAPI converts it to JSON, sends to extension
    return {"summary": response.choices[0].message.content}