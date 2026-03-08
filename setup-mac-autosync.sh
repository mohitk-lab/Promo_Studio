#!/bin/bash
# ============================================
#  Promo Studio - Mac Auto-Sync Setup
#  One-time setup: auto-pulls from GitHub
#  and keeps extension always up-to-date
# ============================================

echo "============================================"
echo " Promo Studio - Auto-Sync Setup for Mac"
echo "============================================"
echo ""

# Config
REPO_URL="https://github.com/mohitk-lab/Promo_Studio.git"
BRANCH="claude/promo-automation-ideas-ZkUzR"
INSTALL_DIR="$HOME/Promo_Studio"
EXTENSIONS_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET_DIR="$EXTENSIONS_DIR/com.promostudio.panel"
PLIST_NAME="com.promostudio.autosync"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
SYNC_SCRIPT="$INSTALL_DIR/.autosync.sh"

# Step 1: Clone or update repo
echo "[1/5] Setting up repository..."
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "   Repo exists, pulling latest..."
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH" 2>/dev/null
    git checkout "$BRANCH" 2>/dev/null
    git pull origin "$BRANCH" 2>/dev/null
    echo "   Updated to latest."
else
    echo "   Cloning repo..."
    git clone "$REPO_URL" "$INSTALL_DIR" 2>/dev/null
    cd "$INSTALL_DIR"
    git checkout "$BRANCH" 2>/dev/null
    echo "   Cloned."
fi

# Step 2: Enable unsigned extensions
echo ""
echo "[2/5] Enabling unsigned extensions..."
defaults write com.adobe.CSXS.12 PlayerDebugMode 1 2>/dev/null
defaults write com.adobe.CSXS.11 PlayerDebugMode 1 2>/dev/null
defaults write com.adobe.CSXS.10 PlayerDebugMode 1 2>/dev/null
defaults write com.adobe.CSXS.9 PlayerDebugMode 1 2>/dev/null
echo "   PlayerDebugMode set for CSXS 9-12"

# Step 3: Create symlink
echo ""
echo "[3/5] Creating extension symlink..."
mkdir -p "$EXTENSIONS_DIR"

if [ -L "$TARGET_DIR" ]; then
    rm "$TARGET_DIR"
elif [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
fi

ln -s "$INSTALL_DIR/com.promostudio.panel" "$TARGET_DIR"
echo "   Symlink: $TARGET_DIR -> repo"

# Step 4: Create sync script (runs every 30 seconds)
echo ""
echo "[4/5] Creating auto-sync background service..."

cat > "$SYNC_SCRIPT" << 'SYNCEOF'
#!/bin/bash
cd "$HOME/Promo_Studio" 2>/dev/null || exit 1
# Only pull if remote has changes (saves bandwidth)
git fetch origin claude/promo-automation-ideas-ZkUzR 2>/dev/null
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/claude/promo-automation-ideas-ZkUzR 2>/dev/null)
if [ "$LOCAL" != "$REMOTE" ]; then
    git pull origin claude/promo-automation-ideas-ZkUzR 2>/dev/null
    echo "$(date): Synced new changes" >> "$HOME/Promo_Studio/.sync.log"
fi
SYNCEOF
chmod +x "$SYNC_SCRIPT"

# Step 5: Create macOS LaunchAgent (runs sync every 30 sec)
# Stop old one if exists
launchctl unload "$PLIST_PATH" 2>/dev/null

cat > "$PLIST_PATH" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SYNC_SCRIPT</string>
    </array>
    <key>StartInterval</key>
    <integer>30</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/.sync-out.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/.sync-err.log</string>
</dict>
</plist>
PLISTEOF

launchctl load "$PLIST_PATH"

echo ""
echo "[5/5] Auto-sync service started!"
echo ""
echo "============================================"
echo " SETUP COMPLETE!"
echo ""
echo " What happens now:"
echo "   - Every 30 seconds, Mac checks for"
echo "     new changes from the server"
echo "   - If changes found, auto-pulls them"
echo "   - Symlink means changes instantly"
echo "     appear in Premiere Pro"
echo ""
echo " You just need to:"
echo "   1. Restart Premiere Pro (this one time)"
echo "   2. Window > Extensions > Promo Studio"
echo "   3. After that, just reload the panel"
echo "      to see new changes (right-click > Reload)"
echo ""
echo " To stop auto-sync later:"
echo "   launchctl unload ~/Library/LaunchAgents/$PLIST_NAME.plist"
echo ""
echo " Sync log: ~/Promo_Studio/.sync.log"
echo "============================================"
