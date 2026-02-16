/**
 * Booking Service Dashboard - Cloudflare Pages Version
 * 
 * Fully functional demo with mock data - no backend required!
 * Deploy directly to Cloudflare Pages
 */

// Demo mode with mock data
const DEMO_MODE = true;

// Mock bookings database
let mockBookings = [
  {
    id: 'demo-booking-1',
    startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    status: 'CONFIRMED',
    metadata: { title: 'Team Standup' },
    createdAt: new Date().toISOString()
  },
  {
    id: 'demo-booking-2',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    status: 'CONFIRMED',
    metadata: { title: 'Product Review' },
    createdAt: new Date().toISOString()
  }
];

document.addEventListener('DOMContentLoaded', () => {
    showDemoNotice();
    setDefaultTimes();
    loadMockBookings();
    log('Dashboard initialized (Demo Mode)', 'success');
});

function showDemoNotice() {
    document.getElementById('demoNotice').style.display = 'block';
}

function setDefaultTimes() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    document.getElementById('startTime').value = now.toISOString().slice(0, 16);
    document.getElementById('endTime').value = oneHourLater.toISOString().slice(0, 16);
}

function log(message, type = 'info') {
    const logEl = document.getElementById('activityLog');
    const timestamp = new Date().toLocaleTimeString();
    const className = type === 'success' ? 'log-success' : type === 'error' ? 'log-error' : 'log-info';
    logEl.innerHTML = `<div class="log-entry ${className}">[${timestamp}] ${message}</div>` + logEl.innerHTML;
}

// Mock health check
async function checkHealth() {
    document.getElementById('healthStatus').textContent = '🎬 Demo';
    document.getElementById('responseTime').textContent = '< 10ms';
    document.getElementById('demoMode').textContent = '🎬';
    document.getElementById('apiEndpoint').textContent = 'Cloudflare Pages (Demo)';
    log('Running in demo mode with mock data', 'info');
}

// Mock create booking
document.getElementById('createBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('createAlert');
    
    const startTime = new Date(document.getElementById('startTime').value).toISOString();
    const endTime = new Date(document.getElementById('endTime').value).toISOString();
    const title = document.getElementById('title').value;

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check for overlaps (mock)
    const hasOverlap = mockBookings.some(booking => {
        return (
            (startTime < booking.endTime && endTime > booking.startTime)
        );
    });

    if (hasOverlap) {
        alertEl.innerHTML = `<div class="alert alert-error">❌ Time slot conflicts with existing booking</div>`;
        log(`Booking failed: Time slot conflict`, 'error');
    } else {
        const newBooking = {
            id: `booking-${Date.now()}`,
            startTime,
            endTime,
            status: 'CONFIRMED',
            metadata: { title },
            createdAt: new Date().toISOString()
        };
        
        mockBookings.push(newBooking);
        
        alertEl.innerHTML = `<div class="alert alert-success">✅ Booking created successfully! ID: ${newBooking.id.slice(0, 8)}...</div>`;
        log(`Booking created: ${title}`, 'success');
        loadMockBookings();
    }

    setTimeout(() => alertEl.innerHTML = '', 5000);
});

// Mock concurrency test
async function runConcurrencyTest() {
    const btn = document.getElementById('concurrencyBtn');
    const progress = document.getElementById('concurrencyProgress');
    const progressFill = document.getElementById('progressFill');
    
    btn.disabled = true;
    btn.textContent = 'Running test...';
    progress.style.display = 'block';
    progressFill.style.width = '0%';

    const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const endTime = new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString();

    // Simulate 10 concurrent requests
    const results = [];
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        // First request succeeds, rest fail (demonstrating race-condition protection)
        if (i === 0) {
            results.push({ success: true, id: `booking-test-${i}` });
            log(`Request ${i + 1}: ✅ Success`, 'success');
        } else {
            results.push({ success: false, error: 'Time slot conflict' });
            log(`Request ${i + 1}: ❌ Time slot conflict`, 'error');
        }
        
        progressFill.style.width = `${((i + 1) / 10) * 100}%`;
    }

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    document.getElementById('concurrentSuccess').textContent = success;
    document.getElementById('concurrentFailed').textContent = failed;

    btn.disabled = false;
    btn.textContent = 'Run Test Again';
    progress.style.display = 'none';

    const summary = `✅ Race-condition protection demo: Only 1 of 10 requests succeeded.`;
    log(summary, 'success');
    alert(summary + '\n\nIn production, this is enforced by Redis distributed locks + database transactions.');
}

// Load mock bookings
function loadMockBookings() {
    const container = document.querySelector('.log-container');
    const existingTable = document.getElementById('bookingsTable');
    if (existingTable) existingTable.remove();

    const table = document.createElement('div');
    table.id = 'bookingsTable';
    table.style.cssText = 'margin-top: 2rem;';
    table.innerHTML = `
        <h2 style="font-size: 1.125rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">📋 Recent Bookings</h2>
        <div class="table-container" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Title</th>
                        <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Start Time</th>
                        <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">End Time</th>
                        <th style="padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary);">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${mockBookings.map(booking => `
                        <tr>
                            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">${booking.metadata?.title || 'Untitled'}</td>
                            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">${new Date(booking.startTime).toLocaleString()}</td>
                            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">${new Date(booking.endTime).toLocaleString()}</td>
                            <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border);">
                                <span class="badge" style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: rgba(22, 163, 74, 0.15); color: var(--success);">
                                    ${booking.status}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.parentNode.insertBefore(table, container.nextSibling);
}
