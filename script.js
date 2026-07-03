// State
let currentStep = 1;
const totalSteps = 3;
let generatedSchedule = null;
let employeeData = [];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Handles the "Custom time..." dropdown option
// When selected, injects a small inline input row below the select for manual time entry
function showCustomTimeInput(selectEl) {
    if (selectEl.value !== '__custom__') {
        // Remove any custom input that was previously shown for this select
        const existingCustom = selectEl.parentElement.querySelector('.custom-time-input-row');
        if (existingCustom) existingCustom.remove();
        return;
    }

    // Don't add duplicate
    if (selectEl.parentElement.querySelector('.custom-time-input-row')) return;

    const row = document.createElement('div');
    row.className = 'custom-time-input-row';
    row.innerHTML = `
        <input type="text" class="custom-time-input" placeholder="e.g. 6:45" maxlength="5" inputmode="numeric">
        <div class="ampm-toggle">
            <input type="radio" name="ampm-${selectEl.id}" id="am-${selectEl.id}" value="AM">
            <label for="am-${selectEl.id}">AM</label>
            <input type="radio" name="ampm-${selectEl.id}" id="pm-${selectEl.id}" value="PM" checked>
            <label for="pm-${selectEl.id}">PM</label>
        </div>
        <button class="custom-time-confirm" type="button">✓ Set</button>
    `;
    selectEl.parentElement.insertBefore(row, selectEl.nextSibling);

    const textInput = row.querySelector('.custom-time-input');
    const confirmBtn = row.querySelector('.custom-time-confirm');

    confirmBtn.addEventListener('click', () => {
        const timeVal = textInput.value.trim();
        const ampm = row.querySelector(`input[name="ampm-${selectEl.id}"]:checked`).value;
        if (!timeVal || !/^\d{1,2}:\d{2}$/.test(timeVal) && !/^\d{1,2}$/.test(timeVal)) {
            textInput.style.borderColor = '#EF4444';
            textInput.placeholder = 'e.g. 6:45';
            return;
        }
        // Normalize: if they type "6" make it "6:00"
        const normalized = timeVal.includes(':') ? timeVal : `${timeVal}:00`;
        const fullTime = `${normalized} ${ampm}`;
        
        // Inject as a new option and select it
        const newOpt = document.createElement('option');
        newOpt.value = fullTime;
        newOpt.textContent = fullTime;
        newOpt.selected = true;
        // Insert before the __custom__ option
        const customOpt = Array.from(selectEl.options).find(o => o.value === '__custom__');
        selectEl.insertBefore(newOpt, customOpt);
        selectEl.value = fullTime;
        
        row.remove();
        selectEl.dispatchEvent(new Event('change'));
    });

    textInput.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    loadEmployees();

    document.getElementById('view-master-btn').addEventListener('click', () => {
        const tableContainer = document.getElementById('master-table-container');
        if (tableContainer.style.display === 'none') {
            tableContainer.style.display = 'block';
            document.getElementById('view-master-btn').textContent = 'Hide Master Table';
        } else {
            tableContainer.style.display = 'none';
            document.getElementById('view-master-btn').textContent = 'View Master Table';
        }
    });

    // Update reminder banner based on current permission state
    updateReminderBanner();

    // Check and fire reminder if it's Saturday and time is right
    checkAndFireReminder();
});

function updateReminderBanner() {
    const banner = document.getElementById('reminder-banner');
    const btn = document.getElementById('reminder-btn');
    if (!banner) return;

    const enabled = localStorage.getItem('reminderEnabled');
    const friTime = localStorage.getItem('friReminderTime');
    const satTime = localStorage.getItem('satReminderTime');

    if (enabled === 'true' && Notification.permission === 'granted') {
        btn.textContent = '✓ On';
        btn.style.background = '#10B981';
        banner.querySelector('span').textContent = `Fri @ ${friTime} | Sat @ ${satTime}`;
    }
}

