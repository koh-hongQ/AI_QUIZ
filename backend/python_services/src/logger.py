from loguru import logger
import sys
from .config import config

def setup_logging():
    """Configure logging for the Python services"""
    # Remove default handler
    logger.remove()
    
    # Add custom handler with configuration
    logger.add(
        sys.stderr,
        format=config.LOG_FORMAT,
        level=config.LOG_LEVEL,
        colorize=True
    )
    
    # Add file handler for persistent logging
    logger.add(
        "logs/python_services.log",
        format=config.LOG_FORMAT,
        level=config.LOG_LEVEL,
        rotation="100 MB",
        retention="30 days",
        compression="zip"
    )
    
    return logger

# Initialize logging
setup_logging()
