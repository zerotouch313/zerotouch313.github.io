// 🔥 আপনার সর্বশেষ Ngrok URL টি এখানে বসান (https সহ)
const CENTRAL_SERVER = 'https://jace-nonpuristic-carter.ngrok-free.dev';
const SERVER_UPLOAD_URL = `${CENTRAL_SERVER}/upload`;

// PDF Worker Fix
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
} else {
    window.addEventListener('load', () => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
    });
}

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
const printerLocation = document.getElementById('printerLocation').value;

// Status Banner Setup
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


let selectedFiles = [];
let currentTotalCost = 0;

// 🔥 1. FIXED PRINTER STATUS LOGIC
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

            // 🔥 FIX: Printer Offline Check
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
        // Status check skipped (Network/Server Issue) - No Error Popup
        console.log("Status check skipped");
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

// Initial Call
checkSystemStatus();
// Check every 5 seconds
setInterval(checkSystemStatus, 5000);


const supportMsg = `<br><div style="margin-top:6px; font-size:0.9rem; color:#ffd1d1;">
                    যে কোনো সমস্যায় WhatsApp করুন:<br>
                    <strong style="font-size:1rem; color:#fff;">01771080238</strong>
                    </div>`;


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

// 🔥 2. RESTORED COLOR ANALYSIS FEATURE
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
            printMode: 'bw', // Default Print Mode
            pageCount: f.name.toLowerCase().endsWith('.pdf') ? '...' : 1,
            colorPercentage: colorAnalysis.colorPercentage,
            detectedPricePerPage: colorAnalysis.pricePerPage,
            colorTier: getColorTierLabel(colorAnalysis.colorPercentage),
            pricePerPage: 2 // Default Price
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

        // 🔥 RESTORED UI: Color Analysis Badge & Dropdown
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

clearBtn.onclick = () => { selectedFiles = []; updateUI(); };
cancelPaymentBtn.onclick = () => paymentSection.classList.remove('show');

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

verifyBtn.onclick = async () => {
    const trxId = trxIdInput.value.trim();

    if (!trxId) return showMessage('Please enter Transaction ID!', 'error');

    const originalBtnText = verifyBtn.innerHTML;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<div class="btn-spinner"></div> Verifying...`;

    try {
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

        verifyBtn.innerHTML = `<div class="btn-spinner"></div> Uploading...`;
        loading.classList.add('show');

        const formData = new FormData();
        const finalUserName = collectLaterInput.checked ? userNameInput.value.trim() : 'Unknown';
        const finalStudentId = collectLaterInput.checked ? studentIdInput.value.trim() : 'N/A';

        formData.append('userName', finalUserName);
        formData.append('studentId', finalStudentId);
        formData.append('location', printerLocation);
        formData.append('trxId', trxId);
        formData.append('totalCost', currentTotalCost);
        formData.append('collectLater', collectLaterInput.checked);

        selectedFiles.forEach(item => formData.append('files', item.file));
        const settings = selectedFiles.map(item => ({
            fileName: item.file.name,
            range: item.range,
            copies: item.copies,
            color: item.printMode, // Send 'bw' or 'color' correctly
            cost: item.calculatedCost || 0,
            pages: item.pageCount
        }));
        formData.append('fileSettings', JSON.stringify(settings));

        const uploadRes = await fetch(SERVER_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        loading.classList.remove('show');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;

        if (uploadRes.ok) {
            // 🔥 UPDATE: Success Message Duration increased to 30 seconds (30000ms)
            showMessage(`✅ Order Verified! প্রিন্টারে লাল আলো জ্বললে কাগজ লোড করে ব্লিঙ্ক করা বাটনটি চাপুন। অন্যথায় অপেক্ষা করুন। প্রয়োজনে WhatsApp করুন।`, 'success', 30000);

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

// 🔥 UPDATE: showMessage Function to support Custom Duration
function showMessage(t, type, customDuration) {
    messageDiv.innerHTML = t;
    messageDiv.className = 'toast show ' + type;

    // ডিফল্ট: এরর হলে ৮ সেকেন্ড, সাকসেস হলে ৪ সেকেন্ড। অথবা কাস্টম টাইম।
    let time = customDuration || (type === 'error' ? 8000 : 4000);

    setTimeout(() => messageDiv.className = 'toast', time);
}

toggleUserInfo();

// 🎨 RESTORED COLOR COVERAGE ANALYSIS FUNCTIONS
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
    if (colorPercentage < 40) return 3;       // Light Color: 0-40%
    if (colorPercentage < 70) return 4;       // Medium Color: 40-70%
    if (colorPercentage < 90) return 5;       // Heavy Color: 70-90%
    return 6;                                  // Full Color: >90%
}

function getColorTierLabel(percentage) {
    if (percentage < 40) return 'Light Color';
    if (percentage < 70) return 'Medium Color';
    if (percentage < 90) return 'Heavy Color';
    return 'Full Color';
}