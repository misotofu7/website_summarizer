# defines routes (endpoints like / or /summarize), handle HTTP requests
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import openai

# main application object (attach routes to this object)
# create backend
app = FastAPI()

# root route that runs when POST request is made to "/"
@app.get("/")
def root():
    return {"message": "Backend is running!"}

class SummarizeRequest(BaseModel):
    content: List[dict]
    apiKey: str
    mode: str = "default"

@app.post("/summarize")
def summarize(request: SummarizeRequest):
    openai.api_key = request.apiKey

    text = " ".join(
        item["text"] for item in request.content if "text" in item
    )

    response = openai.ChatCompletion.create(
        model = "gpt-4.1-mini",
        messages = [
            {"role": "system", "content": "Summarize the following content."},
            {"role": "user", "content": text},
        ],
        max_tokens = 200,
        temperature = 0.3,
    )

    return {
        "summary": response.choices[0].message.content
    }