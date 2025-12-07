#!/bin/bash

# Verification script to check if all required Python executables are built
# This script checks for the required executables based on the target platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Verifying Python executables..."

# Check which platform we're building for
PLATFORM=${1:-$(uname -s)}
TARGET_ARCHS=${2:-""}

MISSING_FILES=()
REQUIRED_FILES=()

if [ "$PLATFORM" == "Darwin" ] || [ "$PLATFORM" == "darwin" ]; then
    # macOS - check for both architectures if specified
    if [ -z "$TARGET_ARCHS" ]; then
        # Default: check for current architecture
        CURRENT_ARCH=$(uname -m)
        if [ "$CURRENT_ARCH" == "arm64" ]; then
            REQUIRED_FILES=("get_youtube_transcript_macos_arm64")
        else
            REQUIRED_FILES=("get_youtube_transcript_macos_x64")
        fi
    else
        # Check for specified architectures
        for arch in $TARGET_ARCHS; do
            if [ "$arch" == "arm64" ]; then
                REQUIRED_FILES+=("get_youtube_transcript_macos_arm64")
            elif [ "$arch" == "x64" ] || [ "$arch" == "x86_64" ]; then
                REQUIRED_FILES+=("get_youtube_transcript_macos_x64")
            fi
        done
    fi
elif [ "$PLATFORM" == "Linux" ] || [ "$PLATFORM" == "linux" ]; then
    REQUIRED_FILES=("get_youtube_transcript_linux")
elif [ "$PLATFORM" == "Windows" ] || [ "$PLATFORM" == "win32" ] || [ "$PLATFORM" == "windows" ]; then
    REQUIRED_FILES=("get_youtube_transcript.exe")
else
    echo -e "${YELLOW}Warning: Unknown platform $PLATFORM${NC}"
    # Try to find any executable
    if [ -d "$DIST_DIR" ]; then
        FOUND_FILES=$(ls "$DIST_DIR" | grep -E "get_youtube_transcript" || true)
        if [ -n "$FOUND_FILES" ]; then
            echo "Found executables:"
            echo "$FOUND_FILES"
        fi
    fi
    exit 0
fi

# Check each required file
for file in "${REQUIRED_FILES[@]}"; do
    file_path="$DIST_DIR/$file"
    if [ -f "$file_path" ]; then
        # Check if executable
        if [ -x "$file_path" ]; then
            echo -e "${GREEN}✓${NC} Found and executable: $file"
        else
            echo -e "${YELLOW}⚠${NC} Found but not executable: $file (fixing permissions...)"
            chmod +x "$file_path"
            echo -e "${GREEN}✓${NC} Fixed permissions for: $file"
        fi
    else
        echo -e "${RED}✗${NC} Missing: $file"
        MISSING_FILES+=("$file")
    fi
done

# Report results
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All required Python executables are present and ready!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Missing ${#MISSING_FILES[@]} required executable(s):${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo -e "  ${RED}- $file${NC}"
    done
    echo ""
    echo "To build missing executables, run:"
    if [ "$PLATFORM" == "Darwin" ] || [ "$PLATFORM" == "darwin" ]; then
        echo "  cd python-scripts && bash build-python.sh arm64 x64"
    else
        echo "  npm run build-python"
    fi
    exit 1
fi

