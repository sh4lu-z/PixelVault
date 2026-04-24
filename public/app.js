if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW Registered!', registration.scope))
      .catch(err => console.log('SW Registration Failed!', err));
  });
}






let currentPhotos = [];
let currentIndex = -1;
let currentPage = 1;
let currentQuery = '';
let isLive = false;
let isLoading = false;
let stats = null;

let currentOrientation = 'all';
let isAgeVerified = false;
let pendingAdultQuery = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchCategories();
    loadRandomGrid();
    
    // Search listeners
    document.getElementById('heroSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSearch();
    });
    
    document.getElementById('exploreSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doExploreSearch();
    });
    
    // Live toggle listeners
    const liveToggles = [document.getElementById('liveToggle'), document.getElementById('exploreLiveToggle')];
    liveToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            isLive = !isLive;
            liveToggles.forEach(b => b.classList.toggle('active', isLive));
            showToast(isLive ? 'Live Fetch Enabled' : 'Live Fetch Disabled');
        });
    });

    // Auto-hide note banner
    const noteBanner = document.getElementById('loaderNote');
    if (noteBanner) {
        setTimeout(() => {
            noteBanner.style.display = 'none';
        }, 4000); // 4 seconds
    }
});

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        stats = await res.json();
        document.getElementById('totalPhotosLabel').innerText = `${stats.totalPhotos.toLocaleString()} Photos Available`;
    } catch (e) { console.error(e); }
}

async function fetchCategories() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        const res = await fetch('/api/categories', { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const categories = await res.json();
        renderCategories(categories);
        renderQuickTags(categories);
        renderCategoryTicker(categories);
    } catch (e) {
        console.error('Categories fetch error:', e);
        if (e.name === 'AbortError') {
            showToast('Categories took too long to load. Try again.');
        } else {
            showToast('Could not load categories.');
        }
    }
}

function renderCategories(categories) {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = categories.map(cat => {
        const isAdult = cat.name.toLowerCase() === 'sexy girls';
        const blurStyle = isAdult && !isAgeVerified ? 'filter: blur(15px);' : '';
        const blurOverlay = isAdult && !isAgeVerified ? '<div class="adult-overlay" style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5); border-radius:12px; z-index:1;"><span style="color:#ef4444; font-weight:bold; font-size:1.2rem;">18+</span></div>' : '';
        
        return `
        <div class="category-card" onclick="loadCategory('${cat.name.replace(/'/g,"\\'")}')" style="position:relative;">
            <div class="cat-images" style="${blurStyle}">
                ${cat.sample.map(img => `<img src="${img}" alt="">`).join('')}
            </div>
            ${blurOverlay}
            <div class="cat-info" style="position:relative; z-index:2;">
                <h3>${cat.name}</h3>
                <p>${cat.count} Photos</p>
            </div>
        </div>
    `}).join('');
}

function renderQuickTags(categories) {
    // Kept for compatibility — no-op, ticker handles it now
}

