// ===============================================
// ZERO TOUCH PRINTING PORTAL - MAIN APPLICATION
// Remote document printing service
// ===============================================

// ===============================================
// SERVER CONFIGURATION
// Central server URL for all API endpoints
// ===============================================
const CENTRAL_SERVER = 'https://jace-nonpuristic-carter.ngrok-free.dev';
const SERVER_UPLOAD_URL = `${CENTRAL_SERVER}/upload`;

// ===============================================
// MAINTENANCE MODE CONTROL
// Set this to true to show maintenance screen
// Set to false to allow normal operation
// ===============================================
const MAINTENANCE_MODE = false;

// ===============================================
// PDF.JS WORKER CONFIGURATION
// Sets up the PDF library worker for page counting
// Handles both immediate and delayed loading
// ===============================================
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
} else {
    // Fallback: wait for window load if pdfjsLib not immediately available
    window.addEventListener('load', () => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
    });
}

// ===============================================
// DOM ELEMENT REFERENCES
// Cache frequently used DOM elements for performance
// ===============================================
const fileInput = document.getElementById('fileInput');
const filesList = document.getElementById('filesList');
const uploadForm = document.getElementById('uploadForm');
const messageDiv = document.getElementById('message');
const paymentSection = document.getElementById('paymentSection');
const loading = document.getElementById('loading');
const cancelPaymentBtn = document.getElementById('cancelPayment');
const clearBtn = document.getElementById('clearBtn');
const verifyBtn = document.getElementById('verifyBtn');
const submitBtn = document.getElementById('submitBtn');

// Collect Later feature elements
const collectLaterInput = document.getElementById('collectLater');
const userInfoSection = document.getElementById('userInfoSection');
const userNameInput = document.getElementById('userName');
const studentIdInput = document.getElementById('studentId');
const trxIdInput = document.getElementById('trxId');
const printerLocation = document.getElementById('printerLocation').value;

// ===============================================
// STATUS BANNER SETUP
// Creates a dynamic banner to show printer status
// Displayed when printer is offline or unavailable
// ===============================================
const statusBanner = document.createElement('div');
statusBanner.id = 'statusBanner';
statusBanner.style.display = 'none';
statusBanner.style.padding = '15px';
statusBanner.style.backgroundColor = '#fee2e2';
statusBanner.style.color = '#b91c1c';
statusBanner.style.border = '1px solid #ef4444';
statusBanner.style.borderRadius = '8px';
statusBanner.style.marginBottom = '15px';
statusBanner.style.textAlign = 'center';
statusBanner.style.fontWeight = 'bold';
// Insert banner before the upload form
document.querySelector('.content').insertBefore(statusBanner, uploadForm);


// ===============================================
// APPLICATION STATE
// Stores currently selected files and cost
// ===============================================
let selectedFiles = [];     // Array of file objects with settings
let currentTotalCost = 0;   // Total cost in Taka

// ===============================================
// PRINTER STATUS CHECKER
// Polls the server every 5 seconds to check if printer is online
// Shows error banner if printer is offline
// ===============================================
async function checkSystemStatus() {
    try {
        const res = await fetch(`${CENTRAL_SERVER}/status/${printerLocation}`, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'User-Agent': 'ZeroTouchWeb'
            }
        });

        if (res.ok) {
            const data = await res.json();

            // Check if printer is explicitly offline
            // Only show error if server confirms printer_online === false
            if (data.printer_online === false) {
                showStatusError(`
                    ⚠️ Printer is Offline!<br>
                    <span style="font-size: 0.9em; font-weight: normal;">Could you please check if the printer power button is on?<br>
                    দয়া করে চেক করুন প্রিন্টারের পাওয়ার বাটন অন আছে কিনা।</span>
                `);
            } else {
                // Printer is online or status is unknown - hide error
                hideStatusError();
            }
        }
    } catch (e) {
        // Network error or server down - fail silently (no red popup)
        console.log("Status check skipped (Network/Server Issue)");
    }
}

