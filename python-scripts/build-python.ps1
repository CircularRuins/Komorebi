# Build script for Python YouTube Transcript API (Windows PowerShell)
# This script uses pyinstaller to create standalone executables for Windows

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistDir = Join-Path $ScriptDir "dist"
$PythonScript = Join-Path $ScriptDir "get_youtube_transcript.py"

# Create dist directory if it doesn't exist
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir | Out-Null
}

# Check if pyinstaller is available (try both direct command and python module)
$pyinstaller = Get-Command pyinstaller -ErrorAction SilentlyContinue
$pyinstallerModule = python -m PyInstaller --version 2>$null
if (-not $pyinstaller -and -not $pyinstallerModule) {
    Write-Host "Error: pyinstaller is not installed"
    Write-Host "Please install it with: pip install pyinstaller"
    exit 1
}

# Determine how to call pyinstaller
if ($pyinstaller) {
    $PyInstallerCmd = "pyinstaller"
} else {
    $PyInstallerCmd = "python -m PyInstaller"
}

# Check if Python is available
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Error: python is not installed"
    exit 1
}

# Install dependencies if requirements.txt exists
$requirementsFile = Join-Path $ScriptDir "requirements.txt"
if (Test-Path $requirementsFile) {
    Write-Host "Installing Python dependencies..."
    pip install -r $requirementsFile
}

$ExecutableName = "get_youtube_transcript.exe"

Write-Host "Building executable: $ExecutableName"

# Build with pyinstaller
# --onefile: Create a single executable file with all dependencies
# --hidden-import: Ensure all required modules are included
# --collect-all: Collect all submodules and data files
if ($PyInstallerCmd -eq "pyinstaller") {
    pyinstaller `
        --onefile `
        --name $ExecutableName `
        --distpath $DistDir `
        --workpath (Join-Path $ScriptDir "build") `
        --specpath $ScriptDir `
        --clean `
        --hidden-import=youtube_transcript_api `
        --hidden-import=requests `
        --hidden-import=urllib3 `
        --collect-all youtube_transcript_api `
        $PythonScript
} else {
    python -m PyInstaller `
        --onefile `
        --name $ExecutableName `
        --distpath $DistDir `
        --workpath (Join-Path $ScriptDir "build") `
        --specpath $ScriptDir `
        --clean `
        --hidden-import=youtube_transcript_api `
        --hidden-import=requests `
        --hidden-import=urllib3 `
        --collect-all youtube_transcript_api `
        $PythonScript
}

# Clean up build artifacts (keep dist)
$buildDir = Join-Path $ScriptDir "build"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}

$specFile = Join-Path $ScriptDir "${ExecutableName}.spec"
if (Test-Path $specFile) {
    Remove-Item -Force $specFile
}

Write-Host "Build complete! Executable is in: $DistDir\$ExecutableName"

