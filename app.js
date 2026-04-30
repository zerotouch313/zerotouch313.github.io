// ===============================================
// ZERO TOUCH PRINTING PORTAL - MAIN APPLICATION
// ===============================================

const CENTRAL_SERVER = 'https://mutilator-goes-twentieth.ngrok-free.dev';
const SERVER_UPLOAD_URL = `${CENTRAL_SERVER}/api/print/upload`; 
const VERIFY_PAYMENT_URL = `${CENTRAL_SERVER}/verify-payment`;

// 🤫 Silent Web Guest Credentials
const WEB_GUEST_EMAIL = 'mohammod.tasin.07@gmail.com'; 
const WEB_GUEST_PASS = '12341234'; 
let currentJWT = null;
const MAINTENANCE_MODE = false;

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
} else {
    window.addEventListener('load', () => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
    });
}

// DOM
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

const collectLaterInput = document.getElementById('collectLater');
const userInfoSection = document.getElementById('userInfoSection');
const userNameInput = document.getElementById('userName');
const studentIdInput = document.getElementById('studentId');
const trxIdInput = document.getElementById('trxId');
const printerLocationSelect = document.getElementById('printerLocation');

// Payment Modal Number Elements
const bkashNumberEl = document.getElementById('bkashNumber');
const nagadNumberEl = document.getElementById('nagadNumber');
const bkashCopyIcon = document.getElementById('bkashCopyIcon');
const nagadCopyIcon = document.getElementById('nagadCopyIcon');

let selectedFiles = [];
let currentTotalCost = 0;