// ===============================================
// STATUS ERROR DISPLAY FUNCTIONS
// Shows/hides the status error banner
// Disables submit button when printer is offline
// ===============================================
function showStatusError(msg) {
    if (statusBanner.innerHTML !== msg) {
        statusBanner.innerHTML = msg;
        statusBanner.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.innerHTML = '<i class="ph ph-prohibit"></i> Service Unavailable';
    }
}

function hideStatusError() {
    if (statusBanner.style.display !== 'none') {
        statusBanner.style.display = 'none';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.innerHTML = 'Proceed to Payment <i class="ph ph-arrow-right"></i>';
    }
}

// ===============================================
// START STATUS MONITORING
// Initial check on page load
// Then check every 5 seconds
// ===============================================
checkSystemStatus();
setInterval(checkSystemStatus, 5000);


// ===============================================
// SUPPORT MESSAGE TEMPLATE
// Shown in error messages for user assistance
// ===============================================
const supportMsg = `<br><div style="margin-top:6px; font-size:0.9rem; color:#ffd1d1;">
                    যে কোনো সমস্যায় WhatsApp করুন:<br>
                    <strong style="font-size:1rem; color:#fff;">01771080238</strong>
                    </div>`;


// ===============================================
// COLLECT LATER TOGGLE FUNCTION
// Shows/hides user info fields when checkbox is toggled
// Makes name and student ID required when checked
// ===============================================
function toggleUserInfo() {
    if (collectLaterInput.checked) {
        // Show user info section when collect later is checked
        userInfoSection.style.display = 'block';
        userNameInput.required = true;
        studentIdInput.required = true;
        // Auto-focus on name field for better UX
        setTimeout(() => userNameInput.focus(), 100);
    } else {
        // Hide user info section when unchecked
        userInfoSection.style.display = 'none';
        userNameInput.required = false;
        studentIdInput.required = false;
        // Clear the input values
        userNameInput.value = '';
        studentIdInput.value = '';
    }
    updateUI();
}

// Attach event listener to collect later checkbox
collectLaterInput.addEventListener('change', toggleUserInfo);

// ===============================================
// FILE INPUT HANDLER
// Processes files when user selects them
// - Rejects .doc/.docx files (not supported)
// - Analyzes color coverage for pricing
// - Adds files to selectedFiles array
// ===============================================
fileInput.addEventListener('change', async (e) => {
    let hasDocxError = false;

    // Process each selected file
    for (const f of Array.from(e.target.files)) {
        // Check for unsupported Word documents
        if (f.name.toLowerCase().endsWith('.doc') || f.name.toLowerCase().endsWith('.docx')) {
            hasDocxError = true;
            continue; // Skip this file
        }

        // Analyze color coverage to determine pricing
        const colorAnalysis = await analyzeColorCoverage(f);

        // Add file to selection with default settings
        selectedFiles.push({
            file: f,
            copies: 1,                      // Default: 1 copy
            range: '',                      // Default: all pages
            printMode: 'bw',                // Default: Black & White
            pageCount: f.name.toLowerCase().endsWith('.pdf') ? '...' : 1,  // Count pages for PDFs
            colorPercentage: colorAnalysis.colorPercentage,    // % of colored pixels
            detectedPricePerPage: colorAnalysis.pricePerPage,  // Auto-detected price
            colorTier: getColorTierLabel(colorAnalysis.colorPercentage),  // Light/Medium/Heavy
            pricePerPage: 2                 // Default B&W price: 2 tk
        });
    }

    // Show error if user tried to upload Word documents
    if (hasDocxError) {
        showMessage('❌ Word ফাইল সাপোর্ট করে না! দয়া করে PDF কনভার্ট করে আপলোড করুন।', 'error');
        fileInput.value = ''; // Clear the file input
    }

    // Count pages for PDFs asynchronously
    estimatePageCount();
    // Update the UI to show selected files
    updateUI();
});


