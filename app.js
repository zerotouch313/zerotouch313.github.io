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
// ===============================================
const MAINTENANCE_MODE = false;

// ===============================================
// PDF.JS WORKER CONFIGURATION
// ===============================================
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
} else {
    window.addEventListener('load', () => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
    });
}

// ===============================================
// DOM ELEMENT REFERENCES
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
document.querySelector('.content').insertBefore(statusBanner, uploadForm);


// ===============================================
// APPLICATION STATE
// ===============================================
let selectedFiles = [];
let currentTotalCost = 0;

// ===============================================
// PRINTER STATUS CHECKER
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
            if (data.printer_online === false) {
                showStatusError(`
                    ⚠️ Printer is Offline!<br>
                    <span style="font-size: 0.9em; font-weight: normal;">Could you please check if the printer power button is on?<br>
                    দয়া করে চেক করুন প্রিন্টারের পাওয়ার বাটন অন আছে কিনা।</span>
                `);
            } else {
                hideStatusError();
            }
        }
    } catch (e) {
        console.log("Status check skipped (Network/Server Issue)");
    }
}

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

checkSystemStatus();
setInterval(checkSystemStatus, 5000);


// ===============================================
// SUPPORT MESSAGE TEMPLATE
// ===============================================
const supportMsg = `<br><div style="margin-top:6px; font-size:0.9rem; color:#ffd1d1;">
                    যে কোনো সমস্যায় WhatsApp করুন:<br>
                    <strong style="font-size:1rem; color:#fff;">01771080238</strong>
                    </div>`;


// ===============================================
// COLLECT LATER TOGGLE FUNCTION
// ===============================================
function toggleUserInfo() {
    if (collectLaterInput.checked) {
        userInfoSection.style.display = 'block';
        userNameInput.required = true;
        studentIdInput.required = true;
        setTimeout(() => userNameInput.focus(), 100);
    } else {
        userInfoSection.style.display = 'none';
        userNameInput.required = false;
        studentIdInput.required = false;
        userNameInput.value = '';
        studentIdInput.value = '';
    }
    updateUI();
}

collectLaterInput.addEventListener('change', toggleUserInfo);

// ===============================================
// FILE INPUT HANDLER
// ===============================================
fileInput.addEventListener('change', async (e) => {
    let hasDocxError = false;

    for (const f of Array.from(e.target.files)) {
        if (f.name.toLowerCase().endsWith('.doc') || f.name.toLowerCase().endsWith('.docx')) {
            hasDocxError = true;
            continue;
        }

        const colorAnalysis = await analyzeColorCoverage(f);

        selectedFiles.push({
            file: f,
            copies: 1,
            range: '',
            printMode: 'bw',
            pageCount: f.name.toLowerCase().endsWith('.pdf') ? '...' : 1,
            colorPercentage: colorAnalysis.colorPercentage,
            detectedPricePerPage: colorAnalysis.pricePerPage,
            colorTier: getColorTierLabel(colorAnalysis.colorPercentage),
            pricePerPage: 2
        });
    }

    if (hasDocxError) {
        showMessage('❌ Word ফাইল সাপোর্ট করে না! দয়া করে PDF কনভার্ট করে আপলোড করুন।', 'error');
        fileInput.value = '';
    }

    estimatePageCount();
    updateUI();
});


