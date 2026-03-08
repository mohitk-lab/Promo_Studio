# Promo Studio

Adobe Premiere Pro extension for automated promo creation, multi-platform export, campaign scheduling, and brand management.

## Features

### 1. Template-Based Promo Generator
- 6 built-in templates (Square, Story, YouTube Ad, Banner, Bumper, WhatsApp)
- Custom template creation with any dimensions/fps/duration
- MOGRT (Motion Graphics Template) support
- Text replacement and media swap in templates

### 2. Multi-Platform Auto-Export
- One-click export for 10+ platforms:
  - Instagram (Post, Story/Reel), Facebook (Feed, Story)
  - YouTube (Standard, Shorts), Twitter/X, LinkedIn
  - WhatsApp Status, TikTok
- Batch export with Adobe Media Encoder presets
- Create sequence variants with correct dimensions per platform

### 3. Campaign Scheduler
- Calendar view for campaign planning
- Schedule promos with date, platform, and sequence selection
- One-click export for scheduled campaigns
- Sync sequences from Premiere Pro project

### 4. Brand Kit Integration
- Store brand colors (primary, secondary, accent, bg, text)
- Font management (heading, body, accent)
- Logo import and overlay (auto-position and scale)
- Multiple brand kits for agencies
- Direct import into Premiere Pro project bins

### 5. Dynamic Promo Rules Engine
- Trigger types: Day of Week, Festival, Date Range, Recurring, Manual
- Promo types: Discount, Launch, Event, Announcement, Flash Sale, Testimonial
- 10+ Indian festivals pre-configured (Diwali, Holi, Eid, etc.)
- Auto text replacement in template sequences
- Rule enable/disable toggle with execution history

### 6. Asset Library & Media Manager
- Full project asset inventory from Premiere Pro
- Search assets by name
- Custom tagging system with tag-based filtering
- Auto-organize with standard bin structure
- Quick import media files

## Installation

### Development Mode
1. Enable unsigned extensions (run once):
   - **Windows**: Set registry key `HKEY_CURRENT_USER\Software\Adobe\CSXS.11` → `PlayerDebugMode` = `1`
   - **macOS**: `defaults write com.adobe.CSXS.11 PlayerDebugMode 1`

2. Copy/symlink the `com.promostudio.panel` folder to:
   - **Windows**: `C:\Users\<user>\AppData\Roaming\Adobe\CEP\extensions\`
   - **macOS**: `~/Library/Application Support/Adobe/CEP/extensions/`

3. Restart Premiere Pro

4. Open panel: **Window > Extensions > Promo Studio**

### Debug
- Chrome DevTools available at `http://localhost:8088` when extension is running

## Project Structure

```
com.promostudio.panel/
├── CSXS/
│   └── manifest.xml          # CEP extension manifest
├── jsx/
│   └── hostscript.jsx         # ExtendScript - Premiere Pro API layer
├── js/
│   ├── utils/
│   │   ├── CSInterface.js     # Adobe CEP communication
│   │   ├── ppro-bridge.js     # JS ↔ ExtendScript bridge
│   │   └── storage.js         # localStorage wrapper
│   ├── modules/
│   │   ├── template-generator.js   # Template-based promo creation
│   │   ├── multi-export.js         # Multi-platform export
│   │   ├── campaign-scheduler.js   # Campaign calendar & scheduling
│   │   ├── brand-kit.js            # Brand colors, fonts, logos
│   │   ├── rules-engine.js         # Dynamic promo rules
│   │   └── asset-library.js        # Asset management & tagging
│   └── app.js                 # Main app controller
├── css/
│   └── styles.css             # Dark theme matching Premiere Pro
├── index.html                 # Main panel HTML
└── .debug                     # Debug configuration
```

## Tech Stack
- **Panel UI**: HTML5 + CSS3 + Vanilla JavaScript
- **Host Scripting**: Adobe ExtendScript (JSX) for Premiere Pro DOM access
- **Communication**: CSInterface (CEP runtime bridge)
- **Storage**: localStorage for settings, tags, rules, campaigns, brand kits
- **Export**: Adobe Media Encoder integration via `app.encoder`

## Premiere Pro API Usage
The extension uses Premiere Pro's ExtendScript API to:
- Read/write project items, bins, and sequences
- Create and clone sequences with custom settings
- Import media files into project
- Add clips to timeline tracks
- Apply and modify Motion Graphics Templates (MOGRTs)
- Export via Adobe Media Encoder with custom presets
- Read/write sequence markers for scheduling metadata
- Access clip components (Motion, Lumetri Color, etc.)
- Manage XMP metadata for asset tagging
