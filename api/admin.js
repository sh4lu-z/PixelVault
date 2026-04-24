const express = require('express');
const router = express.Router();
const crypto = require('crypto');

module.exports = function(Photo, fetchUnsplash, mapPhoto) {
    
    // --- ADMIN AUTH CONFIG ---
    const adminEnvPass = process.env.ADMIN || 'admin123';
    // The target hash for the correct admin password
    const expectedHash = crypto.createHash('sha256').update(adminEnvPass).digest('hex');
    
    router.post('/login', (req, res) => {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password required' });
        
        // Hash the incoming password to compare
        const userHash = crypto.createHash('sha256').update(password).digest('hex');
        
        if (userHash === expectedHash) {
            res.json({ success: true, token: expectedHash });
        } else {
            res.status(401).json({ success: false, error: 'Invalid password' });
        }
    });

    // Custom Middleware to enforce Authentication for all routes below
    router.use((req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (token && token === expectedHash) {
            return next();
        }
        res.status(401).json({ error: 'Unauthorized' });
    });

    // Get all unique categories
    router.get('/categories', async (req, res) => {
        try {
            const categories = await Photo.distinct('category');
            res.json(categories.filter(Boolean));
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    // Get all photos, optionally filtered by verification status
    router.get('/photos', async (req, res) => {
        try {
            const { verified } = req.query;
            let query = {};
            if (verified === 'true') query.verified = true;
            if (verified === 'false') query.verified = false;

            const categoryFilter = req.query.category;
            if (categoryFilter) {
                query.category = new RegExp(categoryFilter, 'i');
            }

            const limit = parseInt(req.query.limit) || 100;
            const page = parseInt(req.query.page) || 1;

            const photos = await Photo.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);
                
            const total = await Photo.countDocuments(query);
            res.json({ photos, total, page, limit });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Verify a photo
    router.put('/photo/:id/verify', async (req, res) => {
        try {
            await Photo.findOneAndUpdate({ id: req.params.id }, { verified: true });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Unverify / Reject a photo back to draft
    router.put('/photo/:id/unverify', async (req, res) => {
        try {
            await Photo.findOneAndUpdate({ id: req.params.id }, { verified: false });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete a photo permanently
    router.delete('/photo/:id', async (req, res) => {
        try {
            await Photo.deleteOne({ id: req.params.id });
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // NEW: Bulk update category
    router.put('/photos/bulk-category', async (req, res) => {
        const { ids, category } = req.body;
        try {
            await Photo.updateMany({ id: { $in: ids } }, { category: category });
            res.json({ success: true });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    // NEW: Single photo category update
    router.put('/photo/:id/category', async (req, res) => {
        const { category } = req.body;
        try {
            await Photo.findOneAndUpdate({ id: req.params.id }, { category: category });
            res.json({ success: true });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    // NEW: Bulk Verify
    router.put('/photos/bulk-verify', async (req, res) => {
        const { ids } = req.body;
        try {
            await Photo.updateMany({ id: { $in: ids } }, { verified: true });
            res.json({ success: true });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    // NEW: Bulk Delete
    router.delete('/photos/bulk-delete', async (req, res) => {
        const { ids } = req.body;
        try {
            await Photo.deleteMany({ id: { $in: ids } });
            res.json({ success: true });
        } catch(e) { res.status(500).json({ error: e.message }); }
    });

    // Manual fetch from Unsplash (add to db as unverified)
    router.post('/fetch', async (req, res) => {
        const { query, count, orientation } = req.body;
        try {
            const rawPhotos = await fetchUnsplash(query || 'landscape', parseInt(count) || 30, orientation || 'all');
            if (!rawPhotos || !rawPhotos.length) {
                return res.json({ success: true, count: 0, message: "No photos found on Unsplash for this query." });
            }

            let added = 0;
            for (const p of rawPhotos) {
                const exists = await Photo.findOne({ id: p.id });
                if (!exists) {
                    const newPhotoDoc = { ...mapPhoto(p, query || 'uncategorized'), verified: false };
                    await Photo.create(newPhotoDoc);
                    added++;
                }
            }
            res.json({ success: true, count: added, totalFetched: rawPhotos.length });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DB stats
    router.get('/stats', async (req, res) => {
        try {
            const verifiedActive = await Photo.countDocuments({ verified: true });
            const pendingAuth = await Photo.countDocuments({ verified: false });
            res.json({ verified: verifiedActive, pending: pendingAuth });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