function renderCategoryTicker(categories) {
    const track = document.getElementById('tickerTrack');
    const ticker = document.getElementById('categoryTicker');
    if (!track || !categories.length) return;

    // Filter out sexy girls from the ticker
    const safeCategories = categories.filter(cat => cat.name.toLowerCase() !== 'sexy girls');

    const itemsHTML = safeCategories.map(cat =>
        `<button class="ticker-tag" onclick="doSearch('${cat.name.replace(/'/g,"\\'")}')"> ${cat.name}</button>`
    ).join('');

    // Triple to ensure there's enough content to scroll endlessly seamlessly
    track.innerHTML = itemsHTML + itemsHTML + itemsHTML;

    // Reset styles
    track.style.animation = 'none';

    let rAF;
    let isUserEngaged = false;
    let resumeTimer = null;
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let scrollLeft = 0;

    function getSetWidth() {
        if (!track.children.length) return 1;
        // The width of one complete set of original items is the offset of the element starting the next set
        const n = categories.length;
        if (track.children.length > n && track.children[n]) {
            return track.children[n].offsetLeft - track.children[0].offsetLeft;
        }
        return 1; // fallback
    }

    function loop() {
        if (!isUserEngaged) {
            ticker.scrollLeft += 0.5; // smoother slow speed 
        }

        const setWidth = getSetWidth();
        if (setWidth > 1) {
            // Jump smoothly when scrolled past one set
            if (ticker.scrollLeft >= setWidth * 2) {
                ticker.scrollLeft -= setWidth;
            } else if (ticker.scrollLeft <= 0) {
                ticker.scrollLeft += setWidth;
            }
        }
        rAF = requestAnimationFrame(loop);
    }

    if (window._tickerRaf) cancelAnimationFrame(window._tickerRaf);
    window._tickerRaf = requestAnimationFrame(loop);

    function resetResumeTimer() {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => { isUserEngaged = false; }, 2500);
    }

    // Desktop Drag handling
    ticker.addEventListener('mousedown', (e) => {
        isUserEngaged = true;
        isDragging = true;
        hasDragged = false;
        startX = e.pageX - ticker.getBoundingClientRect().left;
        scrollLeft = ticker.scrollLeft;
        clearTimeout(resumeTimer);
        ticker.style.cursor = 'grabbing';
        ticker.style.userSelect = 'none';
        
        // Prevent default on mousedown to prevent text/image selection dragging
        e.preventDefault(); 
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - ticker.getBoundingClientRect().left;
        const delta = x - startX;
        if (Math.abs(delta) > 4) hasDragged = true;
        
        // Manual move
        ticker.scrollLeft = scrollLeft - delta;

        // Boundaries while drag
        const setWidth = getSetWidth();
        if (ticker.scrollLeft >= setWidth * 2) {
             ticker.scrollLeft -= setWidth;
             startX -= setWidth;
             scrollLeft -= setWidth;
        } else if (ticker.scrollLeft <= 0) {
             ticker.scrollLeft += setWidth;
             startX += setWidth;
             scrollLeft += setWidth;
        }
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        ticker.style.cursor = 'grab';
        ticker.style.userSelect = '';
        resetResumeTimer();
    });

    // Stop child click when dragging
    ticker.addEventListener('click', (e) => {
        if (hasDragged) {
            e.preventDefault();
            e.stopImmediatePropagation();
            hasDragged = false;
        }
    }, true);

    // Mobile / Touch handling (using native scroll + JS checking)
    ticker.addEventListener('touchstart', () => {
        isUserEngaged = true;
        clearTimeout(resumeTimer);
    }, { passive: true });

    // Ensure infinite bounds check natively on mobile swipe bounds
    ticker.addEventListener('scroll', () => {
        if (isUserEngaged) {
           const setWidth = getSetWidth();
           if (setWidth > 1) {
               if (ticker.scrollLeft >= setWidth * 2) {
                    ticker.scrollLeft -= setWidth;
               } else if (ticker.scrollLeft <= 0) {
                    ticker.scrollLeft += setWidth;
               }
           }
           resetResumeTimer();
        }
    }, { passive: true });

    ticker.addEventListener('touchend', () => {
        resetResumeTimer();
    });
}

async function loadRandomGrid() {
    const grid = document.getElementById('heroGrid');
    try {
        const res = await fetch('/api/random?count=12');
        const data = await res.json();
        window.heroPhotos = data.photos;
        grid.innerHTML = data.photos.map((p, idx) => `
            <div class="grid-item" style="cursor: pointer;" onclick="openHeroLightbox(${idx})">
                <img src="${p.urls.small}" alt="">
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

function openHeroLightbox(index) {
    currentPhotos = window.heroPhotos;
    openLightbox(index);
}

// =================== AGE VERIFICATION ===================
const adultPattern = /\b(sex|xxx|sexy|nude|porn)\b/i;

function checkAdultSearch(query, callback) {
    if (adultPattern.test(query) && !isAgeVerified) {
        pendingAdultQuery = callback;
        document.getElementById('ageModal').style.display = 'flex';
        return true; // Indicates adult check is pending
    }
    return false; // Safe or already verified
}

window.confirmAge = function(isOver18) {
    document.getElementById('ageModal').style.display = 'none';
    if (isOver18) {
        isAgeVerified = true;
        // Unblur elements in UI
        document.querySelectorAll('.cat-images').forEach(el => {
            el.style.filter = '';
        });
        document.querySelectorAll('.adult-overlay').forEach(el => {
            el.style.display = 'none';
        });
        
        if (pendingAdultQuery) {
            const cb = pendingAdultQuery;
            pendingAdultQuery = null;
            cb();
        }
    } else {
        pendingAdultQuery = null;
        document.getElementById('heroSearch').value = '';
        document.getElementById('exploreSearch').value = '';
        showPage('home');
    }
};

async function doSearch(query) {
    const q = query || document.getElementById('heroSearch').value;
    if (!q) return;
    
    if (checkAdultSearch(q, () => doSearch(q))) return;
    
    currentQuery = q;
    currentPage = 1;
    showPage('explore');
    document.getElementById('exploreSearch').value = q;
    performSearch();
}

async function doExploreSearch() {
    const q = document.getElementById('exploreSearch').value;
    if (!q) return;
    
    if (checkAdultSearch(q, () => doExploreSearch())) return;
    
    currentQuery = q;
    currentPage = 1;
    performSearch();
}

async function performSearch(append = false) {
    if (isLoading) return;
    isLoading = true;
    
    const grid = document.getElementById('mainGrid');
    const spinner = document.getElementById('mainSpinner');
    
    if (!append) {
        grid.innerHTML = '';
        spinner.style.display = 'flex';
    }
    
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage}&live=${isLive}&orientation=${currentOrientation}`);
        const data = await res.json();
        
        if (data.photos.length === 0 && !append) {
            grid.innerHTML = `<div class="no-results">No photos found for "${currentQuery}". Try turning on <b>Live</b> mode!</div>`;
            document.getElementById('loadMoreWrap').style.display = 'none';
        } else {
            if (data.newPhotosAdded > 0) {
                showToast(`Found ${data.newPhotosAdded} new photos!`);
                fetchStats();
            }
            
            if (!append) {
                currentPhotos = data.photos;
            } else {
                currentPhotos = [...currentPhotos, ...data.photos];
            }
            
            renderPhotos(data.photos, append);
            
            // Show load more if we have results. Since we fetch 30 per page, 
            // if we get less than 30 and it's NOT a live search, maybe we can fetch live.
            // But for now, let's keep it simple: always show load more unless it's empty.
            document.getElementById('loadMoreWrap').style.display = data.photos.length >= 20 ? 'flex' : 'none';
        }
        
        document.getElementById('exploreMeta').innerText = `Results for "${currentQuery}"`;
        
    } catch (e) {
        console.error(e);
        showToast('Search failed');
    } finally {
        isLoading = false;
        spinner.style.display = 'none';
    }
}