function parseTimeInput(timeStr) {
    if (!timeStr) return null;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || 0, 10);
    if (isNaN(h) || isNaN(m)) return null;
    
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const displayTime = `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
    return { h, m, displayTime };
}

function setupReminder() {
    if (!('Notification' in window)) {
        alert('Sorry, your browser does not support notifications.');
        return;
    }

    const friInput = prompt('Step 1/2: What time should we remind her every FRIDAY to ask for availability?\n(Type in 24h format, e.g. 18:00 for 6 PM)', '18:00');
    if (!friInput) return;
    const fri = parseTimeInput(friInput);
    if (!fri) return alert("Invalid time format.");

    const satInput = prompt('Step 2/2: What time should we remind her every SATURDAY to make the schedule?\n(Type in 24h format, e.g. 10:00 for 10 AM)', '10:00');
    if (!satInput) return;
    const sat = parseTimeInput(satInput);
    if (!sat) return alert("Invalid time format.");

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            localStorage.setItem('reminderEnabled', 'true');
            
            localStorage.setItem('friReminderTime', fri.displayTime);
            localStorage.setItem('friReminderHour', fri.h);
            localStorage.setItem('friReminderMinute', fri.m);

            localStorage.setItem('satReminderTime', sat.displayTime);
            localStorage.setItem('satReminderHour', sat.h);
            localStorage.setItem('satReminderMinute', sat.m);

            // Show confirmation notification immediately
            new Notification('✅ Reminders Set!', {
                body: `Friday at ${fri.displayTime} and Saturday at ${sat.displayTime}.`,
                icon: '🔔'
            });

            updateReminderBanner();
        } else {
            alert('Notification permission was denied. Please enable it in your browser settings.');
        }
    });
}

function checkAndFireReminder() {
    const enabled = localStorage.getItem('reminderEnabled');
    if (enabled !== 'true' || Notification.permission !== 'granted') return;

    const now = new Date();
    const day = now.getDay(); // 5 = Friday, 6 = Saturday
    
    if (day !== 5 && day !== 6) return;

    const isFriday = day === 5;
    const prefix = isFriday ? 'fri' : 'sat';

    const reminderHour = parseInt(localStorage.getItem(`${prefix}ReminderHour`) || (isFriday ? 18 : 10));
    const reminderMinute = parseInt(localStorage.getItem(`${prefix}ReminderMinute`) || 0);

    const lastFired = localStorage.getItem('reminderLastFired');
    const todayStr = now.toDateString();

    if (lastFired === todayStr) return; // Already fired today

    if (now.getHours() === reminderHour && now.getMinutes() === reminderMinute) {
        if (isFriday) {
            new Notification('📋 Check Availability', {
                body: `It's Friday! Ask employees about their availability for next week.`,
                icon: '💬'
            });
        } else {
            new Notification('📅 Make the Schedule!', {
                body: `Good morning! It's Saturday — open the Schedule Maker and set this week's shifts.`,
                icon: '📅'
            });
        }
        localStorage.setItem('reminderLastFired', todayStr);
    }
}

function loadEmployees() {
    const saved = localStorage.getItem('employeeList');
    if (saved) {
        employeeData = JSON.parse(saved);
    } else {
        employeeData = ['Amrit', 'Gagan', 'Komal', 'Jaswinder'];
    }
    renderEmployeeInputs();
}

function renderEmployeeInputs() {
    const container = document.getElementById('employee-list-container');
    container.innerHTML = '';
    
    employeeData.forEach((name, index) => {
        addEmployeeField(name, index);
    });
}