// ===============================================
// 🔐 SILENT BACKGROUND AUTHENTICATION
// ===============================================
async function authenticateWebClient() {
    try {
        console.log("🔄 Fetching Web Guest Token...");
        const res = await fetch(`${CENTRAL_SERVER}/api/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
            },
            body: JSON.stringify({ email: WEB_GUEST_EMAIL, password: WEB_GUEST_PASS })
        });

        if (res.ok) {
            const data = await res.json();
            currentJWT = data.access_token;
            console.log("✅ Web Client Authenticated Successfully!");
        } else {
            console.error("❌ Web Auth Failed. Check credentials.");
        }
    } catch (e) {
        console.error("❌ Server Auth Connection Error:", e);
    }
}
authenticateWebClient();

// ===============================================
// STATUS BANNER SETUP
// ===============================================
const statusBanner = document.createElement('div');
statusBanner.id = 'statusBanner';
statusBanner.className = 'status-banner';
document.querySelector('.content').insertBefore(statusBanner, uploadForm);

// ===============================================
// PRINTER STATUS & DYNAMIC NUMBERS
// ===============================================
function updatePaymentNumbers() {
    const loc = printerLocationSelect.value;
    if (!loc) return; // Skip if no location selected

    let bkashNum = '';
    let nagadNum = '';

    // Logic for Hall based Numbers
    if (loc === 'zia_hall' || loc === 'shaheed_hadi_hall' || loc === 'sher_e_bangla_hall') {
        bkashNum = '01716897644';
        nagadNum = '01716897644';
    } else if (loc === 'female_hall') {
        bkashNum = '01568550778';
        nagadNum = '01956018657';
    }

    bkashNumberEl.textContent = bkashNum;
    nagadNumberEl.textContent = nagadNum;

    bkashCopyIcon.onclick = () => {
        navigator.clipboard.writeText(bkashNum);
        showMessage('✅ bKash Number Copied!', 'success', 2000);
    };
    nagadCopyIcon.onclick = () => {
        navigator.clipboard.writeText(nagadNum);
        showMessage('✅ Nagad Number Copied!', 'success', 2000);
    };
}

async function checkPrinterStatus() {
    const locationId = printerLocationSelect.value;
    if (!locationId) {
        hideStatusError();
        return;
    }
    try {
        const res = await fetch(`${CENTRAL_SERVER}/status/${locationId}?t=${Date.now()}`, {
            headers: {
                'ngrok-skip-browser-warning': '69420'
            }
        });
        if (res.ok) {
            const data = await res.json();
            if (!data.printer_online) {
                const hallName = printerLocationSelect.options[printerLocationSelect.selectedIndex].text;
                showStatusError(`
                    <div class="offline-alert">
                        <i class="ph-fill ph-warning-octagon"></i>
                        <div>
                            <strong>${hallName}-এর প্রিন্টারটি এখন অফলাইন আছে!</strong><br>
                            <span style="font-size: 0.85em;">দয়া করে অন্য হল সিলেক্ট করুন।</span>
                        </div>
                    </div>
                `);
            } else {
                hideStatusError();
            }
        }
    } catch (e) {
        console.error("Status check failed", e);
    }
}

printerLocationSelect.addEventListener('change', () => {
    checkPrinterStatus();
    updatePaymentNumbers(); // Update payment numbers when hall changes
});

setInterval(checkPrinterStatus, 5000);
checkPrinterStatus();
updatePaymentNumbers(); // Set initial numbers on load

function showStatusError(msg) {
    if (statusBanner.innerHTML !== msg) {
        statusBanner.innerHTML = msg;
        statusBanner.classList.add('show');
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
        submitBtn.innerHTML = '<i class="ph ph-prohibit"></i> Service Unavailable';
    }
}

function hideStatusError() {
    if (statusBanner.classList.contains('show') || submitBtn.disabled) {
        statusBanner.classList.remove('show');
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-disabled');
        submitBtn.innerHTML = 'Proceed to Payment <i class="ph-bold ph-arrow-right"></i>';
    }
}

const supportMsg = `<br><div style="margin-top:6px; font-size:0.85rem; color:#fca5a5;">যে কোনো সমস্যায় WhatsApp করুন</div>`;

function toggleUserInfo() {
    if (collectLaterInput.checked) {
        userInfoSection.style.display = 'block';
        setTimeout(() => { userInfoSection.style.opacity = '1'; }, 10);
        userNameInput.required = true;
        studentIdInput.required = true;
        setTimeout(() => userNameInput.focus(), 100);
    } else {
        userInfoSection.style.opacity = '0';
        setTimeout(() => { userInfoSection.style.display = 'none'; }, 300);
        userNameInput.required = false;
        studentIdInput.required = false;
        userNameInput.value = '';
        studentIdInput.value = '';
    }
    updateUI();
}

collectLaterInput.addEventListener('change', toggleUserInfo);

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
            colorPercentage: colorAnalysis.colorPercentage
        });
    }

    if (hasDocxError) {
        showMessage('❌ Word ফাইল সাপোর্ট করে না! দয়া করে PDF কনভার্ট করে আপলোড করুন।', 'error');
        fileInput.value = '';
    }
    estimatePageCount();
    updateUI();
});

function updateUI() {
    filesList.innerHTML = '';
    let grandTotalCost = 0;

    selectedFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';

        const header = document.createElement('div');
        header.className = 'file-header';
        header.innerHTML = `<span class="truncate">${item.file.name}</span> <span class="file-size">${(item.file.size / 1024 / 1024).toFixed(2)} MB</span>`;

        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'settings-row';

        const isImage = item.file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
        let totalPagesInput = '';

        if (!isImage && item.file.name.toLowerCase().endsWith('.pdf')) {
            let displayCount = item.pageCount === '...' ? '<div class="btn-spinner small"></div>' : item.pageCount;
            totalPagesInput = `<div class="input-group"><label>Pages</label><div class="ctrl-input page-display">${displayCount}</div></div>`;
        }

        let rangeInput = '';
        if (!isImage) {
            rangeInput = `
            <div class="input-group">
                <label>Range</label>
                <input type="text" placeholder="e.g. 1-5" value="${item.range}" 
                       onchange="updateFileSetting(${index}, 'range', this.value)"
                       class="ctrl-input range-input">
            </div>`;
        }

        const costPerSheet = getPriceFromCoverage(item.colorPercentage, item.printMode);

        settingsDiv.innerHTML = `
            ${totalPagesInput}
            ${rangeInput}
            <div class="input-group">
                <label>Copies</label>
                <input type="number" min="1" value="${item.copies}" 
                       onchange="updateFileSetting(${index}, 'copies', this.value)"
                       class="ctrl-input copies-input">
            </div>
            <div class="input-group flex-grow">
                <label>Print Mode</label>
                <select onchange="updatePrintMode(${index}, this.value)" 
                        class="ctrl-select mode-select ${item.printMode === 'color' ? 'color-active' : ''}">
                    <option value="bw" ${item.printMode === 'bw' ? 'selected' : ''}>Black & White</option>
                    <option value="color" ${item.printMode === 'color' ? 'selected' : ''}>Color</option>
                </select>
                <div class="color-badge" ${item.printMode === 'bw' ? 'style="color: #475569; background: #f1f5f9; border: 1px solid #cbd5e1;"' : ''}>
                    Color Coverage: ${Math.round(item.colorPercentage)}% • <span>${costPerSheet.toFixed(2)} ৳/page</span>
                </div>
            </div>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.innerHTML = '<i class="ph ph-x"></i>';
        removeBtn.onclick = () => { selectedFiles.splice(index, 1); updateUI(); };

        div.appendChild(header);
        div.appendChild(settingsDiv);
        div.appendChild(removeBtn);
        filesList.appendChild(div);

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

        const fileCost = estimatedPages * item.copies * costPerSheet;
        item.calculatedCost = fileCost;

        grandTotalCost += fileCost;
    });

    if (collectLaterInput.checked && selectedFiles.length > 0) {
        grandTotalCost += 1;
    }

    currentTotalCost = parseFloat(grandTotalCost.toFixed(2));
    document.getElementById('totalCost').textContent = currentTotalCost.toFixed(2);
    document.getElementById('payAmountDisplay').textContent = currentTotalCost.toFixed(2);
}

