/**
 * Module 6: Dynamic Promo Rules Engine
 * Define rules that auto-generate promos based on triggers.
 */

var RulesEngine = (function () {

    var STORAGE_KEY = 'promoRules';

    // Predefined trigger types
    var TRIGGER_TYPES = {
        'day-of-week': { label: 'Day of Week', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
        'festival': { label: 'Festival/Event', options: ['Diwali', 'Holi', 'Eid', 'Christmas', 'New Year', 'Republic Day', 'Independence Day', 'Navratri', 'Raksha Bandhan', 'Valentines Day', 'Black Friday', 'Custom'] },
        'date-range': { label: 'Date Range', options: [] },
        'recurring': { label: 'Recurring', options: ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'] },
        'manual': { label: 'Manual Trigger', options: [] }
    };

    // Promo types
    var PROMO_TYPES = {
        'discount': { label: 'Discount/Sale', fields: ['discount_percent', 'original_price', 'sale_price'] },
        'new-launch': { label: 'New Product Launch', fields: ['product_name', 'tagline'] },
        'event': { label: 'Event/Festival', fields: ['event_name', 'event_date'] },
        'announcement': { label: 'General Announcement', fields: ['headline', 'subtext'] },
        'flash-sale': { label: 'Flash Sale', fields: ['discount_percent', 'duration_hours'] },
        'testimonial': { label: 'Customer Testimonial', fields: ['customer_name', 'quote'] }
    };

    /**
     * Get all rules
     */
    function getRules() {
        return Storage.get(STORAGE_KEY, []);
    }

    /**
     * Save rules
     */
    function saveRules(rules) {
        Storage.set(STORAGE_KEY, rules);
    }

    /**
     * Create a new rule
     */
    function createRule(rule) {
        var rules = getRules();
        rule.id = 'rule_' + Date.now();
        rule.enabled = true;
        rule.createdAt = new Date().toISOString();
        rule.lastTriggered = null;
        rule.triggerCount = 0;
        rules.push(rule);
        saveRules(rules);
        return rule;
    }

    /**
     * Update rule
     */
    function updateRule(ruleId, updates) {
        var rules = getRules();
        for (var i = 0; i < rules.length; i++) {
            if (rules[i].id === ruleId) {
                for (var key in updates) {
                    if (updates.hasOwnProperty(key)) {
                        rules[i][key] = updates[key];
                    }
                }
                saveRules(rules);
                return rules[i];
            }
        }
        return null;
    }

    /**
     * Delete rule
     */
    function deleteRule(ruleId) {
        var rules = getRules();
        rules = rules.filter(function (r) { return r.id !== ruleId; });
        saveRules(rules);
    }

    /**
     * Toggle rule enabled/disabled
     */
    function toggleRule(ruleId) {
        var rules = getRules();
        for (var i = 0; i < rules.length; i++) {
            if (rules[i].id === ruleId) {
                rules[i].enabled = !rules[i].enabled;
                saveRules(rules);
                return rules[i];
            }
        }
        return null;
    }

    /**
     * Check which rules should trigger today
     */
    function checkTriggers() {
        var rules = getRules();
        var today = new Date();
        var dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
        var dateStr = today.toISOString().split('T')[0];
        var triggered = [];

        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (!rule.enabled) continue;

            var shouldTrigger = false;

            switch (rule.triggerType) {
                case 'day-of-week':
                    shouldTrigger = (rule.triggerValue === dayName);
                    break;
                case 'festival':
                    shouldTrigger = (rule.triggerDate === dateStr);
                    break;
                case 'date-range':
                    shouldTrigger = (dateStr >= rule.triggerStart && dateStr <= rule.triggerEnd);
                    break;
                case 'recurring':
                    shouldTrigger = checkRecurring(rule, today);
                    break;
                case 'manual':
                    shouldTrigger = false; // Only manual
                    break;
            }

            if (shouldTrigger) {
                triggered.push(rule);
            }
        }

        return triggered;
    }

    function checkRecurring(rule, today) {
        if (!rule.lastTriggered) return true;

        var last = new Date(rule.lastTriggered);
        var diffDays = Math.floor((today - last) / (24 * 60 * 60 * 1000));

        switch (rule.triggerValue) {
            case 'Daily': return diffDays >= 1;
            case 'Weekly': return diffDays >= 7;
            case 'Bi-Weekly': return diffDays >= 14;
            case 'Monthly': return diffDays >= 30;
        }
        return false;
    }

    /**
     * Execute a rule - generate promo in Premiere Pro
     */
    function executeRule(ruleId) {
        var rules = getRules();
        var rule = null;
        for (var i = 0; i < rules.length; i++) {
            if (rules[i].id === ruleId) { rule = rules[i]; break; }
        }

        if (!rule) return Promise.reject('Rule not found');

        // Build the generation config
        var genConfig = {
            templateSequence: rule.templateSequence,
            outputName: rule.outputName || ('Promo_' + rule.promoType + '_' + Date.now()),
            type: rule.promoType,
            platform: rule.platform,
            textReplacements: buildTextReplacements(rule),
            scheduledDate: new Date().toISOString().split('T')[0]
        };

        return PPro.callAsync('generatePromoFromRule', genConfig)
            .then(function (result) {
                // Update rule trigger stats
                updateRule(ruleId, {
                    lastTriggered: new Date().toISOString(),
                    triggerCount: (rule.triggerCount || 0) + 1
                });
                return result;
            });
    }

    /**
     * Execute all triggered rules
     */
    function executeTriggeredRules() {
        var triggered = checkTriggers();
        if (triggered.length === 0) return Promise.resolve([]);

        var results = [];
        function execNext(idx) {
            if (idx >= triggered.length) return Promise.resolve(results);
            return executeRule(triggered[idx].id)
                .then(function (res) {
                    results.push({ rule: triggered[idx].name, result: res });
                    return execNext(idx + 1);
                })
                .catch(function (err) {
                    results.push({ rule: triggered[idx].name, error: String(err) });
                    return execNext(idx + 1);
                });
        }

        return execNext(0);
    }

    function buildTextReplacements(rule) {
        var replacements = [];
        if (rule.fields) {
            for (var field in rule.fields) {
                if (rule.fields.hasOwnProperty(field) && rule.fields[field]) {
                    replacements.push({
                        property: field,
                        value: rule.fields[field]
                    });
                }
            }
        }
        return replacements;
    }

    /**
     * Render rules engine UI
     */
    function renderUI(container) {
        var rules = getRules();
        var triggered = checkTriggers();

        var html = '<div class="module-section">';
        html += '<h3>Promo Rules Engine</h3>';

        // Triggered rules alert
        if (triggered.length > 0) {
            html += '<div class="alert alert-info">';
            html += '<strong>' + triggered.length + ' rule(s) ready to trigger today!</strong>';
            html += '<button class="btn btn-sm btn-primary" id="btn-exec-all-rules">Execute All</button>';
            html += '</div>';
        }

        // Existing rules list
        html += '<div class="rules-list">';
        html += '<h4>Active Rules (' + rules.length + ')</h4>';

        if (rules.length === 0) {
            html += '<p class="empty-state">No rules defined. Create your first rule below.</p>';
        }

        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            var isTriggered = triggered.some(function (t) { return t.id === r.id; });

            html += '<div class="rule-card' + (r.enabled ? '' : ' rule-disabled') + (isTriggered ? ' rule-triggered' : '') + '">';
            html += '<div class="rule-header">';
            html += '<label class="toggle-switch">';
            html += '<input type="checkbox" class="rule-toggle" data-id="' + r.id + '"' + (r.enabled ? ' checked' : '') + '>';
            html += '<span class="toggle-slider"></span>';
            html += '</label>';
            html += '<strong>' + r.name + '</strong>';
            if (isTriggered) html += '<span class="badge badge-active">READY</span>';
            html += '</div>';
            html += '<div class="rule-details">';
            html += '<span>Trigger: ' + r.triggerType + ' → ' + (r.triggerValue || r.triggerDate || '') + '</span>';
            html += '<span>Template: ' + r.templateSequence + '</span>';
            html += '<span>Type: ' + r.promoType + '</span>';
            if (r.lastTriggered) html += '<span>Last run: ' + r.lastTriggered.split('T')[0] + ' (' + r.triggerCount + 'x)</span>';
            html += '</div>';
            html += '<div class="rule-actions">';
            html += '<button class="btn btn-sm btn-primary btn-exec-rule" data-id="' + r.id + '">Run Now</button>';
            html += '<button class="btn btn-sm btn-danger btn-delete-rule" data-id="' + r.id + '">Delete</button>';
            html += '</div>';
            html += '</div>';
        }

        html += '</div>';

        // New rule form
        html += '<div class="rule-form">';
        html += '<h4>Create New Rule</h4>';

        html += '<div class="form-row"><label>Rule Name</label><input type="text" id="rule-name" placeholder="Friday Flash Sale"></div>';

        // Trigger type
        html += '<div class="form-row"><label>Trigger Type</label>';
        html += '<select id="rule-trigger-type">';
        for (var tt in TRIGGER_TYPES) {
            html += '<option value="' + tt + '">' + TRIGGER_TYPES[tt].label + '</option>';
        }
        html += '</select></div>';

        // Trigger value (dynamic)
        html += '<div id="trigger-value-container">';
        html += '<div class="form-row"><label>Trigger Value</label>';
        html += '<select id="rule-trigger-value">';
        var firstType = TRIGGER_TYPES['day-of-week'];
        for (var o = 0; o < firstType.options.length; o++) {
            html += '<option value="' + firstType.options[o] + '">' + firstType.options[o] + '</option>';
        }
        html += '</select></div>';
        html += '</div>';

        // Date fields (hidden by default)
        html += '<div id="trigger-date-container" style="display:none">';
        html += '<div class="form-row"><label>Trigger Date</label><input type="date" id="rule-trigger-date"></div>';
        html += '</div>';
        html += '<div id="trigger-range-container" style="display:none">';
        html += '<div class="form-row"><label>Start Date</label><input type="date" id="rule-trigger-start"></div>';
        html += '<div class="form-row"><label>End Date</label><input type="date" id="rule-trigger-end"></div>';
        html += '</div>';

        // Promo type
        html += '<div class="form-row"><label>Promo Type</label>';
        html += '<select id="rule-promo-type">';
        for (var pt in PROMO_TYPES) {
            html += '<option value="' + pt + '">' + PROMO_TYPES[pt].label + '</option>';
        }
        html += '</select></div>';

        // Template sequence
        html += '<div class="form-row"><label>Source Template Sequence</label><input type="text" id="rule-template-seq" placeholder="Template_Square"></div>';

        // Output name
        html += '<div class="form-row"><label>Output Name Pattern</label><input type="text" id="rule-output-name" placeholder="FlashSale_{date}"></div>';

        // Platform
        html += '<div class="form-row"><label>Target Platform</label>';
        html += '<select id="rule-platform"><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option><option value="twitter">Twitter/X</option><option value="all">All Platforms</option></select></div>';

        // Dynamic text fields
        html += '<div class="form-group" id="rule-fields-container">';
        html += '<label>Text Replacements</label>';
        html += '<div class="form-row"><label>Headline</label><input type="text" class="rule-field" data-field="Headline" placeholder="50% OFF!"></div>';
        html += '<div class="form-row"><label>Subtext</label><input type="text" class="rule-field" data-field="Subtext" placeholder="Limited time offer"></div>';
        html += '<div class="form-row"><label>CTA</label><input type="text" class="rule-field" data-field="CTA" placeholder="Shop Now"></div>';
        html += '</div>';

        html += '<button class="btn btn-primary" id="btn-create-rule">Create Rule</button>';
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;

        bindRuleEvents(container);
    }

    function bindRuleEvents(container) {
        // Trigger type change
        var triggerSelect = container.querySelector('#rule-trigger-type');
        if (triggerSelect) {
            triggerSelect.addEventListener('change', function () {
                var type = this.value;
                var valueContainer = container.querySelector('#trigger-value-container');
                var dateContainer = container.querySelector('#trigger-date-container');
                var rangeContainer = container.querySelector('#trigger-range-container');

                valueContainer.style.display = 'none';
                dateContainer.style.display = 'none';
                rangeContainer.style.display = 'none';

                if (type === 'day-of-week' || type === 'recurring') {
                    valueContainer.style.display = 'block';
                    var sel = container.querySelector('#rule-trigger-value');
                    sel.innerHTML = '';
                    var opts = TRIGGER_TYPES[type].options;
                    for (var i = 0; i < opts.length; i++) {
                        sel.innerHTML += '<option value="' + opts[i] + '">' + opts[i] + '</option>';
                    }
                } else if (type === 'festival') {
                    valueContainer.style.display = 'block';
                    dateContainer.style.display = 'block';
                    var sel2 = container.querySelector('#rule-trigger-value');
                    sel2.innerHTML = '';
                    var opts2 = TRIGGER_TYPES[type].options;
                    for (var j = 0; j < opts2.length; j++) {
                        sel2.innerHTML += '<option value="' + opts2[j] + '">' + opts2[j] + '</option>';
                    }
                } else if (type === 'date-range') {
                    rangeContainer.style.display = 'block';
                }
            });
        }

        // Create rule
        var createBtn = container.querySelector('#btn-create-rule');
        if (createBtn) {
            createBtn.addEventListener('click', function () {
                var name = container.querySelector('#rule-name').value;
                if (!name) { showNotification('Rule name required', 'error'); return; }

                var triggerType = container.querySelector('#rule-trigger-type').value;

                // Gather text field values
                var fields = {};
                var fieldInputs = container.querySelectorAll('.rule-field');
                for (var i = 0; i < fieldInputs.length; i++) {
                    var fname = fieldInputs[i].getAttribute('data-field');
                    var fval = fieldInputs[i].value;
                    if (fval) fields[fname] = fval;
                }

                var rule = {
                    name: name,
                    triggerType: triggerType,
                    triggerValue: container.querySelector('#rule-trigger-value') ? container.querySelector('#rule-trigger-value').value : '',
                    triggerDate: container.querySelector('#rule-trigger-date') ? container.querySelector('#rule-trigger-date').value : '',
                    triggerStart: container.querySelector('#rule-trigger-start') ? container.querySelector('#rule-trigger-start').value : '',
                    triggerEnd: container.querySelector('#rule-trigger-end') ? container.querySelector('#rule-trigger-end').value : '',
                    promoType: container.querySelector('#rule-promo-type').value,
                    templateSequence: container.querySelector('#rule-template-seq').value,
                    outputName: container.querySelector('#rule-output-name').value,
                    platform: container.querySelector('#rule-platform').value,
                    fields: fields
                };

                createRule(rule);
                showNotification('Rule created: ' + name, 'success');
                renderUI(container);
            });
        }

        // Toggle rules
        var toggles = container.querySelectorAll('.rule-toggle');
        for (var t = 0; t < toggles.length; t++) {
            toggles[t].addEventListener('change', function () {
                toggleRule(this.getAttribute('data-id'));
            });
        }

        // Execute single rule
        var execBtns = container.querySelectorAll('.btn-exec-rule');
        for (var e = 0; e < execBtns.length; e++) {
            execBtns[e].addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                executeRule(id)
                    .then(function (res) {
                        showNotification('Rule executed! Sequence: ' + res.sequenceName, 'success');
                        renderUI(container);
                    })
                    .catch(function (err) {
                        showNotification('Execution error: ' + err, 'error');
                    });
            });
        }

        // Delete rule
        var delBtns = container.querySelectorAll('.btn-delete-rule');
        for (var d = 0; d < delBtns.length; d++) {
            delBtns[d].addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                deleteRule(id);
                showNotification('Rule deleted', 'success');
                renderUI(container);
            });
        }

        // Execute all triggered
        var execAllBtn = container.querySelector('#btn-exec-all-rules');
        if (execAllBtn) {
            execAllBtn.addEventListener('click', function () {
                executeTriggeredRules()
                    .then(function (results) {
                        showNotification(results.length + ' rules executed!', 'success');
                        renderUI(container);
                    });
            });
        }
    }

    return {
        getRules: getRules,
        createRule: createRule,
        updateRule: updateRule,
        deleteRule: deleteRule,
        toggleRule: toggleRule,
        checkTriggers: checkTriggers,
        executeRule: executeRule,
        executeTriggeredRules: executeTriggeredRules,
        TRIGGER_TYPES: TRIGGER_TYPES,
        PROMO_TYPES: PROMO_TYPES,
        renderUI: renderUI
    };

})();