// ===============================================
// UI UPDATE FUNCTION
// ===============================================
function updateUI() {
    filesList.innerHTML = '';
    let grandTotalCost = 0;

    selectedFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';

        const header = document.createElement('div');
        header.className = 'file-header';
        header.innerHTML = `<span>${item.file.name}</span> <span>${(item.file.size / 1024 / 1024).toFixed(2)} MB</span>`;

        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'settings-row';

        const isImage = item.file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
        let totalPagesInput = '';

        if (isImage) {
            totalPagesInput = '';
        } else if (item.file.name.toLowerCase().endsWith('.pdf')) {
            let displayCount = item.pageCount === '...' ? '<span class="btn-spinner" style="width:12px;height:12px;border-color:#555;"></span>' : item.pageCount;
            totalPagesInput = `<div class="input-group"><label>Pages</label><div class="ctrl-input" style="background:#eee; width:50px; padding:10px; text-align:center;">${displayCount}</div></div>`;
        }

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

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => { selectedFiles.splice(index, 1); updateUI(); };

        div.appendChild(header);
        div.appendChild(settingsDiv);
        div.appendChild(removeBtn);
        filesList.appendChild(div);

        // Cost Calculation
        let rawTotal = parseInt(item.pageCount);
        if (isNaN(rawTotal)) rawTotal = 1;

        let estimatedPages = rawTotal;

        if (item.range && item.range.includes('-')) {
            const parts = item.range.split('-');
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);
            if (!isNaN(start) && !isNaN(end) && end >= start) {
                const safeEnd = Math.min(end, rawTotal);
                if (safeEnd >= start) estimatedPages = (safeEnd - start) + 1;
            }
        } else if (item.range && !isNaN(parseInt(item.range))) {
            estimatedPages = 1;
        }

        const costPerSheet = item.pricePerPage || 2;
        const fileCost = estimatedPages * item.copies * costPerSheet;
        item.calculatedCost = fileCost;

        grandTotalCost += fileCost;
    });

    if (collectLaterInput.checked && selectedFiles.length > 0) {
        grandTotalCost += 1;
    }

    currentTotalCost = grandTotalCost;

    document.getElementById('totalCost').textContent = currentTotalCost;
    document.getElementById('payAmountDisplay').textContent = currentTotalCost;
}

// ===============================================
// GLOBAL HELPER FUNCTIONS
// ===============================================
window.updateFileSetting = function (index, key, value) {
    selectedFiles[index][key] = value;
    updateUI();
};

window.updatePrintMode = function (index, mode) {
    selectedFiles[index].printMode = mode;
    if (mode === 'bw') {
        selectedFiles[index].pricePerPage = 2;
    } else {
        selectedFiles[index].pricePerPage = selectedFiles[index].detectedPricePerPage;
    }
    updateUI();
};

// ===============================================
// PDF PAGE COUNT ESTIMATOR
// ===============================================
async function estimatePageCount() {
    for (let item of selectedFiles) {
        if (item.file.name.toLowerCase().endsWith('.pdf') && item.pageCount === '...') {
            try {
                if (typeof pdfjsLib === 'undefined') {
                    await new Promise(r => setTimeout(r, 1000));
                }
                if (typeof pdfjsLib !== 'undefined') {
                    const buff = await item.file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: buff }).promise;
                    item.pageCount = pdf.numPages;
                } else {
                    item.pageCount = '?';
                }
            } catch (e) {
                item.pageCount = '?';
            }
        }
    }
    updateUI();
}

// ===============================================
// BUTTON EVENT HANDLERS
// ===============================================
clearBtn.onclick = () => { selectedFiles = []; updateUI(); };
cancelPaymentBtn.onclick = () => paymentSection.classList.remove('show');

// ===============================================
// FORM SUBMIT HANDLER
// ===============================================
uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (submitBtn.disabled) return;

    if (collectLaterInput.checked) {
        if (!userNameInput.value.trim() || !studentIdInput.value.trim()) {
            return showMessage('Collect Later সিলেক্ট করলে নাম এবং আইডি দিতেই হবে!', 'error');
        }
    }

    if (selectedFiles.length === 0) {
        return showMessage('Please upload at least one file!', 'error');
    }

    trxIdInput.value = '';

    const nagadWrapper = document.getElementById('nagadWrapper');
    const nagadMsg = document.getElementById('nagadLowAmountMsg');

    if (currentTotalCost < 10) {
        nagadWrapper.style.display = 'none';
        nagadMsg.style.display = 'block';
    } else {
        nagadWrapper.style.display = 'block';
        nagadMsg.style.display = 'none';
    }

    paymentSection.classList.add('show');
});