window.updateFileSetting = function (index, key, value) {
    selectedFiles[index][key] = value;
    updateUI();
};

window.updatePrintMode = function (index, mode) {
    selectedFiles[index].printMode = mode;
    updateUI();
};

async function estimatePageCount() {
    for (let item of selectedFiles) {
        if (item.file.name.toLowerCase().endsWith('.pdf') && item.pageCount === '...') {
            try {
                if (typeof pdfjsLib === 'undefined') await new Promise(r => setTimeout(r, 1000));
                if (typeof pdfjsLib !== 'undefined') {
                    const buff = await item.file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: buff }).promise;
                    item.pageCount = pdf.numPages;
                } else {
                    item.pageCount = '?';
                }
            } catch (e) { item.pageCount = '?'; }
        }
    }
    updateUI();
}

clearBtn.onclick = () => { selectedFiles = []; updateUI(); };
cancelPaymentBtn.onclick = () => paymentSection.classList.remove('show');

// Validation Bubble Logic
const validationBubble = document.createElement('div');
validationBubble.className = 'validation-bubble';
validationBubble.innerHTML = '<i class="ph-fill ph-warning-circle"></i> Please select a printer location first!';
document.querySelector('.select-wrapper').appendChild(validationBubble);

function showLocationError() {
    const wrapper = document.querySelector('.select-wrapper');
    const select = document.getElementById('printerLocation');
    
    // Scroll to location group
    document.querySelector('.location-group').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Show error visual state
    select.classList.add('error-glow', 'shake');
    validationBubble.classList.add('show');
    
    // Remove after delay or on change
    setTimeout(() => {
        select.classList.remove('shake');
    }, 500);

    const removeError = () => {
        select.classList.remove('error-glow');
        validationBubble.classList.remove('show');
        select.removeEventListener('change', removeError);
    };
    select.addEventListener('change', removeError);
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!printerLocationSelect.value) {
        showLocationError();
        return;
    }

    if (!currentJWT) {
        showMessage('⚠️ Authentication connecting. Please try again.', 'error');
        await authenticateWebClient();
        return;
    }
    if (submitBtn.disabled) return;

    if (collectLaterInput.checked) {
        if (!userNameInput.value.trim() || !studentIdInput.value.trim()) {
            return showMessage('Collect Later সিলেক্ট করলে নাম এবং আইডি দিতেই হবে!', 'error');
        }
    }
    if (selectedFiles.length === 0) return showMessage('Please upload at least one file!', 'error');

    trxIdInput.value = '';
    const nagadWrapper = document.getElementById('nagadWrapper');
    const nagadMsg = document.getElementById('nagadLowAmountMsg');

    if (currentTotalCost < 10) {
        nagadWrapper.style.display = 'none';
        nagadMsg.style.display = 'flex';
    } else {
        nagadWrapper.style.display = 'block';
        nagadMsg.style.display = 'none';
    }
    paymentSection.classList.add('show');
});

