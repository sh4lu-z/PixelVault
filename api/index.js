require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MongoDB Connection =====
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ===== Schema & Model =====
const PhotoSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    urls: Object,
    user: Object,
    description: String,
    color: String,
    width: Number,
    height: Number,
    exif: Object,
    tags: [String],
    category: String,
    createdAt: { type: Date, default: Date.now }
});

const Photo = mongoose.model('Photo', PhotoSchema);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== Config =====
const UNSPLASH_KEYS = (process.env.UNSPLASH_KEYS || "").split(',');
let currentKeyIndex = 0;

async function fetchUnsplash(query, page = 1, perPage = 30) {
    for (let attempt = 0; attempt < UNSPLASH_KEYS.length; attempt++) {
        try {
            const res = await axios.get('https://api.unsplash.com/search/photos', {
                params: { query, page, per_page: perPage },
                headers: { Authorization: `Client-ID ${UNSPLASH_KEYS[currentKeyIndex]}` }
            });
            return res.data;
        } catch (err) {
            if (err.response && (err.response.status === 403 || err.response.status === 429)) {
                currentKeyIndex = (currentKeyIndex + 1) % UNSPLASH_KEYS.length;
            } else {
                throw err;
            }
        }
    }
    return null;
}

function mapPhoto(photo, category) {
    return {
        id: photo.id,
        urls: photo.urls,
        user: photo.user,
        description: photo.alt_description || photo.description,
        color: photo.color,
        width: photo.width,
        height: photo.height,
        exif: photo.exif,
        tags: photo.tags ? photo.tags.map(t => t.title) : [],
        category: category
    };
}

// ===== API ROUTES =====

app.get('/api/search', async (req, res) => {
    const query = (req.query.q || '').toLowerCase().trim();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const fetchLive = req.query.live === 'true';

    if (!query) return res.json({ photos: [], total: 0 });

    // 1. Search in MongoDB
    const regex = new RegExp(query, 'i');
    let localPhotos = await Photo.find({
        $or: [
            { category: regex },
            { description: regex },
            { tags: regex }
        ]
    }).limit(100); // Take a good chunk to deduplicate

    // 2. Fetch Live if needed
    let livePhotos = [];
    let newPhotosAdded = 0;

    if (fetchLive || localPhotos.length === 0) {
        try {
            const apiData = await fetchUnsplash(query, page, 30);
            if (apiData && apiData.results) {
                livePhotos = apiData.results.map(p => mapPhoto(p, query));
                
                // Save to MongoDB asynchronously
                for (const p of livePhotos) {
                    try {
                        const exists = await Photo.findOne({ id: p.id });
                        if (!exists) {
                            await Photo.create(p);
                            newPhotosAdded++;
                        }
                    } catch (e) {}
                }
            }
        } catch (err) {
            console.error('API Error:', err.message);
        }
    }

    // Combine and Deduplicate
    const all = [...localPhotos, ...livePhotos];
    const seen = new Set();
    const unique = all.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
    });

    const total = unique.length;
    const start = (page - 1) * limit;
    const paginated = unique.slice(start, start + limit);

    res.json({
        photos: paginated,
        total: total > 30 ? total : 30, // Mock total for pagination if needed
        page,
        totalPages: 10, // Mock pages for infinite scrolling
        newPhotosAdded
    });
});

app.get('/api/categories', async (req, res) => {
    try {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(504).json({ error: 'Request timeout' });
            }
        }, 12000);
        
        const cats = await Photo.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 }, sample: { $push: "$urls.small" } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
            { $project: { name: "$_id", count: 1, sample: { $slice: ["$sample", 4] } } }
        ]);
        
        clearTimeout(timeout);
        res.json(cats);
    } catch (err) {
        console.error('Categories fetch error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to load categories' });
        }
    }
});

app.get('/api/category/:catName', async (req, res) => {
    const catName = req.params.catName;
    const page = parseInt(req.query.page) || 1;
    const limit = 30;

    try {
        const total = await Photo.countDocuments({ category: new RegExp(catName, 'i') });
        const photos = await Photo.find({ category: new RegExp(catName, 'i') })
            .skip((page - 1) * limit)
            .limit(limit);
        
        res.json({
            photos,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error('Category fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

app.get('/api/stats', async (req, res) => {
    const totalPhotos = await Photo.countDocuments();
    const totalCategories = (await Photo.distinct('category')).length;
    res.json({ totalPhotos, totalCategories });
});

app.get('/api/random', async (req, res) => {
    const photos = await Photo.aggregate([{ $sample: { size: 12 } }]);
    res.json({ photos });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
