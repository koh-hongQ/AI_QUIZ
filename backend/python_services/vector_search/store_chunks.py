#!/usr/bin/env python3
"""
Store chunks in Qdrant vector database
"""
import json
import sys
from vector_search.qdrant_client import QdrantManager

def main():
    """
    Command line interface for storing chunks
    """
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python store_chunks.py <document_id> '<chunks_json>'"}))
        sys.exit(1)
    
    document_id = sys.argv[1]
    
    try:
        chunks = json.loads(sys.argv[2])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    
    try:
        manager = QdrantManager()
        success = manager.store_chunks(document_id, chunks)
        
        result = {
            "success": success,
            "document_id": document_id,
            "chunks_stored": len(chunks)
        }
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
