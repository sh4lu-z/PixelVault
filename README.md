# PixelVault

![PixelVault Preview](https://sh4lu-z-projects.vercel.app/assets/pixelvault-preview.png)

A premium, fast, and intelligent image gallery application powered by Node.js, Express, and MongoDB.


## Features

- **Infinite Discovery:** Seamlessly browse through thousands of high-quality photos with smooth lazy loading.
- **Smart Search:** Advanced search logic that understands multiple keywords and protects users by filtering adult content from safe searches.
- **Local Download:** One-click download that saves high-quality images to your computer and opens them instantly in your default photo viewer.
- **Admin Dashboard:** Powerful management tools to fetch new images from Unsplash, verify content, and organize categories.
- **Premium UI:** Modern, dark-themed interface with glassmorphism effects and smooth animations.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Mongoose)
- **Frontend:** Vanilla JS, CSS3, HTML5
- **Icons:** Custom SVG iconography

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory with the following:
   ```env
   MONGO_URI=your_mongodb_connection_string
   UNSPLASH_ACCESS_KEY=your_unsplash_api_key
   ADMIN=your_admin_password
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Directory Structure

- `api/`: Backend routes and logic.
- `public/`: Frontend assets (HTML, CSS, JS).
- `downloads/`: Local storage for downloaded photos.

## Recent Updates (April 2026)

- Implemented smart adult-content filtering for safe search queries.
- Normalized all database categories to lowercase for consistent indexing.
- Added automated local file opening after download completion.
- Enhanced server process management for stable local development.

---
*Created with ❤️ by **Shaluka Gimhan***  
*PixelVault Original Author & Lead Developer*

