// Edinburgh Fringe Show Finder JavaScript - Show All Shows by Default
const API_BASE_URL = 'https://fringe-api.hraasing.workers.dev'; // Update this to your actual API URL

// Quality rating categories - you can customize these based on your preferences
const QUALITY_CATEGORIES = {
    'winners': { label: '🏆 Winners List', priority: 5 },
    'good': { label: '✨ Might Be Good', priority: 4 },
    'ok': { label: '👍 Might Be OK', priority: 3 },
    'raining': { label: '🌧️ If It\'s Raining', priority: 2 },
    'wildcard': { label: '🎲 Wild Cards', priority: 1 }
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Set smart default date
    const today = new Date();
    const festivalStart = new Date('2025-07-27'); // Monday 28th July 2025
    const festivalEnd = new Date('2025-08-25');   // Monday 25th August 2025
    
    let defaultDate;
    if (today >= festivalStart && today <= festivalEnd) {
        // If we're during the festival, use today
        defaultDate = today.toISOString().split('T')[0];
    } else {
        // Otherwise default to festival start date
        defaultDate = '2025-07-28';
    }
    
    document.getElementById('date-picker').value = defaultDate;
    document.getElementById('date-picker').min = '2025-07-28'; // Set min to festival start
    
    // Add event listeners
    document.getElementById('date-picker').addEventListener('change', loadShows);
    document.getElementById('genre-filter').addEventListener('change', loadShows);
    document.getElementById('venue-filter').addEventListener('input', debounce(loadShows, 500));
    
    // Add date navigation listeners
    document.getElementById('prev-date-btn').addEventListener('click', navigateDate);
    document.getElementById('next-date-btn').addEventListener('click', navigateDate);
    
    // Toggle button event listeners - CHANGED: Don't activate "available only" by default
    document.getElementById('available-only-btn').addEventListener('click', function() {
        this.classList.toggle('active');
        loadShows();
    });
    
    document.getElementById('accessible-only-btn').addEventListener('click', function() {
        this.classList.toggle('active');
        loadShows();
    });
    
    // CHANGED: Remove default "active" class from available-only button
    document.getElementById('available-only-btn').classList.remove('active');
    
    // Auto-load shows for the default date
    loadShows();
    
    // Initialize date navigation
    updateDateNavigation();
});

let allShows = []; // Store all shows data

// Festival date range constants
const FESTIVAL_START = new Date('2025-07-28');
const FESTIVAL_END = new Date('2025-08-25');

// Navigate to previous or next date
function navigateDate(event) {
    const direction = event.target.id === 'next-date-btn' ? 1 : -1;
    const currentDate = new Date(document.getElementById('date-picker').value);
    
    // Calculate new date
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction);
    
    // Check if within festival range
    if (newDate >= FESTIVAL_START && newDate <= FESTIVAL_END) {
        document.getElementById('date-picker').value = newDate.toISOString().split('T')[0];
        loadShows();
        updateDateNavigation();
    }
}

// Update date navigation button states
function updateDateNavigation() {
    const currentDate = new Date(document.getElementById('date-picker').value);
    const prevBtn = document.getElementById('prev-date-btn');
    const nextBtn = document.getElementById('next-date-btn');
    
    // Disable previous button if at festival start
    prevBtn.disabled = currentDate <= FESTIVAL_START;
    prevBtn.classList.toggle('disabled', currentDate <= FESTIVAL_START);
    
    // Disable next button if at festival end
    nextBtn.disabled = currentDate >= FESTIVAL_END;
    nextBtn.classList.toggle('disabled', currentDate >= FESTIVAL_END);
    
    // Update date display
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        dateDisplay.textContent = formatDateForDisplay(currentDate);
    }
}