verifyBtn.onclick = async () => {
    const trxId = trxIdInput.value.trim();
    if (!trxId) return showMessage('Please enter Transaction ID!', 'error');

    const originalBtnText = verifyBtn.innerHTML;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<div class="btn-spinner"></div> Verifying...`;

    try {
        const verifyRes = await fetch(VERIFY_PAYMENT_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '69420'
             },
            body: JSON.stringify({ trx_id: trxId, amount: currentTotalCost })
        });
        const verifyResult = await verifyRes.json();

        if (!verifyRes.ok) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnText;
            if (verifyResult.error_type === 'underpayment') {
                alert(verifyResult.message + "\n\nসমস্যা হলে WhatsApp যোগাযোগ করুন");
            } else {
                showMessage(verifyResult.message + supportMsg, 'error');
            }
            return;
        }

        if (verifyResult.warning) alert(verifyResult.message);

        verifyBtn.innerHTML = `<div class="btn-spinner"></div> Uploading...`;
        loading.classList.add('show');

        const formData = new FormData();
        const finalUserName = collectLaterInput.checked ? userNameInput.value.trim() : 'Unknown';
        const finalStudentId = collectLaterInput.checked ? studentIdInput.value.trim() : 'N/A';
        const sendCollectLaterFlag = collectLaterInput.checked;
        let settingsData = [];

        selectedFiles.forEach(item => {
            formData.append('files', item.file);
            settingsData.push({
                fileName: item.file.name,
                range: item.range,
                copies: item.copies,
                print_mode: item.printMode,
                cost: item.calculatedCost || 0,
                pages: item.pageCount
            });
        });

        formData.append('fileSettings', JSON.stringify(settingsData));
        formData.append('location', printerLocationSelect.value); 
        formData.append('trx_id', trxId); 
        formData.append('totalCost', currentTotalCost);
        formData.append('collectLater', sendCollectLaterFlag);
        formData.append('payment_method', 'instant'); 
        formData.append('cover_name', finalUserName);
        formData.append('cover_id', finalStudentId);

        const uploadRes = await fetch(SERVER_UPLOAD_URL, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${currentJWT}`,
                'ngrok-skip-browser-warning': '69420'
            },
            body: formData
        });

        loading.classList.remove('show');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;

        if (uploadRes.ok) {
            showMessage(`✅ Order Verified! প্রিন্টারে লাল আলো জ্বললে কাগজ লোড করে ব্লিঙ্ক করা বাটনটি চাপুন।`, 'success', 30000);
            selectedFiles = [];
            collectLaterInput.checked = false;
            toggleUserInfo();
            paymentSection.classList.remove('show');
            uploadForm.reset();
        } else {
            const errorMsg = await uploadRes.json();
            if(uploadRes.status === 401) {
                await authenticateWebClient();
                showMessage(`⚠️ Session refreshed. Please click "Verify & Proceed" again.`, 'error');
            } else {
                showMessage(`❌ আপলোড ব্যর্থ: ${errorMsg.error || 'ফাইল আপলোড হয়নি!'}` + supportMsg, 'error');
            }
        }
    } catch (err) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;
        loading.classList.remove('show');
        console.error(err);
        showMessage('❌ সার্ভার কানেকশন পাওয়া যাচ্ছে না!' + supportMsg, 'error');
    }
};

function showMessage(t, type, overrideTime) {
    messageDiv.innerHTML = t;
    messageDiv.className = 'toast show ' + type;
    let time = overrideTime || (type === 'error' ? 8000 : 4000);
    setTimeout(() => messageDiv.className = 'toast', time);
}
toggleUserInfo();

// ===============================================
// DYNAMIC COVERAGE PRICING LOGIC
// ===============================================
async function analyzeColorCoverage(file) {
    try {
        if (file.type.startsWith('image/')) return await analyzeImageColor(file);
        else if (file.type === 'application/pdf') return await analyzePDFColor(file);
        return { colorPercentage: 0 };
    } catch (error) { return { colorPercentage: 0 }; }
}

async function analyzeImageColor(imageFile) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scale = Math.min(200 / img.width, 200 / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                resolve({ colorPercentage: calculateCoveragePercentage(imageData) });
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
        let totalCoveragePercentage = 0;
        const pagesToSample = Math.min(3, pdf.numPages);
        for (let i = 1; i <= pagesToSample; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            totalCoveragePercentage += calculateCoveragePercentage(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
        return { colorPercentage: totalCoveragePercentage / pagesToSample };
    } catch (error) { return { colorPercentage: 0 }; }
}

function calculateCoveragePercentage(imageData) {
    const pixels = imageData.data;
    let inkPixels = 0, totalPixels = 0;
    for (let i = 0; i < pixels.length; i += 16) { // Step by 4 pixels for performance
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        // Ignore highly transparent pixels
        if (a > 20) {
            // Count as "ink coverage" if it's significantly darker than pure white
            if ((r + g + b) / 3 < 240) {
                inkPixels++;
            }
        }
        totalPixels++;
    }
    return totalPixels === 0 ? 0 : (inkPixels / totalPixels) * 100;
}

function getPriceFromCoverage(coverage, mode) {
    let basePrice = mode === 'color' ? 3.0 : 2.0;
    let price = basePrice;
    
    // Increase price linearly up to +5.0/75.0 per extra coverage percent above 25%
    if (coverage > 25) {
        price += (coverage - 25) * (5.0 / 75.0);
    }
    
    let maxPrice = mode === 'color' ? 8.0 : 7.0;
    return Math.min(price, maxPrice);
}