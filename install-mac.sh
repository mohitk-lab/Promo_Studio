#!/bin/bash
echo "============================================"
echo " Promo Studio - Premiere Pro Extension"
echo " macOS Installation Script"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check if source folder exists
if [ ! -d "$SCRIPT_DIR/com.promostudio.panel" ]; then
    echo " ERROR: com.promostudio.panel folder not found!"
    echo " Make sure you run this script from the Promo_Studio folder."
    exit 1
fi

# Step 1: Enable unsigned extensions
echo "[1/3] Enabling unsigned extensions..."
defaults write com.adobe.CSXS.12 PlayerDebugMode 1 2>/dev/null
defaults write com.adobe.CSXS.11 PlayerDebugMode 1 2>/dev/null
defaults write com.adobe.CSXS.10 PlayerDebugMode 1 2>/dev/null
defaults write com.adobe.CSXS.9 PlayerDebugMode 1 2>/dev/null
echo "   PlayerDebugMode set for CSXS 9-12"

# Step 2: Set target directory
TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/com.promostudio.panel"
echo ""
echo "[2/3] Installing to: $TARGET_DIR"

# Create all parent directories if needed
mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"

# Remove old installation
if [ -d "$TARGET_DIR" ]; then
    echo "   Removing old installation..."
    rm -rf "$TARGET_DIR"
fi

# Step 3: Copy extension files
echo "   Copying extension files..."
cp -R "$SCRIPT_DIR/com.promostudio.panel" "$TARGET_DIR"

if [ $? -eq 0 ]; then
    echo ""
    echo "[3/3] Installation complete!"
    echo ""
    echo "============================================"
    echo " Next steps:"
    echo " 1. Restart Premiere Pro"
    echo " 2. Go to: Window > Extensions > Promo Studio"
    echo " 3. Debug at: http://localhost:8088"
    echo "============================================"
else
    echo ""
    echo " ERROR: Installation failed!"
    echo " Check file permissions."
fi
