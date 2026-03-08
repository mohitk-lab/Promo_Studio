# Promo Studio - Installation & Testing Guide

## Quick Install

### Windows
```
Double-click: install-win.bat
```

### macOS
```bash
chmod +x install-mac.sh
./install-mac.sh
```

## Manual Installation

### Step 1: Enable Unsigned Extensions

**Windows** - Open Command Prompt as Admin:
```
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
```

**macOS** - Open Terminal:
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

### Step 2: Copy Extension

**Windows:**
```
Copy "com.promostudio.panel" folder to:
%APPDATA%\Adobe\CEP\extensions\
```

**macOS:**
```
Copy "com.promostudio.panel" folder to:
~/Library/Application Support/Adobe/CEP/extensions/
```

### Step 3: Restart Premiere Pro

### Step 4: Open Extension
```
Window > Extensions > Promo Studio
```

## Testing Checklist

### Phase B: Basic Functionality Test

#### Test 1: Extension Loads
- [ ] Open Premiere Pro
- [ ] Go to Window > Extensions > Promo Studio
- [ ] Panel should appear with claymorphism dark UI
- [ ] Dashboard tab shows stats (Templates, Campaigns, Rules, Brand Kits)
- [ ] Project Info section shows current project name and path

#### Test 2: Template Generator
- [ ] Click "Templates" tab
- [ ] 6 built-in templates should appear (Square, Story, YouTube Ad, etc.)
- [ ] Click "Create" on any template
- [ ] Enter a name in the prompt
- [ ] New sequence should appear in PPro project panel
- [ ] Custom template form should work (save custom dimensions)

#### Test 3: Multi-Platform Export
- [ ] Click "Export" tab
- [ ] All 10 platforms should be listed with checkboxes
- [ ] Use "Browse" button on output directory field
- [ ] Select some platforms
- [ ] Click "Export Selected Platforms"
- [ ] Jobs should queue in Adobe Media Encoder

#### Test 4: Campaign Scheduler
- [ ] Click "Scheduler" tab
- [ ] Calendar should show current month
- [ ] Navigate months with < > buttons
- [ ] Click a date to set it in the form
- [ ] Create a campaign (name, date, platform)
- [ ] Campaign should appear in "Upcoming" list
- [ ] Click "Sync from PPro" to load sequences

#### Test 5: Brand Kit
- [ ] Click "Brand Kit" tab
- [ ] Create a new brand kit with colors, fonts, logo paths
- [ ] Colors should show as swatches
- [ ] Click "Import to PPro" to import logos into project
- [ ] Click "Add Logo Overlay" to add watermark to sequence

#### Test 6: Rules Engine
- [ ] Click "Rules" tab
- [ ] Create a rule (e.g., "Friday Flash Sale" with Day of Week trigger)
- [ ] Toggle rule on/off
- [ ] Click "Run Now" to execute manually
- [ ] Triggered rules should show green "READY" badge on matching days

#### Test 7: Asset Library
- [ ] Click "Assets" tab
- [ ] Click "Refresh from PPro" to load project items
- [ ] Search by name
- [ ] Click "Auto-Organize Bins" to create standard folder structure
- [ ] Add tags to assets

### Phase B: Debug

If the extension doesn't load:
1. Check PlayerDebugMode is set correctly
2. Open Chrome and go to `http://localhost:8088`
3. Use Chrome DevTools to see console errors
4. Check `manifest.xml` host version matches your PPro version

If ExtendScript errors occur:
1. Open PPro > Window > ExtendScript Toolkit (if available)
2. Or check Chrome DevTools console for JSX errors
3. Common issue: `app.project` is null = no project open

### File Picker
- All path input fields with "Browse" button use native OS file dialogs
- File dialogs are filtered by type (video, image, audio, MOGRT, preset)
- Folder dialogs work for output directory selection

### AME Presets
- To use custom export presets:
  1. Open Adobe Media Encoder
  2. Create a preset with desired settings
  3. Right-click preset > Export Preset (.epr)
  4. Set the .epr path in Promo Studio export settings
- Without custom presets, export uses sequence-match settings

## Supported Premiere Pro Versions
- Premiere Pro 2020 (v14.0) and newer
- CEP 9.0 - 12.0
- Requires Adobe Media Encoder for export features
