let currentStatus = 'false';
let selectedPhotos = new Set();
let adminToken = localStorage.getItem('admin_token');

document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        document.getElementById('loginOverlay').style.display = 'none';
        loadStats();
        loadCategories();
        loadPhotos('false');
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
    }
});

async function loadCategories() {
    try {
        const res = await fetchAuth('/api/admin/categories');
        if (handleAuthError(res)) return;
        const categories = await res.json();
        const select = document.getElementById('categoryFilter');
        const currentVal = select.value;
        select.innerHTML = '<option value="">All Categories</option>';
        categories.sort().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            if (cat === currentVal) opt.selected = true;
            select.appendChild(opt);
        });
    } catch(e) { console.error('Failed to load categories', e); }
}

async function login() {
    const pw = document.getElementById('adminPassword').value;
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const data = await res.json();
        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('admin_token', adminToken);
            document.getElementById('loginOverlay').style.display = 'none';
            loadStats();
            loadCategories();
            loadPhotos('false');
        } else {
            alert('Invalid password');
        }
    } catch(e) {
        alert('Login error');
    }
}

function handleAuthError(res) {
    if (res.status === 401) {
        localStorage.removeItem('admin_token');
        adminToken = null;
        document.getElementById('loginOverlay').style.display = 'flex';
        return true;
    }
    return false;
}

// Wrapper for auth fetches
async function fetchAuth(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (adminToken) options.headers['Authorization'] = `Bearer ${adminToken}`;
    return fetch(url, options);
}

function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = `${selectedPhotos.size} selected`;
}

function toggleSelect(id) {
    if (selectedPhotos.has(id)) {
        selectedPhotos.delete(id);
    } else {
        selectedPhotos.add(id);
    }
    updateSelectedCount();
}

function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.photo-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        if (checkbox.checked) {
            selectedPhotos.add(cb.value);
        } else {
            selectedPhotos.delete(cb.value);
        }
    });
    updateSelectedCount();
}

async function loadStats() {
    try {
        const res = await fetchAuth('/api/admin/stats');
        if (handleAuthError(res)) return;
        const data = await res.json();
        document.getElementById('pendingCount').textContent = data.pending || 0;
        document.getElementById('verifiedCount').textContent = data.verified || 0;
    } catch(e) {
        console.error("Failed to load stats", e);
    }
}

async function loadPhotos(status) {
    currentStatus = status;
    updateTabs(status);
    
    selectedPhotos.clear();
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if(selectAllCheckbox) selectAllCheckbox.checked = false;
    updateSelectedCount();

    const grid = document.getElementById('adminGrid');
    const loading = document.getElementById('loading');
    
    grid.innerHTML = '';
    loading.classList.remove('hidden');

    try {
        const catFilter = document.getElementById('categoryFilter').value;
        let queryParams = [];
        if (status !== '') queryParams.push(`verified=${status}`);
        if (catFilter) queryParams.push(`category=${encodeURIComponent(catFilter)}`);
        const queryStr = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const res = await fetchAuth(`/api/admin/photos${queryStr}`);
        if (handleAuthError(res)) return;
        const data = await res.json();
        
        loading.classList.add('hidden');

        if (!data.photos || data.photos.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500">No photos found.</div>`;
            return;
        }

        data.photos.forEach(photo => {
            const card = document.createElement('div');
            card.className = "card glass-panel rounded-xl overflow-hidden flex flex-col relative";
            card.innerHTML = `
                <div class="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur rounded p-1">
                    <input type="checkbox" value="${photo.id}" onchange="toggleSelect('${photo.id}')" class="photo-checkbox w-5 h-5 cursor-pointer rounded border-gray-600">
                </div>
                <div class="relative w-full pb-[100%] overflow-hidden bg-gray-900 group">
                    <img src="${photo.urls.thumb || photo.urls.small}" class="absolute top-0 left-0 w-full h-full object-cover" loading="lazy">
                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                        <a href="${photo.urls.regular}" target="_blank" class="bg-white/20 hover:bg-white/40 text-white rounded-full p-3 backdrop-blur-sm transition">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                    </div>
                    ${photo.verified ? 
                        '<span class="absolute top-2 right-2 bg-green-500/90 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur">Live</span>' : 
                        '<span class="absolute top-2 right-2 bg-yellow-500/90 text-white text-xs font-bold px-2 py-1 rounded-md backdrop-blur">Pending</span>'
                    }
                </div>
                <div class="p-4 flex-1 flex flex-col gap-2">
                    <div class="flex justify-between items-center gap-2">
                        <span class="text-xs text-gray-400">Category:</span>
                        <div class="flex-1 flex bg-black/50 overflow-hidden rounded border border-gray-700 focus-within:border-blue-500">
                            <input type="text" id="cat-${photo.id}" value="${photo.category || ''}" class="bg-transparent border-none text-xs text-white px-2 py-1 w-full focus:outline-none">
                            <button onclick="updateSingleCategory('${photo.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 text-xs font-medium transition">Set</button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-1 mt-auto">
                        ${photo.tags ? photo.tags.slice(0, 3).map(t => `<span class="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs text-gray-400">#${t}</span>`).join('') : ''}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-800">
                        ${photo.verified ? 
                            `<button onclick="unverifyPhoto('${photo.id}')" class="bg-gray-800 hover:bg-gray-700 text-gray-300 py-1.5 rounded-lg text-sm font-medium transition">Mark Pending</button>` : 
                            `<button onclick="verifyPhoto('${photo.id}')" class="bg-green-600/20 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/30 py-1.5 rounded-lg text-sm font-medium transition">Approve</button>`
                        }
                        <button onclick="deletePhoto('${photo.id}')" class="bg-red-900/20 border border-red-800/30 hover:bg-red-600 hover:text-white text-red-400 py-1.5 rounded-lg text-sm font-medium transition">Delete</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch(e) {
        loading.classList.add('hidden');
        console.error(e);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-500">Failed to load photos.</div>`;
    }
}

function updateTabs(activeStatus) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = "tab-btn px-4 py-2 rounded-lg font-medium text-sm text-gray-400 hover:bg-gray-800 transition-colors";
    });
    
    let activeId = 'tab-all';
    let colorClass = 'bg-gray-800 text-white';
    
    if (activeStatus === 'false') {
        activeId = 'tab-pending';
        colorClass = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30';
    }
    if (activeStatus === 'true') {
        activeId = 'tab-verified';
        colorClass = 'bg-green-500/20 text-green-500 border border-green-500/30';
    }
    
    const activeBtn = document.getElementById(activeId);
    if(activeBtn) {
        activeBtn.className = `tab-btn px-4 py-2 rounded-lg font-medium text-sm ${colorClass}`;
    }
}