async function loadCategory(catName) {
    if (checkAdultSearch(catName, () => loadCategory(catName))) return;

    currentQuery = catName;
    currentPage = 1;
    showPage('explore');
    document.getElementById('exploreSearch').value = catName;
    
    const grid = document.getElementById('mainGrid');
    grid.innerHTML = '';
    document.getElementById('mainSpinner').style.display = 'flex';
    
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(catName)}&page=1&live=false&orientation=${currentOrientation}`);
        const data = await res.json();
        currentPhotos = data.photos;
        renderPhotos(data.photos, false);
        document.getElementById('exploreMeta').innerText = `${data.total} photos in ${catName}`;
        document.getElementById('loadMoreWrap').style.display = data.page < data.totalPages ? 'flex' : 'none';
    } catch (e) { console.error(e); }
    finally { document.getElementById('mainSpinner').style.display = 'none'; }
}

function setOrientation(type, btnElem) {
    currentOrientation = type;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElem.classList.add('active');
    
    if (currentQuery) {
        currentPage = 1;
        performSearch();
    }
}

function renderPhotos(photos, append) {
    const grid = document.getElementById('mainGrid');
    const html = photos.map((p, idx) => {
        const actualIdx = append ? currentPhotos.length - photos.length + idx : idx;
        return `
            <div class="gallery-item" onclick="openLightbox(${actualIdx})">
                <img src="${p.urls.small}" loading="lazy" alt="${p.description || ''}">
                <div class="item-overlay">
                    <p class="item-desc">${p.description || 'View Photo'}</p>
                    <p class="item-user">by ${p.user.name}</p>
                </div>
            </div>
        `;
    }).join('');
    
    if (append) grid.innerHTML += html;
    else grid.innerHTML = html;
}

function loadMore() {
    currentPage++;
    performSearch(true);
}

// UI Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    document.getElementById('homeBtn').classList.toggle('active', pageId === 'home');
    document.getElementById('exploreBtn').classList.toggle('active', pageId === 'explore');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Help Modal Logic
function openHelp() {
    document.getElementById('helpModal').style.display = 'flex';
}
function closeHelp() {
    document.getElementById('helpModal').style.display = 'none';
}
function switchHelpTab(lang, btn) {
    document.querySelectorAll('.help-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.help-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`help-${lang}`).classList.add('active');
}

// Lightbox Logic
function openLightbox(index) {
    currentIndex = index;
    const photo = currentPhotos[index];
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    const loader = document.getElementById('lightboxLoader');
    
    // Reset state
    loader.style.display = 'flex';
    img.style.opacity = '0.3'; // Show thumb with low opacity first
    
    // 1. Show thumbnail immediately for instant preview
    img.src = photo.urls.thumb;
    
    // 2. Create a temporary image object to preload the 'regular' version
    const highRes = new Image();
    highRes.src = photo.urls.regular;
    
    highRes.onload = () => {
        img.src = photo.urls.regular;
        img.style.opacity = '1';
        loader.style.display = 'none';
    };

    // Fallback if onload takes too long or fails
    setTimeout(() => {
        if (loader.style.display !== 'none') {
            img.style.opacity = '1';
            loader.style.display = 'none';
        }
    }, 5000);
    
    document.getElementById('lbAvatar').src = photo.user.profile_image.medium;
    document.getElementById('lbName').innerText = photo.user.name;
    document.getElementById('lbUsername').innerText = `@${photo.user.username}`;
    document.getElementById('lbDesc').innerText = photo.description || 'No description provided';
    
    // Additional Photo & User Metadata from JSON
    const locationStr = photo.user.location ? `<div class="lb-meta-location">📍 ${photo.user.location}</div>` : '';
    const bioStr = photo.user.bio ? `<div class="lb-meta-bio">${photo.user.bio}</div>` : '';
    
    document.getElementById('lbExtra').innerHTML = locationStr + bioStr;

    document.getElementById('lbSize').innerText = `${photo.width} x ${photo.height}`;
    document.getElementById('lbColorDot').style.background = photo.color;
    document.getElementById('lbCounter').innerText = `${index + 1} / ${currentPhotos.length}`;
    
    document.getElementById('lbTags').innerHTML = (photo.tags || []).map(t => `<span class="lb-tag">${t}</span>`).join('');
    
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function navigateLightbox(dir) {
    currentIndex += dir;
    if (currentIndex < 0) currentIndex = currentPhotos.length - 1;
    if (currentIndex >= currentPhotos.length) currentIndex = 0;
    openLightbox(currentIndex);
}

async function downloadPhoto(quality, btnElement) {
    const photo = currentPhotos[currentIndex];
    const url = photo.urls[quality];
    
    // Naming convention: PixelVault_[Collection]_[ID]_[Quality].jpg
    const category = photo._category || 'Gallery';
    const filename = `PixelVault_${category}_${photo.id}_${quality}.jpg`;
    
    const originalHTML = btnElement ? btnElement.innerHTML : '';
    
    showToast('Downloading...');
    
    if (btnElement) {
        btnElement.innerHTML = `<svg class="animate-spin" style="width:18px; height:18px; animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg> Downloading...`;
        btnElement.disabled = true;
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        
        showToast('Download Complete!');
    } catch (e) {
        console.error(e);
        showToast('Download Failed!');
        window.open(url, '_blank');
    } finally {
        if (btnElement) {
            btnElement.innerHTML = originalHTML;
            btnElement.disabled = false;
        }
    }
}




