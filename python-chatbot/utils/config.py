"""
Configuration Management for Python Chatbot Service
Loads environment variables and provides configuration access
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration"""
    
    # Ollama Configuration
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    FUNCTION_MODEL = os.getenv("FUNCTION_MODEL", "functiongemma:270m")
    DIALOG_MODEL = os.getenv("DIALOG_MODEL", "qwen3:8b")
    
    # Node.js Backend API
    NODEJS_BACKEND_URL = os.getenv("NODEJS_BACKEND_URL", "http://localhost:3000")
    
    # Service Configuration
    SERVICE_PORT = int(os.getenv("PYTHON_SERVICE_PORT", "8001"))
    SERVICE_HOST = os.getenv("PYTHON_SERVICE_HOST", "0.0.0.0")
    
    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Singleton instance
config = Config()