// ===============================================
// UI UPDATE FUNCTION
// Re-renders the files list with current settings
// Calculates and displays total cost
// ===============================================
function updateUI() {
    filesList.innerHTML = '';  // Clear existing list
    let grandTotalCost = 0;    // Reset cost calculation

    // Render each selected file
    selectedFiles.forEach((item, index) => {
        // Create file item container
        const div = document.createElement('div');
        div.className = 'file-item';

        // File header: name and size
        const header = document.createElement('div');
        header.className = 'file-header';
        header.innerHTML = `<span>${item.file.name}</span> <span>${(item.file.size / 1024 / 1024).toFixed(2)} MB</span>`;

        // Settings row container
        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'settings-row';

        // Check if file is an image
        const isImage = item.file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
        let totalPagesInput = '';

        // Show page count for PDFs only
        if (isImage) {
            totalPagesInput = '';  // Images are single page
        } else if (item.file.name.toLowerCase().endsWith('.pdf')) {
            // Show loading spinner or actual page count
            let displayCount = item.pageCount === '...' ? '<span class="btn-spinner" style="width:12px;height:12px;border-color:#555;"></span>' : item.pageCount;
            totalPagesInput = `<div class="input-group"><label>Pages</label><div class="ctrl-input" style="background:#eee; width:50px; padding:10px; text-align:center;">${displayCount}</div></div>`;
        }

        // Show page range selector for multi-page documents
        let rangeInput = '';
        if (!isImage) {
            rangeInput = `
            <div class="input-group">
                <label>Range</label>
                <input type="text" placeholder="1-5" value="${item.range}" 
                       onchange="updateFileSetting(${index}, 'range', this.value)"
                       class="ctrl-input" style="width:70px;">
            </div>`;
        }

        // Render file settings: pages, range, copies, print mode
        settingsDiv.innerHTML = `
            ${totalPagesInput}
            ${rangeInput}
            <div class="input-group">
                <label>Copies</label>
                <input type="number" min="1" value="${item.copies}" 
                       onchange="updateFileSetting(${index}, 'copies', this.value)"
                       class="ctrl-input" style="width:50px;">
            </div>
            <div class="input-group">
                <label>Print Mode</label>
                <select onchange="updatePrintMode(${index}, this.value)" 
                        class="ctrl-select" style="${item.printMode === 'color' ? 'background:#dcfce7;' : ''}">
                    <option value="bw" ${item.printMode === 'bw' ? 'selected' : ''}>B&W (2tk)</option>
                    <option value="color" ${item.printMode === 'color' ? 'selected' : ''}>Color (Auto)</option>
                </select>
                ${item.printMode === 'color' ? `
                    <div style="margin-top: 6px; padding: 8px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 8px; font-size: 0.75rem; color: #15803d; text-align: center; font-weight: 600;">
                        ${item.colorTier} (${Math.round(item.colorPercentage)}%)<br>
                        <span style="color: #16a34a;">${item.pricePerPage} tk/page</span>
                    </div>
                ` : ''}
            </div>
        `;

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => { selectedFiles.splice(index, 1); updateUI(); };

        // Assemble the file item
        div.appendChild(header);
        div.appendChild(settingsDiv);
        div.appendChild(removeBtn);
        filesList.appendChild(div);

        // ===============================================
        // COST CALCULATION
        // Calculate cost based on pages, copies, and price
        // ===============================================
        let rawTotal = parseInt(item.pageCount);
        if (isNaN(rawTotal)) rawTotal = 1;  // Default to 1 if unknown

        let estimatedPages = rawTotal;

        // Handle page range (e.g., "1-5" or "3")
        if (item.range && item.range.includes('-')) {
            const parts = item.range.split('-');
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                const safeEnd = Math.min(end, rawTotal);  // Don't exceed total pages
                if (safeEnd >= start) estimatedPages = (safeEnd - start) + 1;
            }
        } else if (item.range && !isNaN(parseInt(item.range))) {
            estimatedPages = 1;  // Single page
        }

        // Calculate file cost
        const costPerSheet = item.pricePerPage || 2;
        const fileCost = estimatedPages * item.copies * costPerSheet;
        item.calculatedCost = fileCost;

        grandTotalCost += fileCost;
    });

    // Add collect later fee if applicable (+1 tk)
    if (collectLaterInput.checked && selectedFiles.length > 0) {
        grandTotalCost += 1;
    }

    currentTotalCost = grandTotalCost;

    // Update cost display in UI
    document.getElementById('totalCost').textContent = currentTotalCost;
    document.getElementById('payAmountDisplay').textContent = currentTotalCost;
}