function showToast(msg, actionLabel = null, actionCallback = null) {
    const toast = document.getElementById('toast');
    
    let html = `<span>${msg}</span>`;
    if (actionLabel && actionCallback) {
        html += `<button class="toast-btn" id="toastAction">${actionLabel}</button>`;
    }
    
    toast.innerHTML = html;
    
    if (actionLabel && actionCallback) {
        document.getElementById('toastAction').onclick = (e) => {
            e.stopPropagation();
            actionCallback();
            toast.classList.remove('active');
        };
    }
    
    toast.classList.add('active');
    
    // Clear any existing timeout
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    
    // Set auto-hide timeout (longer if there's an action)
    const duration = actionLabel ? 6000 : 3000;
    window._toastTimeout = setTimeout(() => {
        toast.classList.remove('active');
    }, duration);
}






let deferredPrompt;
const pwaBanner = document.getElementById('pwa-install-banner');
const installBtn = document.getElementById('pwa-install-btn');
const closeBtn = document.getElementById('pwa-close-btn');

// 1. Browser එකෙන් ඇප් එක ඉන්ස්ටෝල් කරන්න පුළුවන් කියලා කියද්දී මේක වැඩ කරනවා
window.addEventListener('beforeinstallprompt', (e) => {
    // Default popup එක එන එක නවත්තනවා
    e.preventDefault();
    
    // Event එක save කරගන්නවා පස්සේ බට්න් එක එබුවම පාවිච්චි කරන්න
    deferredPrompt = e;
    
    // යූසර් සයිට් එකට ඇවිත් තත්පර 2කට පස්සේ බැනර් එක උඩට එන්න හදනවා 
    // (එකපාරටම එනවට වඩා මේක Professional)
    setTimeout(() => {
        pwaBanner.classList.add('show');
    }, 2000);
});

// 2. Download බට්න් එක එබුවම
installBtn.addEventListener('click', async () => {
    // අපේ බැනර් එක හංගනවා
    pwaBanner.classList.remove('show');
    
    if (deferredPrompt) {
        // ඔරිජිනල් Install popup එක පෙන්නනවා
        deferredPrompt.prompt();
        
        // යූසර් Install කරාද නැද්ද කියලා බලනවා
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        // ආයේ පාවිච්චි කරන්න බැරි වෙන්න එක Clear කරනවා
        deferredPrompt = null;
    }
});

// 3. Close (X) බට්න් එක එබුවම බැනර් එක අයින් කරනවා
closeBtn.addEventListener('click', () => {
    pwaBanner.classList.remove('show');
});
