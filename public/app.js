document.addEventListener('DOMContentLoaded', () => {
    const galleryGrid = document.getElementById('gallery-grid');
    const collectionsNav = document.getElementById('collections-nav');
    const sortSelect = document.getElementById('sort-by');
    const navItems = document.querySelectorAll('.nav-item');
    const themeToggle = document.getElementById('theme-toggle');
    const lightbox = document.getElementById('lightbox');
    const lightboxMediaContainer = lightbox.querySelector('.media-container');
    const closeLightboxBtn = lightbox.querySelector('.lightbox-close');
    const prevLightboxBtn = lightbox.querySelector('.lightbox-prev');
    const nextLightboxBtn = lightbox.querySelector('.lightbox-next');

    let allMedia = [];
    let currentlyDisplayedMedia = [];
    let currentLightboxIndex = 0;

    // --- Theme Management ---
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggle.checked = theme === 'dark';
    };

    themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked ? 'dark' : 'light');
    });

    // --- Data Fetching ---
    const fetchMedia = async () => {
        try {
            const response = await fetch('/api/media');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allMedia = await response.json();
            currentlyDisplayedMedia = [...allMedia];
            populateCollections(allMedia);
            sortAndRenderMedia();
        } catch (error) {
            console.error("Failed to fetch media:", error);
            galleryGrid.innerHTML = '<p class="error">Could not load media. Please check the server console.</p>';
        }
    };

    // --- UI Rendering ---
    const renderGallery = (mediaItems) => {
        galleryGrid.innerHTML = ''; // Clear existing items
        if (mediaItems.length === 0) {
            galleryGrid.innerHTML = '<p>No media found.</p>';
            return;
        }
        mediaItems.forEach((item, index) => {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';
            gridItem.dataset.index = index;

            let mediaElement;
            // Use thumbnailLink if available, otherwise use the full URL (for images)
            // Note: Google Drive thumbnails might be small, but they are better than nothing for videos.
            // For high-res images, we might want to use the proxy URL, but for the grid, thumbnails are faster.
            // Let's try using the proxy URL for images (better quality) and thumbnailLink for videos.

            let imageUrl = item.thumbnailLink ? item.thumbnailLink.replace('=s220', '=s600') : item.url;

            if (item.mimeType.startsWith('video/')) {
                // If no thumbnail for video, use a placeholder or try to load it (but loading video in img tag fails)
                if (!item.thumbnailLink) {
                    // Use a transparent pixel or a placeholder SVG data URI
                    imageUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+VmlkZW88L3RleHQ+PC9zdmc+';
                }

                mediaElement = document.createElement('img');
                mediaElement.src = imageUrl;
                mediaElement.alt = item.name;

                // Add video icon
                const videoIcon = document.createElement('div');
                videoIcon.className = 'video-icon';
                videoIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
                gridItem.appendChild(videoIcon);
            } else {
                mediaElement = document.createElement('img');
                mediaElement.src = item.url; // Use full quality for images in grid if possible, or imageUrl for speed
                mediaElement.alt = item.name;
                mediaElement.loading = 'lazy';
            }

            gridItem.appendChild(mediaElement);
            galleryGrid.appendChild(gridItem);
        });

        // CSS Columns handle the layout automatically
    };


    const populateCollections = (media) => {
        const collections = [...new Set(media.map(item => item.collection))];
        collectionsNav.innerHTML = '';
        collections.forEach(collectionName => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'nav-item';
            link.textContent = collectionName;
            link.dataset.filter = 'collection';
            link.dataset.collectionName = collectionName;
            collectionsNav.appendChild(link);
        });
        // Re-attach event listeners for new collection items
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', handleFilterClick));
    };

    // --- Sorting and Filtering ---
    const sortAndRenderMedia = () => {
        const sortValue = sortSelect.value;
        let sorted = [...currentlyDisplayedMedia];

        switch (sortValue) {
            case 'date-desc':
                sorted.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
                break;
            case 'date-asc':
                sorted.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
                break;
            case 'name-asc':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                sorted.sort((a, b) => b.name.localeCompare(a.name));
                break;
        }
        renderGallery(sorted);
    };

    const handleFilterClick = (e) => {
        e.preventDefault();
        const target = e.currentTarget;
        const filter = target.dataset.filter;

        // Update active class
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        target.classList.add('active');

        switch (filter) {
            case 'all':
                currentlyDisplayedMedia = [...allMedia];
                break;
            case 'videos':
                currentlyDisplayedMedia = allMedia.filter(item => item.mimeType.startsWith('video/'));
                break;
            case 'collection':
                const collectionName = target.dataset.collectionName;
                currentlyDisplayedMedia = allMedia.filter(item => item.collection === collectionName);
                break;
        }
        sortAndRenderMedia();
    };

    // --- Lightbox Logic ---
    const openLightbox = (index) => {
        currentLightboxIndex = index;
        const item = currentlyDisplayedMedia[currentLightboxIndex];

        lightboxMediaContainer.innerHTML = ''; // Clear previous media
        let mediaElement;

        if (item.mimeType.startsWith('video/')) {
            mediaElement = document.createElement('iframe');
            mediaElement.src = `https://drive.google.com/file/d/${item.id}/preview`;
            mediaElement.width = "800"; // Set a base width, CSS will make it responsive
            mediaElement.height = "450";
            mediaElement.allow = "autoplay; fullscreen";
            mediaElement.style.border = "none";
            mediaElement.className = "lightbox-iframe";
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = item.url;
        }

        lightboxMediaContainer.appendChild(mediaElement);
        lightbox.classList.add('active');
    };

    const closeLightbox = () => {
        lightbox.classList.remove('active');
        lightboxMediaContainer.innerHTML = ''; // Stop video playback etc.
    };

    const showNextMedia = () => {
        const newIndex = (currentLightboxIndex + 1) % currentlyDisplayedMedia.length;
        openLightbox(newIndex);
    };

    const showPrevMedia = () => {
        const newIndex = (currentLightboxIndex - 1 + currentlyDisplayedMedia.length) % currentlyDisplayedMedia.length;
        openLightbox(newIndex);
    };

    // --- Event Listeners ---
    sortSelect.addEventListener('change', sortAndRenderMedia);
    navItems.forEach(item => item.addEventListener('click', handleFilterClick));

    galleryGrid.addEventListener('click', (e) => {
        const gridItem = e.target.closest('.grid-item');
        if (gridItem) {
            const index = parseInt(gridItem.dataset.index, 10);
            openLightbox(index);
        }
    });

    closeLightboxBtn.addEventListener('click', closeLightbox);
    nextLightboxBtn.addEventListener('click', showNextMedia);
    prevLightboxBtn.addEventListener('click', showPrevMedia);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) { // Close if clicking on the background
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('active')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') showNextMedia();
            if (e.key === 'ArrowLeft') showPrevMedia();
        }
    });

    // --- Initial Load ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    fetchMedia();
});
