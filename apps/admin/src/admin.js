// Admin Dashboard JavaScript
const API_BASE_URL = 'https://fringe-api.hraasing.workers.dev';

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadShows();
    loadLogs();
    loadStats();
    
    // Add show form handler
    document.getElementById('add-show-form').addEventListener('submit', handleAddShow);
});

// Tab switching
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // Load data for tab
    if (tabName === 'shows') loadShows();
    if (tabName === 'logs') loadLogs();
    if (tabName === 'stats') loadStats();
}

// Load shows list
async function loadShows() {
    try {
        const response = await fetch(`${API_BASE_URL}/shows?include_inactive=true`);
        const data = await response.json();
        
        const tbody = document.getElementById('shows-list');
        
        if (data.shows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No shows found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.shows.map(show => `
            <tr>
                <td><strong>${escapeHtml(show.title)}</strong></td>
                <td>${escapeHtml(show.venue || '-')}</td>
                <td>${escapeHtml(show.genre || '-')}</td>
                <td>${show.performance_count}</td>
                <td>${formatDateTime(show.last_scraped)}</td>
                <td>
                    <span class="${show.is_active ? 'status-success' : 'status-error'}">
                        ${show.is_active ? '✓ Active' : '✗ Inactive'}
                    </span>
                </td>
                <td>
                    ${show.is_active ? 
                        `<button class="btn btn-danger" onclick="deleteShow(${show.id})">🗑️ Remove</button>` :
                        `<button class="btn btn-success" onclick="reactivateShow(${show.id})">↻ Reactivate</button>`
                    }
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading shows:', error);
        showAlert('Failed to load shows: ' + error.message, 'error');
    }
}

// Handle add show form submission
async function handleAddShow(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('show-title').value,
        url: document.getElementById('show-url').value,
        venue: document.getElementById('show-venue').value,
        genre: document.getElementById('show-genre').value,
        price_range: document.getElementById('show-price').value,
        rating: document.getElementById('show-rating').value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/shows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert(`Show "${formData.title}" added successfully!`, 'success');
            document.getElementById('add-show-form').reset();
            loadShows(); // Refresh the list
        } else {
            throw new Error(result.error || 'Failed to add show');
        }
        
    } catch (error) {
        console.error('Error adding show:', error);
        showAlert('Failed to add show: ' + error.message, 'error');
    }
}

// Delete show
async function deleteShow(showId) {
    if (!confirm('Are you sure you want to remove this show from monitoring?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/shows/${showId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('Show removed from monitoring', 'success');
            loadShows(); // Refresh the list
        } else {
            const result = await response.json();
            throw new Error(result.error || 'Failed to delete show');
        }
        
    } catch (error) {
        console.error('Error deleting show:', error);
        showAlert('Failed to delete show: ' + error.message, 'error');
    }
}

// Load scrape logs
async function loadLogs() {
    try {
        const response = await fetch(`https://fringe-scheduler.hraasing.workers.dev/status`);
        const data = await response.json();
        
        const tbody = document.getElementById('logs-list');
        
        if (!data.recentLogs || data.recentLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No logs found</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.recentLogs.map(log => `
            <tr>
                <td>${escapeHtml(log.title)}</td>
                <td>
                    <span class="${log.status === 'success' ? 'status-success' : 'status-error'}">
                        ${log.status === 'success' ? '✓' : '✗'} ${log.status.toUpperCase()}
                    </span>
                </td>
                <td>${log.performances_found || 0}</td>
                <td>${log.duration_ms ? Math.round(log.duration_ms / 1000) + 's' : '-'}</td>
                <td>${log.error_message ? escapeHtml(log.error_message.substring(0, 50)) + '...' : '-'}</td>
                <td>${formatDateTime(log.scraped_at)}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading logs:', error);
        document.getElementById('logs-list').innerHTML = 
            '<tr><td colspan="6">Failed to load logs</td></tr>';
    }
}

// Load system statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const data = await response.json();
        
        const statsHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 600; color: #3498db;">${data.stats.active_shows}</div>
                    <div style="color: #666;">Active Shows</div>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 600; color: #2ecc71;">${data.stats.available_performances}</div>
                    <div style="color: #666;">Available Performances</div>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 600; color: #2ecc71;">${data.stats.successful_scrapes_24h}</div>
                    <div style="color: #666;">Successful Scrapes (24h)</div>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 600; color: #e74c3c;">${data.stats.failed_scrapes_24h}</div>
                    <div style="color: #666;">Failed Scrapes (24h)</div>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h3>System Information</h3>
                <p><strong>Total Performances:</strong> ${data.stats.total_performances}</p>
                <p><strong>Inactive Shows:</strong> ${data.stats.inactive_shows}</p>
                <p><strong>Last Scrape:</strong> ${formatDateTime(data.stats.last_scrape)}</p>
                <p><strong>Success Rate (24h):</strong> ${calculateSuccessRate(data.stats.successful_scrapes_24h, data.stats.failed_scrapes_24h)}%</p>
            </div>
            
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="triggerManualScrape()">🔄 Trigger Manual Scrape</button>
                <button class="btn btn-primary" onclick="loadStats()">↻ Refresh Stats</button>
            </div>
        `;
        
        document.getElementById('stats-content').innerHTML = statsHtml;
        
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats-content').innerHTML = 'Failed to load statistics';
    }
}

// Trigger manual scrape
async function triggerManualScrape() {
    if (!confirm('This will trigger a manual scrape of all shows. Continue?')) {
        return;
    }
    
    try {
        showAlert('Manual scrape triggered. This may take several minutes...', 'success');
        
        const response = await fetch(`https://fringe-scheduler.hraasing.workers.dev/trigger`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showAlert('Manual scrape started successfully', 'success');
        } else {
            throw new Error('Failed to trigger scrape');
        }
        
    } catch (error) {
        console.error('Error triggering scrape:', error);
        showAlert('Failed to trigger manual scrape: ' + error.message, 'error');
    }
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass}">
            ${escapeHtml(message)}
            <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
        </div>
    `;
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Utility functions
function formatDateTime(dateString) {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-GB');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function calculateSuccessRate(successful, failed) {
    const total = successful + failed;
    if (total === 0) return 100;
    return Math.round((successful / total) * 100);
}