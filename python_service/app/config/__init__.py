"""
Configuration package for AI Processing Service
"""

from .settings import settings
from .database import init_db, close_db, get_vector_db

__all__ = ["settings", "init_db", "close_db", "get_vector_db"]