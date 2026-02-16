"""
FastAPI + LangServe Main Application
Serves the hybrid chatbot chain as a REST API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langserve import add_routes
from chains.chatbot_chain import chatbot_chain  # Back to Gemma3-only
from utils.config import config
import logging

# Setup logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Bakery PoS Chatbot API",
    version="1.0.0",
    description="LangServe chatbot API with hybrid FunctionGemma + Qwen3 approach"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "bakery-chatbot",
        "function_model": config.FUNCTION_MODEL,
        "dialog_model": config.DIALOG_MODEL
    }

# Add LangServe routes for the chatbot chain
# This creates endpoints:
# - POST /chat/invoke - for single invocations
# - POST /chat/batch - for batch invocations
# - POST /chat/stream - for streaming responses
# - GET /chat/playground - for interactive playground UI
add_routes(
    app,
    chatbot_chain,
    path="/chat",
)

logger.info(f"🤖 Chatbot API starting on {config.SERVICE_HOST}:{config.SERVICE_PORT}")
logger.info(f"📚 Function Model: {config.FUNCTION_MODEL}")
logger.info(f"💬 Dialog Model: {config.DIALOG_MODEL}")
logger.info(f"🎮 Playground available at: http://localhost:{config.SERVICE_PORT}/chat/playground/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.SERVICE_HOST,
        port=config.SERVICE_PORT,
        reload=True
    )
