#!/usr/bin/env python3
"""
Python environment check script
"""
import json
import sys
import os

def check_environment():
    """
    Check Python environment and dependencies
    """
    result = {
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "python_executable": sys.executable,
        "dependencies": {}
    }
    
    # List of required dependencies
    required_deps = [
        "PyMuPDF",
        "pytesseract", 
        "cv2",
        "PIL",
        "sentence_transformers",
        "qdrant_client",
        "torch",
        "transformers",
        "numpy",
        "dotenv",
        "openai"
    ]
    
    # Check each dependency
    for dep in required_deps:
        try:
            if dep == "cv2":
                import cv2
                result["dependencies"][dep] = cv2.__version__
            elif dep == "PIL":
                from PIL import Image
                result["dependencies"][dep] = "installed"
            elif dep == "dotenv":
                from dotenv import load_dotenv
                result["dependencies"][dep] = "installed"
            else:
                module = __import__(dep)
                version = getattr(module, '__version__', 'unknown')
                result["dependencies"][dep] = version
        except ImportError:
            result["dependencies"][dep] = "not installed"
    
    # Check if all dependencies are available
    missing_deps = [dep for dep, status in result["dependencies"].items() if status == "not installed"]
    result["all_dependencies_available"] = len(missing_deps) == 0
    result["missing_dependencies"] = missing_deps
    
    return result

if __name__ == "__main__":
    env_check = check_environment()
    print(json.dumps(env_check, indent=2))
