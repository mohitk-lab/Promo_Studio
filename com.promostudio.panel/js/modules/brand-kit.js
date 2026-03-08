/**
 * Module 5: Brand Kit Integration
 * Manage brand colors, fonts, logos and apply them to Premiere Pro projects.
 */

var BrandKit = (function () {

    var STORAGE_KEY = 'brandKits';

    /**
     * Get all brand kits
     */
    function getBrandKits() {
        return Storage.get(STORAGE_KEY, []);
    }

    /**
     * Get active brand kit
     */
    function getActiveBrandKit() {
        var kits = getBrandKits();
        var activeId = Storage.get('activeBrandKit', null);
        if (activeId) {
            for (var i = 0; i < kits.length; i++) {
                if (kits[i].id === activeId) return kits[i];
            }
        }
        return kits.length > 0 ? kits[0] : null;
    }

    /**
     * Create a new brand kit
     */
    function createBrandKit(kit) {
        var kits = getBrandKits();
        kit.id = 'brand_' + Date.now();
        kit.createdAt = new Date().toISOString();

        // Ensure required fields
        kit.colors = kit.colors || { primary: '#000000', secondary: '#FFFFFF', accent: '#FF0000' };
        kit.fonts = kit.fonts || { heading: 'Arial Bold', body: 'Arial', accent: 'Arial Italic' };
        kit.logos = kit.logos || [];
        kit.guidelines = kit.guidelines || '';

        kits.push(kit);
        Storage.set(STORAGE_KEY, kits);
        return kit;
    }

    /**
     * Update brand kit
     */
    function updateBrandKit(kitId, updates) {
        var kits = getBrandKits();
        for (var i = 0; i < kits.length; i++) {
            if (kits[i].id === kitId) {
                for (var key in updates) {
                    if (updates.hasOwnProperty(key)) {
                        kits[i][key] = updates[key];
                    }
                }
                kits[i].updatedAt = new Date().toISOString();
                Storage.set(STORAGE_KEY, kits);
                return kits[i];
            }
        }
        return null;
    }

    /**
     * Delete brand kit
     */
    function deleteBrandKit(kitId) {
        var kits = getBrandKits();
        kits = kits.filter(function (k) { return k.id !== kitId; });
        Storage.set(STORAGE_KEY, kits);
    }

    /**
     * Set active brand kit
     */
    function setActiveBrandKit(kitId) {
        Storage.set('activeBrandKit', kitId);
    }

    /**
     * Import brand logos into Premiere Pro project
     */
    function importLogosToProject(kit) {
        if (!kit || !kit.logos || kit.logos.length === 0) {
            return Promise.reject('No logos in brand kit');
        }
        return PPro.callMultiAsync('importBrandAssets', [kit.logos, kit.name + ' Assets']);
    }

    /**
     * Add logo overlay to active sequence
     */
    function addLogoToSequence(logoIndex, position) {
        var pos = position || { x: 0.85, y: 0.1, scale: 15 };
        return PPro.callMultiAsync('addLogoOverlay', [logoIndex, 1, 0, 0, pos]);
    }

    /**
     * Get fonts used in current project
     */
    function getProjectFonts() {
        return PPro.callAsync('getProjectFonts');
    }

    /**
     * Render brand kit UI
     */
    function renderUI(container) {
        var kits = getBrandKits();
        var active = getActiveBrandKit();

        var html = '<div class="module-section">';
        html += '<h3>Brand Kit</h3>';

        // Brand kit selector
        if (kits.length > 0) {
            html += '<div class="brand-selector">';
            html += '<select id="brand-kit-select">';
            for (var i = 0; i < kits.length; i++) {
                var sel = (active && active.id === kits[i].id) ? ' selected' : '';
                html += '<option value="' + kits[i].id + '"' + sel + '>' + kits[i].name + '</option>';
            }
            html += '</select>';
            html += '<button class="btn btn-sm btn-danger" id="btn-delete-brand">Delete</button>';
            html += '</div>';
        }

        // Active brand kit display
        if (active) {
            html += '<div class="brand-display">';

            // Colors
            html += '<div class="brand-colors">';
            html += '<h4>Colors</h4>';
            html += '<div class="color-swatches">';
            for (var colorName in active.colors) {
                html += '<div class="color-swatch">';
                html += '<div class="swatch-preview" style="background-color:' + active.colors[colorName] + '"></div>';
                html += '<span class="swatch-label">' + colorName + '</span>';
                html += '<span class="swatch-value">' + active.colors[colorName] + '</span>';
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';

            // Fonts
            html += '<div class="brand-fonts">';
            html += '<h4>Fonts</h4>';
            for (var fontRole in active.fonts) {
                html += '<div class="font-item">';
                html += '<span class="font-role">' + fontRole + ':</span>';
                html += '<span class="font-name">' + active.fonts[fontRole] + '</span>';
                html += '</div>';
            }
            html += '</div>';

            // Logos
            html += '<div class="brand-logos">';
            html += '<h4>Logos (' + active.logos.length + ')</h4>';
            for (var l = 0; l < active.logos.length; l++) {
                html += '<div class="logo-item">';
                html += '<span>' + getFileName(active.logos[l]) + '</span>';
                html += '</div>';
            }
            html += '<button class="btn btn-secondary btn-sm" id="btn-import-logos">Import to PPro</button>';
            html += '<button class="btn btn-secondary btn-sm" id="btn-add-logo-overlay">Add Logo Overlay</button>';
            html += '</div>';

            // Guidelines
            if (active.guidelines) {
                html += '<div class="brand-guidelines">';
                html += '<h4>Guidelines</h4>';
                html += '<p>' + active.guidelines + '</p>';
                html += '</div>';
            }

            html += '</div>'; // brand-display
        }

        // New brand kit form
        html += '<div class="brand-form">';
        html += '<h4>' + (kits.length === 0 ? 'Create Your First Brand Kit' : 'Add New Brand Kit') + '</h4>';
        html += '<div class="form-row"><label>Brand Name</label><input type="text" id="brand-name" placeholder="My Brand"></div>';

        html += '<div class="form-group"><label>Colors</label>';
        html += '<div class="form-row"><label>Primary</label><input type="color" id="brand-color-primary" value="#1a73e8"><input type="text" id="brand-color-primary-hex" value="#1a73e8"></div>';
        html += '<div class="form-row"><label>Secondary</label><input type="color" id="brand-color-secondary" value="#ffffff"><input type="text" id="brand-color-secondary-hex" value="#ffffff"></div>';
        html += '<div class="form-row"><label>Accent</label><input type="color" id="brand-color-accent" value="#ff5722"><input type="text" id="brand-color-accent-hex" value="#ff5722"></div>';
        html += '<div class="form-row"><label>Background</label><input type="color" id="brand-color-bg" value="#000000"><input type="text" id="brand-color-bg-hex" value="#000000"></div>';
        html += '<div class="form-row"><label>Text</label><input type="color" id="brand-color-text" value="#ffffff"><input type="text" id="brand-color-text-hex" value="#ffffff"></div>';
        html += '</div>';

        html += '<div class="form-group"><label>Fonts</label>';
        html += '<div class="form-row"><label>Heading</label><input type="text" id="brand-font-heading" placeholder="Montserrat Bold"></div>';
        html += '<div class="form-row"><label>Body</label><input type="text" id="brand-font-body" placeholder="Open Sans Regular"></div>';
        html += '<div class="form-row"><label>Accent</label><input type="text" id="brand-font-accent" placeholder="Playfair Display Italic"></div>';
        html += '</div>';

        html += '<div class="form-group"><label>Logo Paths (one per line)</label>';
        html += '<textarea id="brand-logos" rows="3" placeholder="C:\\Brand\\logo.png\nC:\\Brand\\logo-white.png"></textarea>';
        html += '</div>';

        html += '<div class="form-row"><label>Guidelines</label><textarea id="brand-guidelines" rows="2" placeholder="Brand usage notes..."></textarea></div>';

        html += '<button class="btn btn-primary" id="btn-create-brand">Save Brand Kit</button>';
        html += '<button class="btn btn-secondary" id="btn-scan-fonts">Scan PPro Fonts</button>';
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;

        bindBrandEvents(container);
    }

    function bindBrandEvents(container) {
        // Color picker sync
        var colorInputs = ['primary', 'secondary', 'accent', 'bg', 'text'];
        colorInputs.forEach(function (name) {
            var picker = container.querySelector('#brand-color-' + name);
            var hex = container.querySelector('#brand-color-' + name + '-hex');
            if (picker && hex) {
                picker.addEventListener('input', function () { hex.value = this.value; });
                hex.addEventListener('input', function () { picker.value = this.value; });
            }
        });

        // Brand kit selector
        var select = container.querySelector('#brand-kit-select');
        if (select) {
            select.addEventListener('change', function () {
                setActiveBrandKit(this.value);
                renderUI(container);
            });
        }

        // Delete brand
        var delBtn = container.querySelector('#btn-delete-brand');
        if (delBtn) {
            delBtn.addEventListener('click', function () {
                var active = getActiveBrandKit();
                if (active && confirm('Delete brand kit "' + active.name + '"?')) {
                    deleteBrandKit(active.id);
                    showNotification('Brand kit deleted', 'success');
                    renderUI(container);
                }
            });
        }

        // Create brand
        var createBtn = container.querySelector('#btn-create-brand');
        if (createBtn) {
            createBtn.addEventListener('click', function () {
                var name = container.querySelector('#brand-name').value;
                if (!name) { showNotification('Brand name required', 'error'); return; }

                var logoText = container.querySelector('#brand-logos').value;
                var logos = logoText ? logoText.split('\n').filter(function (l) { return l.trim(); }) : [];

                var kit = createBrandKit({
                    name: name,
                    colors: {
                        primary: container.querySelector('#brand-color-primary-hex').value,
                        secondary: container.querySelector('#brand-color-secondary-hex').value,
                        accent: container.querySelector('#brand-color-accent-hex').value,
                        background: container.querySelector('#brand-color-bg-hex').value,
                        text: container.querySelector('#brand-color-text-hex').value
                    },
                    fonts: {
                        heading: container.querySelector('#brand-font-heading').value || 'Arial Bold',
                        body: container.querySelector('#brand-font-body').value || 'Arial',
                        accent: container.querySelector('#brand-font-accent').value || 'Arial Italic'
                    },
                    logos: logos,
                    guidelines: container.querySelector('#brand-guidelines').value
                });

                setActiveBrandKit(kit.id);
                showNotification('Brand kit created: ' + name, 'success');
                renderUI(container);
            });
        }

        // Import logos
        var importBtn = container.querySelector('#btn-import-logos');
        if (importBtn) {
            importBtn.addEventListener('click', function () {
                var active = getActiveBrandKit();
                if (!active) return;
                importLogosToProject(active)
                    .then(function (res) {
                        showNotification('Logos imported to PPro project', 'success');
                    })
                    .catch(function (err) {
                        showNotification('Import error: ' + err, 'error');
                    });
            });
        }

        // Add logo overlay
        var overlayBtn = container.querySelector('#btn-add-logo-overlay');
        if (overlayBtn) {
            overlayBtn.addEventListener('click', function () {
                addLogoToSequence(0, { x: 0.85, y: 0.1, scale: 15 })
                    .then(function () { showNotification('Logo overlay added!', 'success'); })
                    .catch(function (err) { showNotification('Error: ' + err, 'error'); });
            });
        }

        // Scan fonts
        var scanBtn = container.querySelector('#btn-scan-fonts');
        if (scanBtn) {
            scanBtn.addEventListener('click', function () {
                getProjectFonts()
                    .then(function (fonts) {
                        showNotification('Found ' + fonts.length + ' font references in project', 'success');
                    })
                    .catch(function (err) {
                        showNotification('Scan error: ' + err, 'error');
                    });
            });
        }
    }

    function getFileName(path) {
        return path.replace(/^.*[\\\/]/, '');
    }

    return {
        getBrandKits: getBrandKits,
        getActiveBrandKit: getActiveBrandKit,
        createBrandKit: createBrandKit,
        updateBrandKit: updateBrandKit,
        deleteBrandKit: deleteBrandKit,
        setActiveBrandKit: setActiveBrandKit,
        importLogosToProject: importLogosToProject,
        addLogoToSequence: addLogoToSequence,
        renderUI: renderUI
    };

})();
