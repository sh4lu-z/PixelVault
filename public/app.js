let currentPhotos = [];
let currentIndex = -1;
let currentPage = 1;
let currentQuery = '';
let isLive = false;
let isLoading = false;
let stats = null;

let currentOrientation = 'all';

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
    grid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="loadCategory('${cat.name}')">
            <div class="cat-images">
                ${cat.sample.map(img => `<img src="${img}" alt="">`).join('')}
            </div>
            <div class="cat-info">
                <h3>${cat.name}</h3>
                <p>${cat.count} Photos</p>
            </div>
        </div>
    `).join('');
}

function renderQuickTags(categories) {
    const container = document.getElementById('quickTags');
    const customTags = [
        'Dark', 'Neon', 'Cars', 'Misty mountains', 'Mountains & nature', 'Majestic waterfalls'
    ];
    const tags = customTags.map(tagName => `
        <button class="quick-tag" onclick="doSearch('${tagName}')">${tagName}</button>
    `).join('');
    container.innerHTML = '<span class="tag-label">Popular:</span>' + tags;
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

async function doSearch(query) {
    const q = query || document.getElementById('heroSearch').value;
    if (!q) return;
    
    currentQuery = q;
    currentPage = 1;
    showPage('explore');
    document.getElementById('exploreSearch').value = q;
    performSearch();
}

async function doExploreSearch() {
    const q = document.getElementById('exploreSearch').value;
    if (!q) return;
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

async function downloadPhoto(quality) {
    const photo = currentPhotos[currentIndex];
    const url = photo.urls[quality];
    
    // Naming convention: PixelVault_[Collection]_[ID]_[Quality].jpg
    const category = photo._category || 'Gallery';
    const filename = `PixelVault_${category}_${photo.id}_${quality}.jpg`;
    
    showToast('Downloading...');
    
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(url, '_blank');
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
}
