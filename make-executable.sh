#!/bin/bash

# Make development scripts executable
chmod +x start-dev.sh
chmod +x stop-dev.sh
chmod +x backend/setup.sh

echo "✅ Scripts made executable"
echo ""
echo "You can now run:"
echo "  ./start-dev.sh  - Start the development environment"
echo "  ./stop-dev.sh   - Stop the development environment"
