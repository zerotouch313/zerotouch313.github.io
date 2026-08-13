/* =================================================== */
/* ZERO TOUCH STANDALONE PROMO MODAL SCRIPT (zt-promo.js) */
/* =================================================== */
(function () {
    console.log("[ZT Promo Standalone] Script loaded and executing...");

    // 1. Dynamic DOM Injection Function
    function injectModalHTML() {
        if (document.getElementById('ztPromoModal')) {
            console.log("[ZT Promo Standalone] Modal HTML already exists in DOM");
            return;
        }

        console.log("[ZT Promo Standalone] Dynamically creating modal HTML element...");
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
    <div id="ztPromoModal" class="zt-promo-overlay" aria-hidden="true">
        <div class="zt-promo-backdrop" id="ztPromoBackdrop"></div>
        <div class="zt-promo-card" role="dialog" aria-modal="true" aria-labelledby="ztPromoTitle">
            <button type="button" class="zt-promo-close-btn" id="ztPromoCloseBtn" aria-label="Close promo modal">
                <i class="ph ph-x"></i>
            </button>
            
            <div class="zt-promo-header">
                <div class="zt-promo-hero-graphic">
                    <div class="zt-promo-logo-badge">
                        <img src="assets/web_fav.png" alt="Zero Touch Logo" class="zt-promo-logo-img">
                    </div>
                    <div class="zt-promo-illustration">
                        <svg viewBox="0 0 160 110" fill="none" xmlns="http://www.w3.org/2000/svg" class="zt-promo-svg-illustration">
                            <!-- Mobile Phone -->
                            <rect x="52" y="10" width="56" height="90" rx="10" fill="#1E293B" stroke="#334155" stroke-width="2"/>
                            <rect x="57" y="18" width="46" height="74" rx="5" fill="#0F172A"/>
                            <!-- Phone Screen App UI Header -->
                            <rect x="62" y="24" width="36" height="12" rx="3" fill="#10B981" fill-opacity="0.2"/>
                            <rect x="65" y="28" width="20" height="4" rx="2" fill="#10B981"/>
                            <!-- Document emerging from phone -->
                            <g class="zt-svg-doc-group">
                                <rect x="61" y="42" width="38" height="44" rx="4" fill="#FFFFFF"/>
                                <rect x="66" y="48" width="20" height="3" rx="1.5" fill="#10B981"/>
                                <rect x="66" y="55" width="28" height="2.5" rx="1.2" fill="#94A3B8"/>
                                <rect x="66" y="61" width="24" height="2.5" rx="1.2" fill="#94A3B8"/>
                                <rect x="66" y="67" width="28" height="2.5" rx="1.2" fill="#94A3B8"/>
                                <circle cx="83" cy="76" r="4" fill="#10B981"/>
                                <path d="M81.5 76L82.5 77L84.5 75" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <!-- Wireless printing signal waves -->
                            <path d="M38 35C33 40 33 50 38 55" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
                            <path d="M44 40C41 43 41 47 44 50" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"/>
                            <path d="M122 35C127 40 127 50 122 55" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
                            <path d="M116 40C119 43 119 47 116 50" stroke="#10B981" stroke-width="2.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="zt-promo-body">
                <h2 id="ztPromoTitle" class="zt-promo-title">Welcome to the Zero Touch App!</h2>
                
                <div class="zt-promo-benefits-wrapper">
                    <ul class="zt-promo-benefits">
                        <li>Exclusive offers & discounts</li>
                        <li>Hassle-free, 1-click fast printing</li>
                        <li>No hassle of repeated payments with Smart Wallet integration</li>
                    </ul>
                </div>

                <a href="https://play.google.com/store/apps/details?id=com.zerotouch.threeonethree" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   class="zt-promo-cta-btn" 
                   id="ztPromoCtaBtn">
                    <div class="zt-promo-cta-badge-content">
                        <svg class="zt-promo-play-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3.60938 1.81445C3.21338 2.18945 3 2.70345 3 3.33845V20.6615C3 21.2965 3.21338 21.8105 3.60938 22.1855L3.69338 22.2595L13.3444 12.6085V12.3915L3.69338 2.7405L3.60938 1.81445Z" fill="#00D2FF"/>
                            <path d="M16.5623 15.827L13.3442 12.609V12.391L16.5623 9.17305L16.6463 9.22205L20.4573 11.389C21.5433 12.006 21.5433 13.014 20.4573 13.631L16.6463 15.778L16.5623 15.827Z" fill="#FFD900"/>
                            <path d="M16.6462 15.7785L13.3442 12.4765L3.60938 22.1855C3.96638 22.5635 4.57138 22.6185 5.25338 22.2315L16.6462 15.7785Z" fill="#FF3A44"/>
                            <path d="M16.6462 9.22152L5.25338 2.76852C4.57138 2.38152 3.96638 2.43652 3.60938 2.81452L13.3442 12.5235L16.6462 9.22152Z" fill="#00E676"/>
                        </svg>
                        <div class="zt-promo-cta-text">
                            <span class="zt-promo-cta-sub">GET IT ON GOOGLE PLAY</span>
                            <span class="zt-promo-cta-main">Download App Now</span>
                        </div>
                    </div>
                </a>
            </div>
        </div>
    </div>
        `.trim();

        const modalElement = wrapper.firstElementChild;
        if (document.body) {
            document.body.appendChild(modalElement);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(modalElement);
            });
        }
    }

    // Execute dynamic injection immediately
    injectModalHTML();

    // 2. Setup Logic & Event Handlers
    function initLogic() {
        const promoOverlay = document.getElementById('ztPromoModal');
        const promoCloseBtn = document.getElementById('ztPromoCloseBtn');
        const promoBackdrop = document.getElementById('ztPromoBackdrop');
        const promoCtaBtn = document.getElementById('ztPromoCtaBtn');

        if (!promoOverlay) return;

        function openPromoModal() {
            console.log("[ZT Promo Standalone] Displaying modal now");
            promoOverlay.classList.remove('closing');
            promoOverlay.classList.add('active');
            promoOverlay.setAttribute('aria-hidden', 'false');
            if (document.body) {
                document.body.classList.add('zt-promo-open');
            }
        }

        function closePromoModal() {
            console.log("[ZT Promo Standalone] Closing modal");
            promoOverlay.classList.add('closing');
            promoOverlay.classList.remove('active');
            promoOverlay.setAttribute('aria-hidden', 'true');
            if (document.body) {
                document.body.classList.remove('zt-promo-open');
            }

            setTimeout(() => {
                promoOverlay.classList.remove('closing');
            }, 300);
        }

        if (promoCloseBtn) promoCloseBtn.addEventListener('click', closePromoModal);
        if (promoBackdrop) promoBackdrop.addEventListener('click', closePromoModal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && promoOverlay.classList.contains('active')) {
                closePromoModal();
            }
        });

        if (promoCtaBtn) {
            promoCtaBtn.addEventListener('click', () => {
                setTimeout(closePromoModal, 400);
            });
        }

        // Direct 1-second timeout (no event listener dependency)
        console.log("[ZT Promo Standalone] Starting 1000ms timer...");
        setTimeout(openPromoModal, 1000);
    }

    initLogic();
})();
