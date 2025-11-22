document.addEventListener('DOMContentLoaded', () => {
    const galleryContainer = document.getElementById('gallery-container');
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

    // --- Date Formatting Helper ---
    const formatDateGroup = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const isSameDay = (d1, d2) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

        if (isSameDay(date, now)) return "Today";
        if (isSameDay(date, yesterday)) return "Yesterday";

        const options = { month: 'long', year: 'numeric' };
        // Check if it's this month
        if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
            return "This Month";
        }
        return date.toLocaleDateString('en-US', options);
    };

    const getDetailedDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    // --- Data Fetching ---
    const fetchMedia = async () => {
        try {
            galleryContainer.innerHTML = '<div class="loader"></div>';
            const response = await fetch('/api/media');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allMedia = await response.json();

            if (allMedia.length === 0) {
                galleryContainer.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <h3>No media found</h3>
                        <p>Please check if the Google Drive folders are empty or if the service account has access.</p>
                    </div>`;
                return;
            }

            currentlyDisplayedMedia = [...allMedia];
            populateCollections(allMedia);
            sortAndRenderMedia();
        } catch (error) {
            console.error("Failed to fetch media:", error);
            galleryContainer.innerHTML = `
                <div style="text-align: center; padding: 50px; color: red;">
                    <h3>Error loading media</h3>
                    <p>${error.message}</p>
                    <p>Check the server console for more details.</p>
                </div>`;
        }
    };

    // --- Grouping Logic ---
    const groupMedia = (mediaItems) => {
        const groups = {};
        mediaItems.forEach(item => {
            const groupName = formatDateGroup(item.createdTime);
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(item);
        });
        return groups;
    };

    // --- UI Rendering ---
    const renderGallery = (mediaItems) => {
        galleryContainer.innerHTML = ''; // Clear existing items

        if (mediaItems.length === 0) {
            galleryContainer.innerHTML = '<p style="text-align:center; padding:20px;">No items match your filter.</p>';
            return;
        }

        // If sorting by Name, we might not want date grouping. 
        // But for "Google Photos" style, date is primary. 
        // If user sorts by Name, we can just render one big grid or group by first letter.
        // For now, let's only group by date if sorting by Date.
        const sortBy = sortSelect.value;
        const isDateSort = sortBy.includes('date');

        if (isDateSort) {
            const groups = groupMedia(mediaItems);
            // Sort groups? "Today" first.
            // The mediaItems are already sorted, so the groups should be created in order if we iterate.
            // But object keys order isn't guaranteed. Better to iterate the sorted array and build sections on the fly or use Map.

            // Better approach: Iterate sorted items and create new section when date changes.
            let currentGroup = null;
            let currentGrid = null;

            mediaItems.forEach((item, index) => {
                const groupName = formatDateGroup(item.createdTime);

                if (groupName !== currentGroup) {
                    currentGroup = groupName;

                    // Create Section
                    const section = document.createElement('div');
                    section.className = 'date-section';

                    const header = document.createElement('div');
                    header.className = 'date-header';
                    header.innerHTML = `
                        <span class="date-main">${groupName}</span>
                        <span class="date-sub">${groupName === 'Today' || groupName === 'Yesterday' ? getDetailedDate(item.createdTime) : ''}</span>
                    `;

                    currentGrid = document.createElement('div');
                    currentGrid.className = 'section-grid';

                    section.appendChild(header);
                    section.appendChild(currentGrid);
                    galleryContainer.appendChild(section);
                }

                const gridItem = createGridItem(item, index);
                currentGrid.appendChild(gridItem);
            });

        } else {
            // Flat grid for Name sorting
            const grid = document.createElement('div');
            grid.className = 'section-grid';
            mediaItems.forEach((item, index) => {
                grid.appendChild(createGridItem(item, index));
            });
            galleryContainer.appendChild(grid);
        }
    };

    const createGridItem = (item, index) => {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.dataset.index = index; // Note: This index is relative to currentlyDisplayedMedia

        let mediaElement;
        // Use thumbnailLink if available, otherwise use the full URL (for images)
        let imageUrl = item.thumbnailLink ? item.thumbnailLink.replace('=s220', '=s600') : item.url;

        if (item.mimeType.startsWith('video/')) {
            if (!item.thumbnailLink) {
                // Fallback for video without thumbnail
                imageUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+VmlkZW88L3RleHQ+PC9zdmc+';
            }

            mediaElement = document.createElement('img');
            mediaElement.src = imageUrl;
            mediaElement.alt = item.name;

            const videoIcon = document.createElement('div');
            videoIcon.className = 'video-icon';
            videoIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            gridItem.appendChild(videoIcon);
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = item.url;
            mediaElement.alt = item.name;
            mediaElement.loading = 'lazy';
        }

        gridItem.appendChild(mediaElement);

        // Click event
        gridItem.addEventListener('click', () => openLightbox(index));

        return gridItem;
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
        // Important: We need to update currentlyDisplayedMedia to match the sorted order 
        // so that lightbox navigation works correctly with the displayed order.
        currentlyDisplayedMedia = sorted;
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

    const showNextMedia = (e) => {
        if (e) e.stopPropagation();
        const newIndex = (currentLightboxIndex + 1) % currentlyDisplayedMedia.length;
        openLightbox(newIndex);
    };

    const showPrevMedia = (e) => {
        if (e) e.stopPropagation();
        const newIndex = (currentLightboxIndex - 1 + currentlyDisplayedMedia.length) % currentlyDisplayedMedia.length;
        openLightbox(newIndex);
    };

    // --- Event Listeners ---
    sortSelect.addEventListener('change', sortAndRenderMedia);
    navItems.forEach(item => item.addEventListener('click', handleFilterClick));

    closeLightboxBtn.addEventListener('click', closeLightbox);
    nextLightboxBtn.addEventListener('click', showNextMedia);
    prevLightboxBtn.addEventListener('click', showPrevMedia);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lightboxMediaContainer) {
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
