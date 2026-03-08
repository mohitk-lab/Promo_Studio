/**
 * Promo Studio - Main Application Controller
 * Manages tab navigation, module initialization, and global state.
 */

(function () {
    'use strict';

    var currentTab = 'overview';
    var modules = {
        templates: TemplateGenerator,
        export: MultiExport,
        scheduler: CampaignScheduler,
        brandkit: BrandKit,
        rules: RulesEngine,
        assets: AssetLibrary
    };

    /**
     * Initialize the application
     */
    function init() {
        // Initialize global error handler
        ErrorHandler.initGlobalHandler();
        ErrorHandler.log(ErrorHandler.SEVERITY.INFO, 'App', 'Promo Studio initialized');

        // Initialize PPro event listeners
        PPro.initEventListeners();

        // Auto-refresh dashboard when project or sequence changes
        PPro.on('projectChanged', function () {
            ErrorHandler.log(ErrorHandler.SEVERITY.INFO, 'App', 'Project changed - refreshing');
            if (currentTab === 'overview') renderOverview();
        });
        PPro.on('sequenceChanged', function () {
            ErrorHandler.log(ErrorHandler.SEVERITY.INFO, 'App', 'Active sequence changed');
            if (currentTab === 'overview') renderOverview();
        });
        PPro.on('itemAdded', function () {
            ErrorHandler.log(ErrorHandler.SEVERITY.INFO, 'App', 'Media imported');
            if (currentTab === 'assets') modules.assets.renderUI(document.getElementById('panel-assets'));
        });

        // Initialize dark mode toggle
        initThemeToggle();

        renderOverview();
        bindNavigation();
        checkTriggeredRules();

        // Auto-attach browse buttons after any tab renders
        var observer = new MutationObserver(function () {
            FilePicker.autoAttachBrowseButtons();
        });
        observer.observe(document.querySelector('.tab-content'), { childList: true, subtree: true });
    }

    /**
     * Bind tab navigation
     */
    function bindNavigation() {
        var tabs = document.querySelectorAll('.nav-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function () {
                switchTab(this.getAttribute('data-tab'));
            });
        }
    }

    /**
     * Switch to a tab
     */
    function switchTab(tabName) {
        currentTab = tabName;

        // Update nav active state
        var tabs = document.querySelectorAll('.nav-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabName);
        }

        // Update panel visibility
        var panels = document.querySelectorAll('.tab-panel');
        for (var j = 0; j < panels.length; j++) {
            panels[j].classList.toggle('active', panels[j].id === 'panel-' + tabName);
        }

        // Render module content
        var container = document.getElementById('panel-' + tabName);
        if (!container) return;

        switch (tabName) {
            case 'overview':
                renderOverview();
                break;
            case 'templates':
                modules.templates.renderUI(container);
                break;
            case 'export':
                modules.export.renderUI(container);
                break;
            case 'scheduler':
                modules.scheduler.renderUI(container);
                break;
            case 'brandkit':
                modules.brandkit.renderUI(container);
                break;
            case 'rules':
                modules.rules.renderUI(container);
                break;
            case 'assets':
                modules.assets.renderUI(container);
                break;
        }
    }

    /**
     * Render overview/dashboard tab
     */
    function renderOverview() {
        var container = document.getElementById('panel-overview');
        if (!container) return;

        var campaigns = CampaignScheduler.getUpcoming();
        var rules = RulesEngine.getRules();
        var triggered = RulesEngine.checkTriggers();
        var brandKits = BrandKit.getBrandKits();
        var templates = TemplateGenerator.getTemplates();

        var html = '<div class="module-section">';
        html += '<h3>Dashboard</h3>';

        // Stats grid
        html += '<div class="overview-grid">';
        html += '<div class="overview-card"><div class="stat-value">' + Object.keys(templates).length + '</div><div class="stat-label">Templates</div></div>';
        html += '<div class="overview-card"><div class="stat-value">' + campaigns.length + '</div><div class="stat-label">Upcoming Campaigns</div></div>';
        html += '<div class="overview-card"><div class="stat-value">' + rules.length + '</div><div class="stat-label">Active Rules</div></div>';
        html += '<div class="overview-card"><div class="stat-value">' + brandKits.length + '</div><div class="stat-label">Brand Kits</div></div>';
        html += '</div>';

        // Triggered rules alert
        if (triggered.length > 0) {
            html += '<div class="alert alert-info">';
            html += '<strong>' + triggered.length + ' rule(s) ready to execute today</strong>';
            html += '<button class="btn btn-sm btn-primary" onclick="switchTab(\'rules\')">View Rules</button>';
            html += '</div>';
        }

        // Quick actions
        html += '<h4>Quick Actions</h4>';
        html += '<div class="quick-actions">';
        html += '<button class="btn btn-primary" onclick="switchTab(\'templates\')">New Promo</button>';
        html += '<button class="btn btn-secondary" onclick="switchTab(\'export\')">Export</button>';
        html += '<button class="btn btn-secondary" onclick="switchTab(\'scheduler\')">Schedule</button>';
        html += '<button class="btn btn-secondary" onclick="switchTab(\'assets\')">Assets</button>';
        html += '</div>';

        // Project info
        html += '<h4>Project Info</h4>';
        html += '<div id="project-info-area"><p class="empty-state">Loading project info...</p></div>';

        html += '</div>';
        container.innerHTML = html;

        // Load project info from Premiere Pro
        PPro.call('getProjectInfo', null, function (result) {
            var infoArea = document.getElementById('project-info-area');
            if (!infoArea) return;

            if (result && result.success) {
                var d = result.data;
                var infoHtml = '<div class="asset-card">';
                infoHtml += '<div class="asset-info">';
                infoHtml += '<strong>Project: ' + d.name + '</strong>';
                infoHtml += '<span class="asset-path">' + d.path + '</span>';
                infoHtml += '<span class="asset-path">Sequences: ' + d.sequences.length + ' | Root Items: ' + d.rootItems.length + '</span>';
                infoHtml += '</div>';
                infoHtml += '</div>';
                infoArea.innerHTML = infoHtml;
            } else {
                infoArea.innerHTML = '<p class="empty-state">Open a Premiere Pro project to see info here</p>';
            }
        });
    }

    /**
     * Check triggered rules on load
     */
    function checkTriggeredRules() {
        var triggered = RulesEngine.checkTriggers();
        if (triggered.length > 0) {
            showNotification(triggered.length + ' promo rule(s) ready to execute today!', 'info');
        }
    }

    /**
     * Dark mode toggle
     */
    function initThemeToggle() {
        var toggle = document.getElementById('theme-switch');
        var icon = document.getElementById('theme-icon');
        if (!toggle) return;

        // Load saved preference
        var saved = Storage.get('theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            toggle.checked = true;
            if (icon) icon.innerHTML = '&#9790;';
        }

        toggle.addEventListener('change', function () {
            if (this.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                Storage.set('theme', 'dark');
                if (icon) icon.innerHTML = '&#9790;';
            } else {
                document.documentElement.removeAttribute('data-theme');
                Storage.set('theme', 'light');
                if (icon) icon.innerHTML = '&#9788;';
            }
        });
    }

    // Expose switchTab globally for inline onclick handlers
    window.switchTab = switchTab;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

/**
 * Global notification helper
 */
function showNotification(message, type) {
    var el = document.getElementById('notification');
    if (!el) {
        el = document.createElement('div');
        el.id = 'notification';
        el.className = 'notification';
        document.body.appendChild(el);
    }

    el.textContent = message;
    el.className = 'notification ' + (type || 'info');

    // Trigger show
    setTimeout(function () { el.classList.add('show'); }, 10);

    // Auto hide after 3 seconds
    setTimeout(function () {
        el.classList.remove('show');
    }, 3000);
}