// ===============================================
// GLOBAL HELPER FUNCTIONS
// Exposed to window for use in inline HTML handlers
// ===============================================

// Update a file setting (copies, range, etc.)
window.updateFileSetting = function (index, key, value) {
    selectedFiles[index][key] = value;
    updateUI();
};

// Update print mode (B&W or Color)
window.updatePrintMode = function (index, mode) {
    selectedFiles[index].printMode = mode;
    if (mode === 'bw') {
        selectedFiles[index].pricePerPage = 2;  // B&W always 2 tk
    } else {
        selectedFiles[index].pricePerPage = selectedFiles[index].detectedPricePerPage;  // Use detected price
    }
    updateUI();
};

// ===============================================
// PDF PAGE COUNT ESTIMATOR
// Asynchronously counts pages in PDF files
// Updates UI when complete
// ===============================================
async function estimatePageCount() {
    for (let item of selectedFiles) {
        if (item.file.name.toLowerCase().endsWith('.pdf') && item.pageCount === '...') {
            try {
                // Wait for pdfjsLib to load if not available
                if (typeof pdfjsLib === 'undefined') {
                    await new Promise(r => setTimeout(r, 1000));
                }
                if (typeof pdfjsLib !== 'undefined') {
                    const buff = await item.file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: buff }).promise;
                    item.pageCount = pdf.numPages;  // Set actual page count
                } else {
                    item.pageCount = '?';  // Library failed to load
                }
            } catch (e) {
                item.pageCount = '?';  // Error counting pages
            }
        }
    }
    updateUI();  // Refresh UI with page counts
}

// ===============================================
// BUTTON EVENT HANDLERS
// ===============================================

// Clear all selected files
clearBtn.onclick = () => { selectedFiles = []; updateUI(); };

// Cancel payment modal
cancelPaymentBtn.onclick = () => paymentSection.classList.remove('show');

// ===============================================
// FORM SUBMIT HANDLER
// Opens payment modal when user proceeds to payment
// ===============================================
uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();  // Prevent form submission

    // Check if submit button is disabled (printer offline)
    if (submitBtn.disabled) return;

    // Validate collect later fields if checked
    if (collectLaterInput.checked) {
        if (!userNameInput.value.trim() || !studentIdInput.value.trim()) {
            return showMessage('Collect Later সিলেক্ট করলে নাম এবং আইডি দিতেই হবে!', 'error');
        }
    }

    // Ensure at least one file is selected
    if (selectedFiles.length === 0) {
        return showMessage('Please upload at least one file!', 'error');
    }

    // Clear previous transaction ID
    trxIdInput.value = '';

    // Show/hide Nagad based on amount (Nagad requires minimum 10 tk)
    const nagadWrapper = document.getElementById('nagadWrapper');
    const nagadMsg = document.getElementById('nagadLowAmountMsg');

    if (currentTotalCost < 10) {
        nagadWrapper.style.display = 'none';
        nagadMsg.style.display = 'block';
    } else {
        nagadWrapper.style.display = 'block';
        nagadMsg.style.display = 'none';
    }

    // Show payment modal
    paymentSection.classList.add('show');
});