async function verifyPhoto(id) {
    try {
        const res = await fetchAuth(`/api/admin/photo/${id}/verify`, { method: 'PUT' });
        if(res.ok) { loadStats(); loadPhotos(currentStatus); }
    } catch(e) { console.error(e); }
}

async function unverifyPhoto(id) {
    try {
        const res = await fetchAuth(`/api/admin/photo/${id}/unverify`, { method: 'PUT' });
        if(res.ok) { loadStats(); loadPhotos(currentStatus); }
    } catch(e) { console.error(e); }
}

async function deletePhoto(id) {
    if (!confirm('Are you sure you want to permanently delete this photo?')) return;
    try {
        const res = await fetchAuth(`/api/admin/photo/${id}`, { method: 'DELETE' });
        if(res.ok) { loadStats(); loadPhotos(currentStatus); }
    } catch(e) { console.error(e); }
}

async function updateSingleCategory(id) {
    const input = document.getElementById(`cat-${id}`);
    const newCat = input.value.trim();
    if (!newCat) return;
    try {
        const res = await fetchAuth(`/api/admin/photo/${id}/category`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: newCat })
        });
        if (res.ok) {
            input.style.borderColor = '#10b981';
            setTimeout(() => input.style.borderColor = '', 1000);
            loadCategories();
        }
    } catch(e) { console.error(e); }
}

// Bulk Actions
async function applyBulkCategory() {
    if (selectedPhotos.size === 0) return alert('No photos selected');
    const newCat = document.getElementById('bulkCategoryInput').value.trim();
    if (!newCat) return alert('Enter a new category name');
    
    try {
        const res = await fetchAuth(`/api/admin/photos/bulk-category`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedPhotos), category: newCat })
        });
        if (res.ok) {
            document.getElementById('bulkCategoryInput').value = '';
            loadCategories();
            loadPhotos(currentStatus);
        }
    } catch(e) { console.error(e); }
}

async function applyBulkVerify() {
    if (selectedPhotos.size === 0) return alert('No photos selected');
    try {
        const res = await fetchAuth(`/api/admin/photos/bulk-verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedPhotos) })
        });
        if (res.ok) { loadStats(); loadPhotos(currentStatus); }
    } catch(e) { console.error(e); }
}

async function applyBulkDelete() {
    if (selectedPhotos.size === 0) return alert('No photos selected');
    if (!confirm(`Are you sure you want to delete ${selectedPhotos.size} photos?`)) return;
    
    try {
        const res = await fetchAuth(`/api/admin/photos/bulk-delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedPhotos) })
        });
        if (res.ok) { loadStats(); loadPhotos(currentStatus); }
    } catch(e) { console.error(e); }
}

async function fetchNewPhotos() {
    const query = document.getElementById('fetchQuery').value.trim();
    if (!query) {
        alert("Please enter a search query to fetch photos (e.g. 'cars')");
        return;
    }
    
    const fetchBtn = document.getElementById('fetchBtn');
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';
    
    try {
        const res = await fetchAuth(`/api/admin/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, count: 20 })
        });
        if (handleAuthError(res)) return;
        
        const data = await res.json();
        if (data.success) {
            alert(`Successfully fetched ${data.totalFetched} and added ${data.count} new unique photos to pending list.`);
            document.getElementById('fetchQuery').value = '';
            loadStats();
            loadCategories();
            loadPhotos('false');
        } else {
            alert("Failed to fetch.");
        }
    } catch (e) {
        console.error(e);
        alert("Error fetching photos");
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch';
    }
}