// ===============================================
// PAYMENT VERIFICATION HANDLER (MODIFIED)
// ===============================================
verifyBtn.onclick = async () => {
    const trxId = trxIdInput.value.trim();

    if (!trxId) return showMessage('Please enter Transaction ID!', 'error');

    const originalBtnText = verifyBtn.innerHTML;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<div class="btn-spinner"></div> Verifying...`;

    try {
        // STEP 1: VERIFY PAYMENT
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

        if (verifyResult.warning) {
            alert(verifyResult.message);
        }

        // STEP 2: UPLOAD FILES
        verifyBtn.innerHTML = `<div class="btn-spinner"></div> Uploading...`;
        loading.classList.add('show');

        const formData = new FormData();
        const finalUserName = collectLaterInput.checked ? userNameInput.value.trim() : 'Unknown';
        const finalStudentId = collectLaterInput.checked ? studentIdInput.value.trim() : 'N/A';

        // 1. Add Original Files
        selectedFiles.forEach(item => formData.append('files', item.file));

        // Create base settings array
        let settingsData = selectedFiles.map(item => ({
            fileName: item.file.name,
            range: item.range,
            copies: item.copies,
            color: item.printMode,
            cost: item.calculatedCost || 0,
            pages: item.pageCount
        }));

        // -----------------------------------------------------------
        // FIX: FORCE COLLECT LATER TO BE THE LAST PAGE (IMAGE TRICK)
        // -----------------------------------------------------------
        let sendCollectLaterFlag = collectLaterInput.checked;

        if (collectLaterInput.checked) {
            // Generate an image slip for the user info
            const slipBlob = await createSlipImage(finalUserName, finalStudentId, trxId);

            // Append this slip as the LAST file
            formData.append('files', slipBlob, "Collect_Later_Slip.jpg");

            // Add settings for this slip (Cost 1tk as per fee)
            settingsData.push({
                fileName: "Collect_Later_Slip.jpg",
                range: "",
                copies: 1,
                color: 'bw',
                cost: 1, // Using the 1tk fee as the cost for this file
                pages: 1
            });

            // IMPORTANT: Set collectLater to false for the server logic
            sendCollectLaterFlag = false;
        }

        // Attach Settings
        formData.append('fileSettings', JSON.stringify(settingsData));

        // Attach Metadata
        formData.append('userName', finalUserName);
        formData.append('studentId', finalStudentId);
        formData.append('location', printerLocation);
        formData.append('trxId', trxId);
        formData.append('totalCost', currentTotalCost);

        // Send modified flag
        formData.append('collectLater', sendCollectLaterFlag);

        // Upload to server
        const uploadRes = await fetch(SERVER_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        loading.classList.remove('show');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;

        if (uploadRes.ok) {
            showMessage(`✅ Order Verified! প্রিন্টারে লাল আলো জ্বললে কাগজ লোড করে ব্লিঙ্ক করা বাটনটি চাপুন। অন্যথায় অপেক্ষা করুন। প্রয়োজনে WhatsApp করুন।`, 'success', 30000);

            selectedFiles = [];
            collectLaterInput.checked = false;
            toggleUserInfo();
            paymentSection.classList.remove('show');
            uploadForm.reset();
        } else {
            showMessage('❌ ফাইল আপলোড হয়নি!' + supportMsg, 'error');
        }

    } catch (err) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;
        loading.classList.remove('show');
        console.error(err);
        showMessage('❌ সার্ভার কানেকশন পাওয়া যাচ্ছে না!' + supportMsg, 'error');
    }
};

// ===============================================
// NEW HELPER: CREATE SLIP IMAGE (CANVAS)
// Generates a JPG image of the user info
// ===============================================
function createSlipImage(name, id, trx) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // A4 size roughly at 96 DPI (or smaller for slip)
        canvas.width = 600;
        canvas.height = 400;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Text Styles
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';

        // -------------------------
        // ADDED: ZeroTouch Branding
        // -------------------------
        ctx.font = 'bold italic 40px Arial';
        ctx.fillText("ZeroTouch", canvas.width / 2, 55);

        // Header (Moved down)
        ctx.font = 'bold 22px Arial';
        ctx.fillText("COLLECT LATER SLIP", canvas.width / 2, 90);

        // Date (Moved down)
        ctx.font = '16px Arial';
        ctx.fillText(new Date().toLocaleString(), canvas.width / 2, 115);

        // Divider (Moved down)
        ctx.beginPath();
        ctx.moveTo(40, 130);
        ctx.lineTo(canvas.width - 40, 130);
        ctx.stroke();

        // Details
        ctx.textAlign = 'left';
        ctx.font = 'bold 24px Arial';

        let y = 180; // Start printing details a bit lower
        ctx.fillText(`Name: ${name}`, 50, y);
        y += 50;
        ctx.fillText(`Student ID: ${id}`, 50, y);
        y += 50;
        ctx.fillText(`Trx ID: ${trx}`, 50, y);

        // Footer
        ctx.font = 'italic 18px Arial';
        ctx.fillStyle = '#555555';
        ctx.textAlign = 'center';
        ctx.fillText("Please keep this slip for collection.", canvas.width / 2, 350);

        // Convert to Blob
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.9);
    });
}

// ===============================================
// TOAST MESSAGE FUNCTION
// ===============================================
function showMessage(t, type) {
    messageDiv.innerHTML = t;
    messageDiv.className = 'toast show ' + type;
    let time = type === 'error' ? 8000 : 4000;
    setTimeout(() => messageDiv.className = 'toast', time);
}

// Initialize state
toggleUserInfo();

// ===============================================
// COLOR COVERAGE ANALYSIS FUNCTIONS
// ===============================================

async function analyzeColorCoverage(file) {
    try {
        if (file.type.startsWith('image/')) {
            return await analyzeImageColor(file);
        } else if (file.type === 'application/pdf') {
            return await analyzePDFColor(file);
        }
        return { colorPercentage: 0, pricePerPage: 2 };
    } catch (error) {
        console.error('Color analysis error:', error);
        return { colorPercentage: 0, pricePerPage: 2 };
    }
}

async function analyzeImageColor(imageFile) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxSize = 200;
                const scale = Math.min(maxSize / img.width, maxSize / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const colorPercentage = calculateColorPercentage(imageData);
                const pricePerPage = getPriceFromColorPercentage(colorPercentage);
                resolve({ colorPercentage, pricePerPage });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(imageFile);
    });
}

async function analyzePDFColor(pdfFile) {
    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let totalColorPercentage = 0;
        const pagesToSample = Math.min(3, pdf.numPages);
        for (let i = 1; i <= pagesToSample; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            totalColorPercentage += calculateColorPercentage(imageData);
        }
        const avgColorPercentage = totalColorPercentage / pagesToSample;
        const pricePerPage = getPriceFromColorPercentage(avgColorPercentage);
        return { colorPercentage: avgColorPercentage, pricePerPage };
    } catch (error) {
        console.error('PDF color analysis error:', error);
        return { colorPercentage: 0, pricePerPage: 2 };
    }
}

function calculateColorPercentage(imageData) {
    const pixels = imageData.data;
    let colorPixels = 0;
    let totalPixels = 0;
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const saturation = maxChannel - minChannel;
        if (saturation > 15 && maxChannel > 30) {
            colorPixels++;
        }
        totalPixels++;
    }
    return (colorPixels / totalPixels) * 100;
}

function getPriceFromColorPercentage(colorPercentage) {
    if (colorPercentage < 40) return 3;
    if (colorPercentage < 70) return 4;
    if (colorPercentage < 90) return 5;
    return 6;
}

function getColorTierLabel(percentage) {
    if (percentage < 40) return 'Light Color';
    if (percentage < 70) return 'Medium Color';
    if (percentage < 90) return 'Heavy Color';
    return 'Full Color';
}

// ===============================================
// MAINTENANCE MODE HANDLER
// ===============================================
(function checkMaintenanceMode() {
    const maintenanceScreen = document.getElementById('maintenanceScreen');
    const mainContainer = document.querySelector('.main-container');

    if (MAINTENANCE_MODE) {
        maintenanceScreen.style.display = 'flex';
        mainContainer.style.display = 'none';
    } else {
        maintenanceScreen.style.display = 'none';
        mainContainer.style.display = 'block';
    }
})();