function addEmployeeField(name = '', index = -1) {
    const container = document.getElementById('employee-list-container');
    const div = document.createElement('div');
    div.className = 'dynamic-emp-row';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'large-input emp-input';
    input.placeholder = 'Employee Name';
    input.value = name;
    
    const actionContainer = document.createElement('div');
    actionContainer.className = 'emp-actions';

    const askBtn = document.createElement('button');
    askBtn.className = 'ask-btn';
    askBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
    `;
    askBtn.onclick = () => {
        const empName = input.value.trim();
        if (empName) {
            askAvailability(empName);
        } else {
            alert("Please enter a name first.");
        }
    };
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = () => {
        div.remove();
    };
    
    actionContainer.appendChild(askBtn);
    actionContainer.appendChild(removeBtn);

    div.appendChild(input);
    div.appendChild(actionContainer);
    container.appendChild(div);
}

function askAvailability(empName) {
    const msg = `Hi ${empName}! 👋 What is your availability for next week?`;
    const encodedText = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
}

function saveEmployees() {
    const inputs = document.querySelectorAll('.emp-input');
    employeeData = [];
    inputs.forEach(input => {
        const val = input.value.trim();
        if (val) employeeData.push(val);
    });
    localStorage.setItem('employeeList', JSON.stringify(employeeData));
}

function updateProgress() {
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('step-indicator').textContent = `Step ${currentStep} of ${totalSteps}`;
}

function nextStep(step) {
    if (step === 1) {
        saveEmployees();
        buildAssignmentUI();
    }
    
    document.getElementById(`step-${step}`).classList.remove('active');
    currentStep = step + 1;
    document.getElementById(`step-${currentStep}`).classList.add('active');
    updateProgress();
}

function prevStep(step) {
    document.getElementById(`step-${step}`).classList.remove('active');
    currentStep = step - 1;
    document.getElementById(`step-${currentStep}`).classList.add('active');
    updateProgress();
}

function startOver() {
    document.getElementById('step-3').classList.remove('active');
    currentStep = 1;
    document.getElementById('step-1').classList.add('active');
    updateProgress();
}

function validateDoubleBookings() {
    days.forEach(day => {
        const selects = document.querySelectorAll(`select[id^="${day}-"][id$="ning"], select[id^="${day}-"][id*="evening"]`);
        const nameSelects = Array.from(selects).filter(s => !s.id.includes('-start') && !s.id.includes('-end'));
        
        // Reset borders
        nameSelects.forEach(s => s.classList.remove('error-border'));
        
        // Find duplicates
        const counts = {};
        nameSelects.forEach(s => {
            const val = s.value;
            if (val) {
                counts[val] = (counts[val] || 0) + 1;
            }
        });
        
        nameSelects.forEach(s => {
            if (s.value && counts[s.value] > 1) {
                s.classList.add('error-border');
            }
        });
    });
}

function saveScheduleState() {
    const state = {};
    days.forEach(day => {
        const prefix = day.toLowerCase().substring(0, 3);
        const staffToggle = document.querySelector(`input[name="${prefix}-staff"]:checked`);
        if (staffToggle) {
            state[`${prefix}-staff`] = staffToggle.value;
        }
        
        const elements = [
            `${day}-morning`,
            `${day}-morning-end`,
            `${day}-evening1`,
            `${day}-evening1-start`,
            `${day}-evening2`,
            `${day}-evening2-start`,
            `${day}-evening2-end`,
            `${day}-evening3`,
            `${day}-evening3-start`,
            `${day}-evening3-end`
        ];
        
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) state[id] = el.value;
        });
    });
    localStorage.setItem('scheduleState', JSON.stringify(state));
}

function clearSchedule() {
    if(confirm("Are you sure you want to clear the entire schedule?")) {
        localStorage.removeItem('scheduleState');
        buildAssignmentUI();
    }
}

function buildAssignmentUI() {
    const container = document.getElementById('assignment-container');
    container.innerHTML = '';
    
    let savedState = {};
    try {
        const stateStr = localStorage.getItem('scheduleState');
        if (stateStr) savedState = JSON.parse(stateStr);
    } catch(e) {}

    let optionsHtml = '<option value="">-- Select Employee --</option>';
    employeeData.forEach(emp => {
        optionsHtml += `<option value="${emp}">${emp}</option>`;
    });

    const CUSTOM_OPTION = '<option value="__custom__">✏️ Custom time...</option>';

    let timeOptionsHtml = '';
    ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM'].forEach(time => {
        timeOptionsHtml += `<option value="${time}">${time}</option>`;
    });
    timeOptionsHtml += CUSTOM_OPTION;

    let endTimeOptionsHtml = '';
    ['10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM', '12:30 AM', '1:00 AM', '1:30 AM', '2:00 AM', '2:30 AM', '3:00 AM', '3:30 AM', '4:00 AM', '4:30 AM', '5:00 AM'].forEach(time => {
        endTimeOptionsHtml += `<option value="${time}">${time}</option>`;
    });
    endTimeOptionsHtml += CUSTOM_OPTION;
    
    let startTimeOptionsHtml = '';
    ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM'].forEach(time => {
        startTimeOptionsHtml += `<option value="${time}">${time}</option>`;
    });
    startTimeOptionsHtml += CUSTOM_OPTION;

    const setSelectValue = (id, html, defaultVal) => {
        const finalVal = savedState[id] !== undefined ? savedState[id] : defaultVal;
        // If saved value is a custom time, inject it as a selected option before the custom option
        const isKnown = html.includes(`value="${finalVal}"`);
        if (!isKnown && finalVal && finalVal !== '__custom__') {
            return html.replace(CUSTOM_OPTION, `<option value="${finalVal}" selected>${finalVal}</option>${CUSTOM_OPTION}`);
        }
        return html.replace(`value="${finalVal}"`, `value="${finalVal}" selected`);
    };

    days.forEach(day => {
        const prefix = day.toLowerCase().substring(0, 3);
        const isWeekend = ['Friday','Saturday','Sunday'].includes(day);
        
        // Section labels
        if (day === 'Monday') {
            const label = document.createElement('div');
            label.className = 'week-section-label';
            label.textContent = '📅 Weekdays (Mon – Thu)';
            container.appendChild(label);
        }
        if (day === 'Friday') {
            const label = document.createElement('div');
            label.className = 'week-section-label weekend-label';
            label.textContent = '🔥 Weekend (Fri – Sun)';
            container.appendChild(label);
        }

        // Defaults
        const defaultStaff = savedState[`${prefix}-staff`] || ((day === 'Friday' || day === 'Saturday') ? '2' : '1');
        
        const dayBlock = document.createElement('div');
        dayBlock.className = 'assignment-day';
        
        const morningEndHtml = setSelectValue(`${day}-morning-end`, timeOptionsHtml, '7:00 PM');
        const morningHtml = setSelectValue(`${day}-morning`, optionsHtml, '');
        
        const evening1StartHtml = setSelectValue(`${day}-evening1-start`, startTimeOptionsHtml, '7:00 PM');
        const evening1Html = setSelectValue(`${day}-evening1`, optionsHtml, '');
        
        const e2Html = setSelectValue(`${day}-evening2`, optionsHtml, '');
        const e2StartHtml = setSelectValue(`${day}-evening2-start`, startTimeOptionsHtml, '7:00 PM');
        const e2EndHtml = setSelectValue(`${day}-evening2-end`, endTimeOptionsHtml, '5:00 AM');
        
        const e3Html = setSelectValue(`${day}-evening3`, optionsHtml, '');
        const e3StartHtml = setSelectValue(`${day}-evening3-start`, startTimeOptionsHtml, '7:00 PM');
        const e3EndHtml = setSelectValue(`${day}-evening3-end`, endTimeOptionsHtml, '5:00 AM');
        
        const toggleHtml = `
            <div class="day-toggle" style="border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1rem;">
                <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">🌙 EVENING STAFF COUNT</label>
                <div class="segment-control">
                    <input type="radio" name="${prefix}-staff" id="${prefix}-1" value="1" ${defaultStaff === '1' ? 'checked' : ''}>
                    <label for="${prefix}-1">1</label>
                    <input type="radio" name="${prefix}-staff" id="${prefix}-2" value="2" ${defaultStaff === '2' ? 'checked' : ''}>
                    <label for="${prefix}-2">2</label>
                    <input type="radio" name="${prefix}-staff" id="${prefix}-3" value="3" ${defaultStaff === '3' ? 'checked' : ''}>
                    <label for="${prefix}-3">3</label>
                </div>
            </div>
            
            <div id="${day}-evening2-container" style="display: ${defaultStaff === '2' || defaultStaff === '3' ? 'block' : 'none'};">
                <div class="shift-row evening-row" style="margin-top: 0.75rem;">
                    <label><span class="shift-icon">🌙</span> Evening Shift 2</label>
                    <select id="${day}-evening2" class="large-select assignment-select">${e2Html}</select>
                    <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem; align-items:center;">
                        <span style="font-size: 0.8rem; color: var(--evening-text); font-weight:600;">From:</span>
                        <select id="${day}-evening2-start" class="large-select" style="padding: 0.5rem; font-size: 0.9rem; background:#F0F1FF; border-color: var(--evening-border); color: var(--evening-text);">${e2StartHtml}</select>
                        <span style="font-size: 0.8rem; color: var(--evening-text); font-weight:600;">To:</span>
                        <select id="${day}-evening2-end" class="large-select" style="padding: 0.5rem; font-size: 0.9rem; background:#F0F1FF; border-color: var(--evening-border); color: var(--evening-text);">${e2EndHtml}</select>
                    </div>
                </div>
            </div>

            <div id="${day}-evening3-container" style="display: ${defaultStaff === '3' ? 'block' : 'none'};">
                <div class="shift-row evening-row" style="margin-top: 0.75rem;">
                    <label><span class="shift-icon">🌙</span> Evening Shift 3</label>
                    <select id="${day}-evening3" class="large-select assignment-select">${e3Html}</select>
                    <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem; align-items:center;">
                        <span style="font-size: 0.8rem; color: var(--evening-text); font-weight:600;">From:</span>
                        <select id="${day}-evening3-start" class="large-select" style="padding: 0.5rem; font-size: 0.9rem; background:#F0F1FF; border-color: var(--evening-border); color: var(--evening-text);">${e3StartHtml}</select>
                        <span style="font-size: 0.8rem; color: var(--evening-text); font-weight:600;">To:</span>
                        <select id="${day}-evening3-end" class="large-select" style="padding: 0.5rem; font-size: 0.9rem; background:#F0F1FF; border-color: var(--evening-border); color: var(--evening-text);">${e3EndHtml}</select>
                    </div>
                </div>
            </div>
        `;

        const dayEmoji = isWeekend ? '🔥' : '📅';

        dayBlock.innerHTML = `
            <div class="assignment-header ${isWeekend ? 'weekend' : ''}">${dayEmoji} ${day}</div>
            <div class="assignment-body">
                <div class="shift-row morning-row" style="margin-top: 0.75rem;">
                    <label><span class="shift-icon">☀️</span> Morning Shift</label>
                    <select id="${day}-morning" class="large-select assignment-select">${morningHtml}</select>
                    <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem; align-items:center;">
                        <span style="font-size: 0.8rem; color: var(--morning-text); font-weight:600;">Ends at:</span>
                        <select id="${day}-morning-end" class="large-select" style="padding: 0.5rem; font-size: 0.9rem; background:#FFFDF0; border-color: var(--morning-border); color: var(--morning-text);">${morningEndHtml}</select>
                    </div>
                </div>
                <div class="shift-row evening-row" style="margin-top: 0.75rem;">
                    <label><span class="shift-icon">🌙</span> Evening Shift 1</label>
                    <select id="${day}-evening1" class="large-select assignment-select">${evening1Html}</select>
                    <div style="display:flex; gap: 0.5rem; margin-top: 0.5rem; align-items:center;">
                        <span style="font-size: 0.8rem; color: var(--evening-text); font-weight:600;">Starts at:</span>
                        <select id="${day}-evening1-start" class="large-select" style="padding: 0.5rem; font-size: 0.9rem; background:#F0F1FF; border-color: var(--evening-border); color: var(--evening-text);">${evening1StartHtml}</select>
                    </div>
                </div>
                ${toggleHtml}
            </div>
        `;
        container.appendChild(dayBlock);

        // Attach listeners
        document.querySelectorAll(`input[name="${prefix}-staff"]`).forEach(radio => {
            radio.addEventListener('change', () => {
                const val = radio.value;
                document.getElementById(`${day}-evening2-container`).style.display = (val === '2' || val === '3') ? 'block' : 'none';
                document.getElementById(`${day}-evening3-container`).style.display = (val === '3') ? 'block' : 'none';
                validateDoubleBookings();
                saveScheduleState();
            });
        });
        
        const attachChange = (id, isTimeSelect = false) => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('change', () => {
                    if (isTimeSelect) showCustomTimeInput(el);
                    validateDoubleBookings();
                    saveScheduleState();
                });
            }
        };

        attachChange(`${day}-morning`);
        attachChange(`${day}-evening1`);
        attachChange(`${day}-evening2`);
        attachChange(`${day}-evening3`);
        attachChange(`${day}-morning-end`, true);
        attachChange(`${day}-evening1-start`, true);
        attachChange(`${day}-evening2-start`, true);
        attachChange(`${day}-evening2-end`, true);
        attachChange(`${day}-evening3-start`, true);
        attachChange(`${day}-evening3-end`, true);
    });
    
    validateDoubleBookings();
}

function parseTime(timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours + (minutes / 60);
}

function calculateHours(startStr, endStr) {
    let start = parseTime(startStr);
    let end = parseTime(endStr);
    if (end <= start) end += 24; // Crosses midnight
    return end - start;
}

function generateAndGo() {
    
    // VALIDATION: Check for empty name dropdowns
    let hasEmpty = false;
    days.forEach(day => {
        const prefix = day.toLowerCase().substring(0, 3);
        const staffCount = document.querySelector(`input[name="${prefix}-staff"]:checked`).value;
        
        if (!document.getElementById(`${day}-morning`).value) hasEmpty = true;
        if (!document.getElementById(`${day}-evening1`).value) hasEmpty = true;
        
        if (staffCount === '2' || staffCount === '3') {
            if (!document.getElementById(`${day}-evening2`).value) hasEmpty = true;
        }
        if (staffCount === '3') {
            if (!document.getElementById(`${day}-evening3`).value) hasEmpty = true;
        }
    });

    if (hasEmpty) {
        // Find the empty elements and highlight them
        document.querySelectorAll('.assignment-select').forEach(s => {
            // Check if it's visible before highlighting
            if (s.value === '' && s.offsetParent !== null) {
                s.classList.add('error-border');
            }
        });
        
        const proceed = confirm("Some shifts are unassigned! Are you sure you want to generate the schedule anyway?");
        if (!proceed) return;
    }

    generatedSchedule = {};

    days.forEach(day => {
        const morningEnd = document.getElementById(`${day}-morning-end`).value;
        const morning = document.getElementById(`${day}-morning`).value;
        const evening1Start = document.getElementById(`${day}-evening1-start`).value;
        const evening1 = document.getElementById(`${day}-evening1`).value;
        
        generatedSchedule[day] = {
            shifts: []
        };

        if (morning) {
            generatedSchedule[day].shifts.push({
                emp: morning,
                type: 'Morning',
                start: '10:00 AM',
                end: morningEnd
            });
        }
        
        if (evening1) {
            generatedSchedule[day].shifts.push({
                emp: evening1,
                type: 'Evening 1',
                start: evening1Start,
                end: '5:00 AM'
            });
        }

        const prefix = day.toLowerCase().substring(0, 3);
        const staffCount = document.querySelector(`input[name="${prefix}-staff"]:checked`).value;
        
        if (staffCount === '2' || staffCount === '3') {
            const e2 = document.getElementById(`${day}-evening2`).value;
            const e2start = document.getElementById(`${day}-evening2-start`).value;
            const e2end = document.getElementById(`${day}-evening2-end`).value;
            if (e2) {
                generatedSchedule[day].shifts.push({
                    emp: e2,
                    type: 'Evening 2',
                    start: e2start,
                    end: e2end
                });
            }
        }

        if (staffCount === '3') {
            const e3 = document.getElementById(`${day}-evening3`).value;
            const e3start = document.getElementById(`${day}-evening3-start`).value;
            const e3end = document.getElementById(`${day}-evening3-end`).value;
            if (e3) {
                generatedSchedule[day].shifts.push({
                    emp: e3,
                    type: 'Evening 3',
                    start: e3start,
                    end: e3end
                });
            }
        }
    });

    renderResults();
    renderMasterTable();
    nextStep(2);
}

function renderResults() {
    const container = document.getElementById('results-container');
    container.innerHTML = '';
    
    const rawTextContainer = document.createElement('div');
    rawTextContainer.style.display = 'none';
    document.body.appendChild(rawTextContainer);

    employeeData.forEach((emp, index) => {
        let schedString = `Hi ${emp}! Here is your schedule for this week:\n\n`;
        let hasShifts = false;
        
        let totalDays = 0;
        let totalHours = 0;

        days.forEach(day => {
            const dayData = generatedSchedule[day];
            const myShifts = dayData.shifts.filter(s => s.emp === emp);
            
            if (myShifts.length > 0) totalDays++;

            myShifts.forEach(shift => {
                schedString += `• ${day}: ${shift.start} - ${shift.end}\n`;
                hasShifts = true;
                totalHours += calculateHours(shift.start, shift.end);
            });
        });

        if (!hasShifts) schedString += `You have no shifts this week.\n`;
        
        const textElementId = `raw-text-${index}`;
        const textElement = document.createElement('div');
        textElement.id = textElementId;
        textElement.innerText = schedString;
        rawTextContainer.appendChild(textElement);

        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'flex-start';
        
        const encodedText = encodeURIComponent(schedString);

        const empColors = ['#4F46E5','#7C3AED','#059669','#D97706'];
        const empColor = empColors[index % empColors.length];

        card.innerHTML = `
            <div style="border-left: 4px solid ${empColor}; padding-left: 0.75rem;">
                <h3 style="color: ${empColor};">${emp}</h3>
                <div class="summary-stats">
                    <span class="stat-badge">📅 ${totalDays} Days</span>
                    <span class="stat-badge">⏱️ ${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} Hrs</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="copy-btn" onclick="copySchedule('${textElementId}', this)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                </button>
                <a href="https://wa.me/?text=${encodedText}" target="_blank" class="whatsapp-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    WhatsApp
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}

function copySchedule(textElementId, btnElement) {
    const text = document.getElementById(textElementId).innerText;
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
        
        const originalText = btnElement.innerHTML;
        btnElement.classList.add('copied');
        btnElement.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
        `;
        
        setTimeout(() => {
            btnElement.classList.remove('copied');
            btnElement.innerHTML = originalText;
        }, 2000);
    });
}

function renderMasterTable() {
    const table = document.getElementById('master-table');
    table.innerHTML = `
        <tr>
            <th>Day</th>
            <th>Shifts</th>
        </tr>
    `;
    
    days.forEach(day => {
        const row = document.createElement('tr');
        const dayData = generatedSchedule[day];
        
        let shiftsHtml = '';
        dayData.shifts.forEach(s => {
            shiftsHtml += `<div><strong>${s.type}</strong>: ${s.emp} (${s.start} - ${s.end})</div>`;
        });
        
        row.innerHTML = `
            <td><strong>${day}</strong></td>
            <td>${shiftsHtml || 'Unassigned'}</td>
        `;
        table.appendChild(row);
    });
}
