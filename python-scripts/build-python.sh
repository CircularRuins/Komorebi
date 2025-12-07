#!/bin/bash

# Build script for Python YouTube Transcript API
# This script uses pyinstaller to create standalone executables for different platforms
# Usage: build-python.sh [arch1] [arch2] ...
#   For macOS, you can specify: arm64, x64, or both (default: current arch)
#   Example: build-python.sh arm64 x64  (builds both architectures)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
PYTHON_SCRIPT="$SCRIPT_DIR/get_youtube_transcript.py"

# Create dist directory if it doesn't exist
mkdir -p "$DIST_DIR"

# Check if pyinstaller is available (try both direct command and python module)
if ! command -v pyinstaller &> /dev/null && ! python3 -m PyInstaller --version &> /dev/null; then
    echo "Error: pyinstaller is not installed"
    echo "Please install it with: pip3 install pyinstaller"
    exit 1
fi

# Determine how to call pyinstaller
if command -v pyinstaller &> /dev/null; then
    PYINSTALLER_CMD="pyinstaller"
else
    PYINSTALLER_CMD="python3 -m PyInstaller"
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed"
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip3 install -r "$SCRIPT_DIR/requirements.txt" --quiet
fi

# Detect current platform
PLATFORM=$(uname -s)
CURRENT_ARCH=$(uname -m)

# Function to build for a specific architecture
build_for_arch() {
    local target_arch=$1
    local executable_name=""
    local pyinstaller_cmd="$PYINSTALLER_CMD"
    
    if [ "$PLATFORM" == "Darwin" ]; then
        # macOS
        if [ "$target_arch" == "arm64" ]; then
            executable_name="get_youtube_transcript_macos_arm64"
            # On Apple Silicon, use native arch
            if [ "$CURRENT_ARCH" != "arm64" ]; then
                echo "Warning: Cannot build arm64 on non-Apple Silicon Mac. Skipping..."
                return 1
            fi
        elif [ "$target_arch" == "x64" ] || [ "$target_arch" == "x86_64" ]; then
            executable_name="get_youtube_transcript_macos_x64"
            # If we're on Apple Silicon and want to build x64, use arch command
            if [ "$CURRENT_ARCH" == "arm64" ]; then
                if command -v arch &> /dev/null; then
                    echo "Building x64 on Apple Silicon using Rosetta..."
                    pyinstaller_cmd="arch -x86_64 $PYINSTALLER_CMD"
                else
                    echo "Warning: 'arch' command not available. Cannot build x64 on Apple Silicon. Skipping..."
                    return 1
                fi
            fi
        else
            echo "Error: Unknown architecture for macOS: $target_arch"
            return 1
        fi
    elif [ "$PLATFORM" == "Linux" ]; then
        # Linux
        executable_name="get_youtube_transcript_linux"
    elif [ "$PLATFORM" == "MINGW64_NT" ] || [ "$PLATFORM" == "MSYS_NT" ] || [ "$PLATFORM" == "CYGWIN_NT" ]; then
        # Windows (Git Bash or similar)
        executable_name="get_youtube_transcript.exe"
    else
        echo "Warning: Unknown platform $PLATFORM, using default name"
        executable_name="get_youtube_transcript"
    fi
    
    echo "Building executable: $executable_name (architecture: $target_arch)"
    
    # Build with pyinstaller
    # --onefile: Create a single executable file with all dependencies
    # --hidden-import: Ensure all required modules are included
    # --collect-all: Collect all submodules and data files
    eval $pyinstaller_cmd \
        --onefile \
        --name "$executable_name" \
        --distpath "$DIST_DIR" \
        --workpath "$SCRIPT_DIR/build" \
        --specpath "$SCRIPT_DIR" \
        --clean \
        --hidden-import=youtube_transcript_api \
        --hidden-import=requests \
        --hidden-import=urllib3 \
        --collect-all youtube_transcript_api \
        "$PYTHON_SCRIPT"
    
    # Set executable permissions (important for macOS/Linux)
    if [ -f "$DIST_DIR/$executable_name" ]; then
        chmod +x "$DIST_DIR/$executable_name"
        echo "✓ Built and set permissions: $DIST_DIR/$executable_name"
    else
        echo "✗ Failed to build: $executable_name"
        return 1
    fi
    
    # Clean up build artifacts (keep dist)
    rm -rf "$SCRIPT_DIR/build"
    rm -f "$SCRIPT_DIR/${executable_name}.spec"
}

# Determine which architectures to build
if [ $# -eq 0 ]; then
    # No arguments: build for current architecture only
    if [ "$PLATFORM" == "Darwin" ]; then
        if [ "$CURRENT_ARCH" == "arm64" ]; then
            ARCHS=("arm64")
        else
            ARCHS=("x64")
        fi
    else
        # For Linux/Windows, just build for current platform
        ARCHS=("$CURRENT_ARCH")
    fi
else
    # Arguments provided: build for specified architectures
    ARCHS=("$@")
fi

# Build for each architecture
BUILD_SUCCESS=false
for arch in "${ARCHS[@]}"; do
    if build_for_arch "$arch"; then
        BUILD_SUCCESS=true
    fi
done

if [ "$BUILD_SUCCESS" = true ]; then
    echo ""
    echo "Build complete! Executables are in: $DIST_DIR"
    ls -lh "$DIST_DIR" | grep -E "get_youtube_transcript" || true
else
    echo ""
    echo "Error: Failed to build any executables"
    exit 1
fi