// Format date for display (e.g., "Mon 28 Jul")
function formatDateForDisplay(date) {
    return date.toLocaleDateString('en-GB', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
}

// Load shows for the selected date
async function loadShows() {
    const date = document.getElementById('date-picker').value;
    if (!date) return;
    
    showLoading(true);
    
    try {
        const genre = document.getElementById('genre-filter').value;
        const venue = document.getElementById('venue-filter').value;
        // CHANGED: Default to false (show all shows)
        const availableOnly = document.getElementById('available-only-btn').classList.contains('active');
        
        // Build query parameters
        const params = new URLSearchParams();
        params.append('date', date);
        if (genre) params.append('genre', genre);
        if (venue) params.append('venue', venue);
        // CHANGED: Always set available_only to false unless explicitly activated
        params.append('available_only', availableOnly ? 'true' : 'false');
        
        const response = await fetch(`${API_BASE_URL}/lookup?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        allShows = data.shows || [];
        
        displayShowsInGrid(allShows, data.date);
        updateLastUpdated(data.lastUpdated);
        updateDateNavigation(); // Update navigation buttons after loading
        
    } catch (error) {
        console.error('Error fetching shows:', error);
        showError(`No shows available yet. Add some shows to get started!`);
    } finally {
        showLoading(false);
    }
}

// Display shows in grid format
function displayShowsInGrid(shows, date) {
    const gridContainer = document.getElementById('show-grid');
    const accessibleOnly = document.getElementById('accessible-only-btn').classList.contains('active');
    
    // Filter for accessibility if needed
    let filteredShows = shows;
    if (accessibleOnly) {
        filteredShows = shows.filter(show => checkAccessibility(show));
    }
    
    // Group performances by time slots
    const timeSlots = new Map();
    
    filteredShows.forEach(show => {
        (show.performances || []).forEach(performance => {
            const dateTime = new Date(performance.dateTime);
            const timeKey = dateTime.toTimeString().substring(0, 5); // HH:MM format
            
            if (!timeSlots.has(timeKey)) {
                timeSlots.set(timeKey, []);
            }
            
            // Assign show to quality category (you can customize this logic)
            const category = determineQualityCategory(show, performance);
            
            timeSlots.get(timeKey).push({
                show,
                performance,
                category,
                timeKey
            });
        });
    });
    
    // Sort time slots
    const sortedTimeSlots = Array.from(timeSlots.entries()).sort();
    
    // Clear existing content (except header)
    const header = gridContainer.querySelector('.grid-header');
    gridContainer.innerHTML = '';
    gridContainer.appendChild(header);
    
    if (sortedTimeSlots.length === 0) {
        gridContainer.innerHTML += `
            <div class="time-slot">
                <div class="time-cell" colspan="5">
                    <div class="empty-cell">No shows found for ${formatDate(date)}</div>
                </div>
            </div>
        `;
        return;
    }
    
    // Create grid rows for each time slot
    sortedTimeSlots.forEach(([timeKey, performances]) => {
        const timeSlotElement = createTimeSlotElement(timeKey, performances);
        gridContainer.appendChild(timeSlotElement);
    });
}

// Create a time slot row element
function createTimeSlotElement(timeKey, performances) {
    const timeSlot = document.createElement('div');
    timeSlot.className = 'time-slot';
    
    // Create cells for each quality category
    Object.keys(QUALITY_CATEGORIES).forEach(categoryKey => {
        const cell = document.createElement('div');
        cell.className = 'time-cell';
        
        // Add time label to first cell
        if (categoryKey === Object.keys(QUALITY_CATEGORIES)[0]) {
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = timeKey;
            cell.appendChild(timeLabel);
        }
        
        // Find shows for this category
        const categoryShows = performances.filter(p => p.category === categoryKey);
        
        if (categoryShows.length === 0) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'empty-cell';
            emptyCell.textContent = '—';
            cell.appendChild(emptyCell);
        } else {
            // Add show cells (limit to prevent overcrowding)
            categoryShows.slice(0, 2).forEach(({show, performance}) => {
                const showCell = createShowCell(show, performance);
                cell.appendChild(showCell);
            });
        }
        
        timeSlot.appendChild(cell);
    });
    
    return timeSlot;
}

// Create a show cell element - ENHANCED with better status handling
function createShowCell(show, performance) {
    const cell = document.createElement('div');
    cell.className = 'show-cell';
    
    // ENHANCED: Better status determination
    let statusClass = 'unknown';
    let statusText = 'Check Venue';
    
    if (performance.cancelled) {
        statusClass = 'cancelled';
        statusText = 'Cancelled';
    } else if (performance.soldOut) {
        statusClass = 'sold-out';
        statusText = 'Sold Out';
    } else if (performance.ticketStatus === 'TICKETS_AVAILABLE') {
        statusClass = 'available';
        statusText = 'Available';
    } else if (performance.ticketStatus === 'PREVIEW_SHOW') {
        statusClass = 'preview';
        statusText = 'Preview';
    } else if (performance.ticketStatus === 'FREE_TICKETED' || performance.ticketStatus === 'FREE_NON_TICKETED') {
        statusClass = 'free';
        statusText = 'Free';
    } else if (performance.ticketStatus === 'TWO_FOR_ONE') {
        statusClass = 'available';
        statusText = '2for1';
    } else if (performance.ticketsAvailable === false) {
        statusClass = 'sold-out';
        statusText = 'No Tickets';
    } else {
        // CHANGED: Default status for shows without clear booking info
        statusClass = 'unknown';
        statusText = 'Check Venue';
    }
    
    cell.classList.add(statusClass);
    
    // Create status badge
    const statusBadge = document.createElement('div');
    statusBadge.className = `show-status ${statusClass}`;
    statusBadge.textContent = statusText;
    cell.appendChild(statusBadge);
    
    // Add accessibility icon if applicable
    if (checkAccessibility(show)) {
        const accessIcon = document.createElement('div');
        accessIcon.className = 'accessibility-icon';
        accessIcon.textContent = '♿';
        cell.appendChild(accessIcon);
    }
    
    // Show name
    const nameElement = document.createElement('div');
    nameElement.className = 'show-name';
    nameElement.textContent = truncateText(show.title || 'Unknown Show', 25);
    cell.appendChild(nameElement);
    
    // Venue
    const venueElement = document.createElement('div');
    venueElement.className = 'show-venue';
    venueElement.textContent = truncateText(show.venue || 'Unknown Venue', 20);
    cell.appendChild(venueElement);
    
    // Price
    const priceElement = document.createElement('div');
    priceElement.className = 'show-price';
    priceElement.textContent = show.priceRange || performance.price || '';
    cell.appendChild(priceElement);
    
    // Add click handler
    cell.addEventListener('click', () => {
        showShowDetails(show, performance);
    });
    
    return cell;
}

// ENHANCED: Show detailed information with better status messages
function showShowDetails(show, performance) {
    const dateTime = new Date(performance.dateTime);
    const formattedTime = dateTime.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let ticketMessage = '';
    if (performance.cancelled) {
        ticketMessage = 'This performance has been cancelled.';
    } else if (performance.soldOut) {
        ticketMessage = 'This performance is sold out.';
    } else if (performance.ticketStatus === 'TICKETS_AVAILABLE') {
        ticketMessage = 'Tickets are available for booking.';
    } else if (performance.ticketStatus === 'FREE_TICKETED' || performance.ticketStatus === 'FREE_NON_TICKETED') {
        ticketMessage = 'This is a free performance.';
    } else if (performance.ticketStatus === 'TWO_FOR_ONE') {
        ticketMessage = 'Special offer: 2 for 1 tickets available.';
    } else {
        ticketMessage = 'No ticket information available - please contact the venue directly.';
    }
    
    alert(`${show.title}\n\nVenue: ${show.venue}\nTime: ${formattedTime}\nPrice: ${show.priceRange || 'Not specified'}\n\n${ticketMessage}`);
}

// Determine quality category for a show (customize this logic)
function determineQualityCategory(show, performance) {
    // This is a placeholder - you would implement your own logic here
    // based on ratings, reviews, venue reputation, etc.
    
    const venue = show.venue?.toLowerCase() || '';
    const title = show.title?.toLowerCase() || '';
    
    // Example categorization logic (customize as needed)
    if (venue.includes('monkey barrel') || venue.includes('pleasance')) {
        return 'winners';
    } else if (venue.includes('assembly') || venue.includes('underbelly')) {
        return 'good';
    } else if (performance.ticketStatus === 'FREE_TICKETED' || performance.ticketStatus === 'FREE_NON_TICKETED') {
        return 'raining';
    } else if (title.includes('experimental') || title.includes('debut')) {
        return 'wildcard';
    } else {
        return 'ok';
    }
}

// Check if show has accessibility features
function checkAccessibility(show) {
    // Check venue attributes for accessibility
    if (show.venueAttributes) {
        const accessibilityAttrs = show.venueAttributes.filter(attr => 
            attr.attributeTypes === 'accessibility' && 
            (attr.key.includes('wheelchair') || attr.value.toLowerCase().includes('wheelchair'))
        );
        if (accessibilityAttrs.length > 0) return true;
    }
    
    // Check performance accessibility features
    const performances = show.performances || [];
    for (const perf of performances) {
        if (perf.accessibility && perf.accessibility.some(feature => 
            feature.includes('WHEELCHAIR')
        )) {
            return true;
        }
    }
    
    return false;
}

// Show/hide loading state
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    const gridDiv = document.getElementById('show-grid');
    
    if (show) {
        loadingDiv.classList.remove('hidden');
        gridDiv.classList.add('hidden');
    } else {
        loadingDiv.classList.add('hidden');
        gridDiv.classList.remove('hidden');
    }
}

// Show error message
function showError(message) {
    const gridContainer = document.getElementById('show-grid');
    gridContainer.innerHTML = `
        <div class="time-slot">
            <div class="time-cell" style="text-align: center; padding: 40px; color: #dc2626;">
                <h3>⚠️ Error</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        </div>
    `;
    showLoading(false);
}

// Show system statistics modal
async function showStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const data = await response.json();
        
        const statsHtml = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.stats.active_shows || 0}</div>
                    <div class="stat-label">Active Shows</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.total_performances || 0}</div>
                    <div class="stat-label">Total Performances</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.available_performances || 0}</div>
                    <div class="stat-label">Available Tickets</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.successful_scrapes_24h || 0}</div>
                    <div class="stat-label">Successful Scrapes (24h)</div>
                </div>
            </div>
            <p style="margin-top: 20px; color: #666; text-align: center;">
                Last scrape: ${formatDateTime(data.stats.last_scrape)}
            </p>
        `;
        
        document.getElementById('stats-content').innerHTML = statsHtml;
        document.getElementById('stats-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading stats:', error);
        alert('Failed to load statistics');
    }
}

// Hide statistics modal
function hideStats() {
    document.getElementById('stats-modal').classList.add('hidden');
}

// Update last updated timestamp in footer
function updateLastUpdated(timestamp) {
    const lastUpdatedDiv = document.getElementById('last-updated');
    if (timestamp) {
        lastUpdatedDiv.textContent = `Last updated: ${formatDateTime(timestamp)}`;
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function formatDateTime(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB');
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Close modal when clicking outside or on close button
document.addEventListener('click', function(event) {
    const modal = document.getElementById('stats-modal');
    const closeBtn = event.target.closest('.close');
    
    if (event.target === modal || closeBtn) {
        hideStats();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hideStats();
    }
    
    // Date navigation with arrow keys (when not typing in an input)
    if (!event.target.matches('input, textarea, select')) {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            const prevBtn = document.getElementById('prev-date-btn');
            if (!prevBtn.disabled) {
                navigateDate({ target: prevBtn });
            }
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            const nextBtn = document.getElementById('next-date-btn');
            if (!nextBtn.disabled) {
                navigateDate({ target: nextBtn });
            }
        }
    }
});
