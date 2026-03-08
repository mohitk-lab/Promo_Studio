/**
 * Module 4: Campaign Scheduler
 * Schedule promo exports and manage campaigns with calendar view.
 */

var CampaignScheduler = (function () {

    var STORAGE_KEY = 'campaigns';

    /**
     * Get all campaigns
     */
    function getCampaigns() {
        return Storage.get(STORAGE_KEY, []);
    }

    /**
     * Save campaigns
     */
    function saveCampaigns(campaigns) {
        Storage.set(STORAGE_KEY, campaigns);
    }

    /**
     * Create a new campaign
     */
    function createCampaign(campaign) {
        var campaigns = getCampaigns();
        campaign.id = 'camp_' + Date.now();
        campaign.status = 'scheduled';
        campaign.createdAt = new Date().toISOString();
        campaigns.push(campaign);
        saveCampaigns(campaigns);
        return campaign;
    }

    /**
     * Update campaign
     */
    function updateCampaign(campaignId, updates) {
        var campaigns = getCampaigns();
        for (var i = 0; i < campaigns.length; i++) {
            if (campaigns[i].id === campaignId) {
                for (var key in updates) {
                    if (updates.hasOwnProperty(key)) {
                        campaigns[i][key] = updates[key];
                    }
                }
                saveCampaigns(campaigns);
                return campaigns[i];
            }
        }
        return null;
    }

    /**
     * Delete campaign
     */
    function deleteCampaign(campaignId) {
        var campaigns = getCampaigns();
        campaigns = campaigns.filter(function (c) { return c.id !== campaignId; });
        saveCampaigns(campaigns);
    }

    /**
     * Get campaigns for a specific date
     */
    function getCampaignsForDate(dateStr) {
        var campaigns = getCampaigns();
        return campaigns.filter(function (c) {
            return c.scheduledDate === dateStr;
        });
    }

    /**
     * Get upcoming campaigns (next 30 days)
     */
    function getUpcoming() {
        var campaigns = getCampaigns();
        var now = new Date();
        var thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return campaigns.filter(function (c) {
            var d = new Date(c.scheduledDate);
            return d >= now && d <= thirtyDays;
        }).sort(function (a, b) {
            return new Date(a.scheduledDate) - new Date(b.scheduledDate);
        });
    }

    /**
     * Execute a campaign (export its sequence)
     */
    function executeCampaign(campaignId) {
        var campaigns = getCampaigns();
        var campaign = null;
        for (var i = 0; i < campaigns.length; i++) {
            if (campaigns[i].id === campaignId) {
                campaign = campaigns[i];
                break;
            }
        }

        if (!campaign) return Promise.reject('Campaign not found');

        updateCampaign(campaignId, { status: 'exporting' });

        // Export via Premiere Pro
        return PPro.callMultiAsync('exportSequenceByIndex', [
            campaign.sequenceIndex,
            campaign.outputPath,
            campaign.presetPath || ''
        ]).then(function (result) {
            updateCampaign(campaignId, { status: 'exported', exportedAt: new Date().toISOString() });
            return result;
        }).catch(function (err) {
            updateCampaign(campaignId, { status: 'failed', error: String(err) });
            throw err;
        });
    }

    /**
     * Sync sequences from Premiere Pro to campaign list
     */
    function syncSequences() {
        return PPro.callAsync('getCampaignSequences');
    }

    /**
     * Render calendar view
     */
    function renderUI(container) {
        var now = new Date();
        var currentMonth = Storage.get('calendarMonth', now.getMonth());
        var currentYear = Storage.get('calendarYear', now.getFullYear());

        var html = '<div class="module-section">';
        html += '<h3>Campaign Scheduler</h3>';

        // Calendar navigation
        html += '<div class="calendar-nav">';
        html += '<button class="btn btn-icon" id="cal-prev">&lt;</button>';
        html += '<span class="calendar-title" id="cal-title">' + getMonthName(currentMonth) + ' ' + currentYear + '</span>';
        html += '<button class="btn btn-icon" id="cal-next">&gt;</button>';
        html += '</div>';

        // Calendar grid
        html += '<div class="calendar-grid">';
        html += '<div class="cal-header">Sun</div><div class="cal-header">Mon</div>';
        html += '<div class="cal-header">Tue</div><div class="cal-header">Wed</div>';
        html += '<div class="cal-header">Thu</div><div class="cal-header">Fri</div>';
        html += '<div class="cal-header">Sat</div>';

        var firstDay = new Date(currentYear, currentMonth, 1).getDay();
        var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        var campaigns = getCampaigns();

        // Empty cells before first day
        for (var e = 0; e < firstDay; e++) {
            html += '<div class="cal-day cal-empty"></div>';
        }

        // Day cells
        for (var d = 1; d <= daysInMonth; d++) {
            var dateStr = currentYear + '-' + pad(currentMonth + 1) + '-' + pad(d);
            var dayCampaigns = campaigns.filter(function (c) { return c.scheduledDate === dateStr; });
            var isToday = (d === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear());

            html += '<div class="cal-day' + (isToday ? ' cal-today' : '') + (dayCampaigns.length ? ' cal-has-campaign' : '') + '" data-date="' + dateStr + '">';
            html += '<span class="cal-day-num">' + d + '</span>';
            if (dayCampaigns.length) {
                html += '<span class="cal-campaign-dot">' + dayCampaigns.length + '</span>';
            }
            html += '</div>';
        }

        html += '</div>'; // calendar-grid

        // New campaign form
        html += '<div class="campaign-form">';
        html += '<h4>New Campaign</h4>';
        html += '<div class="form-row"><label>Name</label><input type="text" id="camp-name" placeholder="Diwali Sale Promo"></div>';
        html += '<div class="form-row"><label>Date</label><input type="date" id="camp-date"></div>';
        html += '<div class="form-row"><label>Sequence Index</label><input type="number" id="camp-seq-idx" value="0" min="0"></div>';
        html += '<div class="form-row"><label>Platform</label>';
        html += '<select id="camp-platform"><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="facebook">Facebook</option><option value="twitter">Twitter/X</option><option value="whatsapp">WhatsApp</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option></select></div>';
        html += '<div class="form-row"><label>Output Path</label><input type="text" id="camp-output" placeholder="C:\\Exports\\campaign.mp4"></div>';
        html += '<button class="btn btn-primary" id="btn-create-campaign">Schedule Campaign</button>';
        html += '<button class="btn btn-secondary" id="btn-sync-sequences">Sync from PPro</button>';
        html += '</div>';

        // Upcoming campaigns list
        html += '<div class="campaign-list">';
        html += '<h4>Upcoming Campaigns</h4>';
        var upcoming = getUpcoming();
        if (upcoming.length === 0) {
            html += '<p class="empty-state">No upcoming campaigns</p>';
        } else {
            for (var u = 0; u < upcoming.length; u++) {
                var camp = upcoming[u];
                html += '<div class="campaign-item status-' + camp.status + '">';
                html += '<div class="campaign-info">';
                html += '<strong>' + camp.name + '</strong>';
                html += '<span>' + camp.scheduledDate + ' | ' + camp.platform + '</span>';
                html += '<span class="campaign-status">' + camp.status + '</span>';
                html += '</div>';
                html += '<div class="campaign-actions">';
                if (camp.status === 'scheduled') {
                    html += '<button class="btn btn-sm btn-primary btn-execute-camp" data-id="' + camp.id + '">Export Now</button>';
                }
                html += '<button class="btn btn-sm btn-danger btn-delete-camp" data-id="' + camp.id + '">Delete</button>';
                html += '</div>';
                html += '</div>';
            }
        }
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;

        bindCalendarEvents(container, currentMonth, currentYear);
    }

    function bindCalendarEvents(container, month, year) {
        // Navigation
        container.querySelector('#cal-prev').addEventListener('click', function () {
            month--;
            if (month < 0) { month = 11; year--; }
            Storage.set('calendarMonth', month);
            Storage.set('calendarYear', year);
            renderUI(container);
        });

        container.querySelector('#cal-next').addEventListener('click', function () {
            month++;
            if (month > 11) { month = 0; year++; }
            Storage.set('calendarMonth', month);
            Storage.set('calendarYear', year);
            renderUI(container);
        });

        // Click on calendar day
        var days = container.querySelectorAll('.cal-day[data-date]');
        for (var i = 0; i < days.length; i++) {
            days[i].addEventListener('click', function () {
                var date = this.getAttribute('data-date');
                container.querySelector('#camp-date').value = date;
            });
        }

        // Create campaign
        container.querySelector('#btn-create-campaign').addEventListener('click', function () {
            var name = container.querySelector('#camp-name').value;
            var date = container.querySelector('#camp-date').value;
            if (!name || !date) { showNotification('Name and date required', 'error'); return; }

            createCampaign({
                name: name,
                scheduledDate: date,
                sequenceIndex: parseInt(container.querySelector('#camp-seq-idx').value) || 0,
                platform: container.querySelector('#camp-platform').value,
                outputPath: container.querySelector('#camp-output').value
            });

            showNotification('Campaign scheduled: ' + name, 'success');
            renderUI(container);
        });

        // Sync sequences
        container.querySelector('#btn-sync-sequences').addEventListener('click', function () {
            syncSequences()
                .then(function (sequences) {
                    showNotification('Found ' + sequences.length + ' sequences in project', 'success');
                })
                .catch(function (err) {
                    showNotification('Sync error: ' + err, 'error');
                });
        });

        // Execute campaign
        var execBtns = container.querySelectorAll('.btn-execute-camp');
        for (var e = 0; e < execBtns.length; e++) {
            execBtns[e].addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                executeCampaign(id)
                    .then(function () {
                        showNotification('Campaign export started!', 'success');
                        renderUI(container);
                    })
                    .catch(function (err) {
                        showNotification('Export failed: ' + err, 'error');
                        renderUI(container);
                    });
            });
        }

        // Delete campaign
        var delBtns = container.querySelectorAll('.btn-delete-camp');
        for (var dd = 0; dd < delBtns.length; dd++) {
            delBtns[dd].addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                deleteCampaign(id);
                showNotification('Campaign deleted', 'success');
                renderUI(container);
            });
        }
    }

    function getMonthName(m) {
        return ['January','February','March','April','May','June','July','August','September','October','November','December'][m];
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    return {
        getCampaigns: getCampaigns,
        createCampaign: createCampaign,
        updateCampaign: updateCampaign,
        deleteCampaign: deleteCampaign,
        executeCampaign: executeCampaign,
        getUpcoming: getUpcoming,
        syncSequences: syncSequences,
        renderUI: renderUI
    };

})();