// ===============================================
// PAYMENT VERIFICATION HANDLER
// Verifies transaction ID and uploads files
// ===============================================
verifyBtn.onclick = async () => {
    const trxId = trxIdInput.value.trim();

    // Validate transaction ID
    if (!trxId) return showMessage('Please enter Transaction ID!', 'error');

    // Save original button text and disable button
    const originalBtnText = verifyBtn.innerHTML;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<div class="btn-spinner"></div> Verifying...`;

    try {
        // ===============================================
        // STEP 1: VERIFY PAYMENT
        // Check if payment is valid with backend
        // ===============================================
        const verifyUrl = `${CENTRAL_SERVER}/verify-payment`;

        const verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                trx_id: trxId,
                amount: currentTotalCost
            })
        });

        const verifyResult = await verifyRes.json();

        // Handle verification failure
        if (!verifyRes.ok) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnText;

            if (verifyResult.error_type === 'underpayment') {
                alert(verifyResult.message + "\n\nসমস্যা হলে যোগাযোগ করুন: 01771080238 (WhatsApp)");
            } else {
                showMessage(verifyResult.message + supportMsg, 'error');
            }
            return;
        }

        // Show warning if payment is verified but has issues
        if (verifyResult.warning) {
            alert(verifyResult.message);
        }

        // ===============================================
        // STEP 2: UPLOAD FILES
        // Payment verified, now upload files to printer
        // ===============================================
        verifyBtn.innerHTML = `<div class="btn-spinner"></div> Uploading...`;
        loading.classList.add('show');

        // Prepare form data
        const formData = new FormData();
        const finalUserName = collectLaterInput.checked ? userNameInput.value.trim() : 'Unknown';
        const finalStudentId = collectLaterInput.checked ? studentIdInput.value.trim() : 'N/A';

        formData.append('userName', finalUserName);
        formData.append('studentId', finalStudentId);
        formData.append('location', printerLocation);
        formData.append('trxId', trxId);
        formData.append('totalCost', currentTotalCost);
        formData.append('collectLater', collectLaterInput.checked);

        // Add all files
        selectedFiles.forEach(item => formData.append('files', item.file));

        // Add file settings as JSON
        const settings = selectedFiles.map(item => ({
            fileName: item.file.name,
            range: item.range,
            copies: item.copies,
            color: item.printMode,  // 'bw' or 'color'
            cost: item.calculatedCost || 0,
            pages: item.pageCount
        }));
        formData.append('fileSettings', JSON.stringify(settings));

        // Upload to server
        const uploadRes = await fetch(SERVER_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        // Hide loading overlay and restore button
        loading.classList.remove('show');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;

        // Handle upload result
        if (uploadRes.ok) {
            showMessage(`✅ Order Verified! প্রিন্টারে লাল আলো জ্বললে কাগজ লোড করে ব্লিঙ্ক করা বাটনটি চাপুন। অন্যথায় অপেক্ষা করুন। প্রয়োজনে WhatsApp করুন।`, 'success', 30000);

            // Reset form
            selectedFiles = [];
            collectLaterInput.checked = false;
            toggleUserInfo();
            paymentSection.classList.remove('show');
            uploadForm.reset();
        } else {
            showMessage('❌ ফাইল আপলোড হয়নি!' + supportMsg, 'error');
        }

    } catch (err) {
        // Network error or server down
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;
        loading.classList.remove('show');
        console.error(err);
        showMessage('❌ সার্ভার কানেকশন পাওয়া যাচ্ছে না!' + supportMsg, 'error');
    }
};

// ===============================================
// TOAST MESSAGE FUNCTION
// Shows temporary messages to user
// ===============================================
function showMessage(t, type) {
    messageDiv.innerHTML = t;
    messageDiv.className = 'toast show ' + type;
    let time = type === 'error' ? 8000 : 4000;  // Error messages stay longer
    setTimeout(() => messageDiv.className = 'toast', time);
}

// Initialize state
toggleUserInfo();

// ===============================================
// COLOR COVERAGE ANALYSIS FUNCTIONS
// Analyzes images and PDFs to detect color usage
// Determines appropriate pricing tier
// ===============================================

/**
 * Main analysis function - routes to image or PDF analyzer
 */
async function analyzeColorCoverage(file) {
    try {
        if (file.type.startsWith('image/')) {
            return await analyzeImageColor(file);
        } else if (file.type === 'application/pdf') {
            return await analyzePDFColor(file);
        }
        // Default for unsupported types
        return { colorPercentage: 0, pricePerPage: 2 };
    } catch (error) {
        console.error('Color analysis error:', error);
        return { colorPercentage: 0, pricePerPage: 2 };
    }
}

/**
 * Analyzes color coverage in image files
 * Returns percentage of colored pixels
 */
async function analyzeImageColor(imageFile) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for pixel analysis
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize image for faster processing (max 200px)
                const maxSize = 200;
                const scale = Math.min(maxSize / img.width, maxSize / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                // Draw image and get pixel data
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Calculate color percentage
                const colorPercentage = calculateColorPercentage(imageData);
                const pricePerPage = getPriceFromColorPercentage(colorPercentage);

                resolve({ colorPercentage, pricePerPage });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(imageFile);
    });
}

/**
 * Analyzes color coverage in PDF files
 * Samples first 3 pages for efficiency
 */
async function analyzePDFColor(pdfFile) {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let totalColorPercentage = 0;
        const pagesToSample = Math.min(3, pdf.numPages);  // Sample max 3 pages

        // Analyze each sampled page
        for (let i = 1; i <= pagesToSample; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });  // Reduce resolution for speed

            // Render page to canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Get pixel data and calculate color
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            totalColorPercentage += calculateColorPercentage(imageData);
        }

        // Average color percentage across sampled pages
        const avgColorPercentage = totalColorPercentage / pagesToSample;
        const pricePerPage = getPriceFromColorPercentage(avgColorPercentage);

        return { colorPercentage: avgColorPercentage, pricePerPage };
    } catch (error) {
        console.error('PDF color analysis error:', error);
        return { colorPercentage: 0, pricePerPage: 2 };
    }
}

/**
 * Calculates percentage of colored pixels in image data
 * Samples every 4th pixel for performance (i += 16 instead of 4)
 */
function calculateColorPercentage(imageData) {
    const pixels = imageData.data;
    let colorPixels = 0;
    let totalPixels = 0;

    // Sample pixels (skip 3 out of 4 for speed)
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Calculate saturation to detect color
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const saturation = maxChannel - minChannel;

        // Consider pixel colored if saturation > 15 and brightness > 30
        if (saturation > 15 && maxChannel > 30) {
            colorPixels++;
        }
        totalPixels++;
    }

    return (colorPixels / totalPixels) * 100;
}

/**
 * Maps color percentage to price tier
 * Light (0-40%): 3 tk
 * Medium (40-70%): 4 tk
 * Heavy (70-90%): 5 tk
 * Full (>90%): 6 tk
 */
function getPriceFromColorPercentage(colorPercentage) {
    if (colorPercentage < 40) return 3;       // Light Color
    if (colorPercentage < 70) return 4;       // Medium Color
    if (colorPercentage < 90) return 5;       // Heavy Color
    return 6;                                  // Full Color
}

/**
 * Returns human-readable color tier label
 */
function getColorTierLabel(percentage) {
    if (percentage < 40) return 'Light Color';
    if (percentage < 70) return 'Medium Color';
    if (percentage < 90) return 'Heavy Color';
    return 'Full Color';
}

// ===============================================
// MAINTENANCE MODE HANDLER
// Shows/hides maintenance screen based on flag
// ===============================================
(function checkMaintenanceMode() {
    const maintenanceScreen = document.getElementById('maintenanceScreen');
    const mainContainer = document.querySelector('.main-container');

    if (MAINTENANCE_MODE) {
        // Show maintenance screen, hide main app
        maintenanceScreen.style.display = 'flex';
        mainContainer.style.display = 'none';
    } else {
        // Hide maintenance screen, show main app
        maintenanceScreen.style.display = 'none';
        mainContainer.style.display = 'block';
    }
})();