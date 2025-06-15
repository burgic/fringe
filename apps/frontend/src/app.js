// Edinburgh Fringe Show Finder - Live API Integration
const API_BASE_URL = 'https://fringe-api.hraasing.workers.dev';

// State management
let currentShows = [];
let currentDate = '2025-08-01';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Set default date to today (or keep August 1st for testing)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-picker').value = currentDate;
    
    // Set min date to today
    document.getElementById('date-picker').min = today;
    
    // Add event listeners
    setupEventListeners();
    
    // Load initial data
    await loadShows();
    
    console.log('✅ Fringe Show Finder initialized with live API data');
}

function setupEventListeners() {
    // View switching
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update button states
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Switch views
            const view = btn.dataset.view;
            document.querySelectorAll('.spreadsheet-view, .grid-view').forEach(v => {
                v.classList.remove('active');
            });
            document.getElementById(view + '-view').classList.add('active');
        });
    });

    // Date picker
    document.getElementById('date-picker').addEventListener('change', function() {
        currentDate = this.value;
        console.log('Date changed to:', currentDate);
        loadShows();
    });

    // Availability toggle
    document.getElementById('availability-toggle').addEventListener('click', function() {
        this.classList.toggle('active');
        loadShows(); // Reload data with new filter
    });
}

// Load shows from API
async function loadShows() {
    try {
        showLoading(true);
        
        const availableOnly = document.getElementById('availability-toggle').classList.contains('active');
        const params = new URLSearchParams();
        params.append('date', currentDate);
        if (!availableOnly) params.append('available_only', 'false');
        
        console.log(`Loading shows for ${currentDate}, available only: ${availableOnly}`);
        
        const response = await fetch(`${API_BASE_URL}/lookup?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        currentShows = data.shows || [];
        
        console.log(`Loaded ${currentShows.length} shows:`, currentShows);
        
        updateSpreadsheetView();
        updateGridView();
        
        // Update last updated info
        updateLastUpdated(data.lastUpdated);
        
    } catch (error) {
        console.error('Error loading shows:', error);
        showError(`Failed to load shows: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const mainContent = document.querySelector('.main-content');
    if (show) {
        mainContent.style.opacity = '0.5';
        mainContent.style.pointerEvents = 'none';
    } else {
        mainContent.style.opacity = '1';
        mainContent.style.pointerEvents = 'auto';
    }
}

function showError(message) {
    const tbody = document.querySelector('.spreadsheet-table tbody');
    tbody.innerHTML = `
        <tr>
            <td class="empty-cell error-cell" colspan="5">
                ⚠️ ${message}
                <br><small>Try selecting a different date or refresh the page</small>
            </td>
        </tr>
    `;
    
    const gridView = document.getElementById('grid-view');
    gridView.innerHTML = `
        <div class="error-message">
            <h3>⚠️ ${message}</h3>
            <p>Try selecting a different date or refresh the page</p>
        </div>
    `;
}

// Categorize shows by review category
function categorizeShows() {
    const categories = {
        winners: currentShows.filter(show => show.reviewCategory === 'Great'),
        good: currentShows.filter(show => show.reviewCategory === 'Good'), 
        ok: currentShows.filter(show => show.reviewCategory === 'Ok'),
        raining: currentShows.filter(show => show.reviewCategory === 'If Raining'),
        wild: currentShows.filter(show => show.reviewCategory === 'Wild Cards')
    };
    
    console.log('Categorized shows:', categories);
    return categories;
}

// Update spreadsheet view with real data
function updateSpreadsheetView() {
    const categories = categorizeShows();
    const tbody = document.querySelector('.spreadsheet-table tbody');
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Find max number of shows in any category
    const maxShows = Math.max(
        categories.winners.length,
        categories.good.length, 
        categories.ok.length,
        categories.raining.length,
        categories.wild.length,
        1 // At least one row
    );
    
    console.log(`Creating ${maxShows} rows for spreadsheet`);
    
    // Create rows
    for (let i = 0; i < maxShows; i++) {
        const row = document.createElement('tr');
        
        // Add cells for each category
        ['winners', 'good', 'ok', 'raining', 'wild'].forEach(category => {
            const cell = document.createElement('td');
            const show = categories[category][i];
            
            if (show) {
                const performance = show.performances[0]; // Get first performance
                cell.className = `show-cell ${performance?.available ? 'available' : 'sold-out'}`;
                cell.innerHTML = `
                    <div class="show-name">${show.title}</div>
                    <div class="show-time">${formatTime(performance?.dateTime)}</div>
                    <div class="show-venue">${show.venue || ''}</div>
                `;
                
                // Add click handler
                cell.addEventListener('click', () => openShowDetails(show));
                
                // Add hover effects
                if (performance?.available) {
                    cell.addEventListener('mouseenter', () => {
                        cell.style.transform = 'scale(1.05)';
                        cell.style.zIndex = '10';
                    });
                    
                    cell.addEventListener('mouseleave', () => {
                        cell.style.transform = 'scale(1)';
                        cell.style.zIndex = '1';
                    });
                }
            } else {
                cell.className = 'empty-cell';
                cell.textContent = '-';
            }
            
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    }
    
    // Show message if no shows found
    if (maxShows === 1 && currentShows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td class="empty-cell" colspan="5">
                    🎭 No shows found for ${formatDate(currentDate)}
                    <br><small>Try selecting a different date</small>
                </td>
            </tr>
        `;
    }
}

// Update grid view with real data  
function updateGridView() {
    const categories = categorizeShows();
    const gridView = document.getElementById('grid-view');
    
    // Clear existing content
    gridView.innerHTML = '';
    
    // Check if we have any shows
    const totalShows = Object.values(categories).reduce((sum, shows) => sum + shows.length, 0);
    if (totalShows === 0) {
        gridView.innerHTML = `
            <div class="no-shows">
                <h3>🎭 No shows found for ${formatDate(currentDate)}</h3>
                <p>Try selecting a different date or adjusting your filters</p>
            </div>
        `;
        return;
    }
    
    // Create sections for each category
    Object.entries(categories).forEach(([categoryKey, shows]) => {
        if (shows.length === 0) return;
        
        const section = document.createElement('div');
        section.className = 'quality-section';
        
        const categoryNames = {
            winners: '🏆 Winners List • Must-see shows',
            good: '⭐ Might Be Good • Solid choices', 
            ok: '👍 Might Be OK • Safe bets',
            raining: '☔ If It\'s Raining • Indoor options',
            wild: '🎲 Wild Cards • Roll the dice'
        };
        
        section.innerHTML = `
            <div class="quality-section-header ${categoryKey}">
                ${categoryNames[categoryKey]}
            </div>
            <div class="show-grid" id="${categoryKey}-grid"></div>
        `;
        
        gridView.appendChild(section);
        
        // Add shows to grid, sorted by time
        const grid = section.querySelector('.show-grid');
        const sortedShows = shows.sort((a, b) => {
            const timeA = a.performances[0]?.dateTime || '';
            const timeB = b.performances[0]?.dateTime || '';
            return timeA.localeCompare(timeB);
        });
        
        sortedShows.forEach(show => {
            const performance = show.performances[0]; // Get first performance
            
            const card = document.createElement('div');
            card.className = `show-card ${categoryKey} ${performance?.available ? 'available' : 'sold-out'}`;
            card.setAttribute('data-time', formatTime(performance?.dateTime));
            
            card.innerHTML = `
                <div class="card-time">${formatTime(performance?.dateTime)}</div>
                <div class="card-title">${show.title}</div>
                <div class="card-meta">
                    <div class="card-venue">🏛️ ${show.venue || 'Venue TBC'}</div>
                    <div class="card-details">
                        <span>💰 ${show.priceRange || 'Price TBC'}</span>
                        <span>🔞 ${show.rating || ''}</span>
                    </div>
                    ${show.reviewNotes ? `<div class="card-notes">${show.reviewNotes}</div>` : ''}
                </div>
            `;
            
            card.addEventListener('click', () => openShowDetails(show));
            grid.appendChild(card);
        });
    });
}

// Helper functions
function formatTime(dateTimeString) {
    if (!dateTimeString) return 'Time TBC';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function openShowDetails(show) {
    // For now, log to console and open Edinburgh Fringe page
    console.log('Show details:', {
        title: show.title,
        venue: show.venue,
        performances: show.performances,
        reviewCategory: show.reviewCategory,
        reviewNotes: show.reviewNotes
    });
    
    // Open the actual Edinburgh Fringe booking page
    if (show.slug) {
        const url = `https://www.edfringe.com/tickets/whats-on/${show.slug}`;
        window.open(url, '_blank');
    }
}

function updateLastUpdated(timestamp) {
    // You could add a footer element to show when data was last updated
    if (timestamp) {
        console.log(`Data last updated: ${new Date(timestamp).toLocaleString('en-GB')}`);
    }
}