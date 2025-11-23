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
    const downloadLightboxBtn = document.getElementById('lightbox-download');

    // Mobile Nav Elements
    const navToggle = document.querySelector('.nav-toggle');
    const navContent = document.querySelector('.nav-content');

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
        // Use thumbnailLink if available. For images, we can use the full URL if thumbnail is missing.
        // We avoid replacing =s220 with =s600 for now as it might be breaking some links.
        let imageUrl = item.thumbnailLink || item.url;

        if (item.mimeType.startsWith('video/')) {
            if (!item.thumbnailLink) {
                // Fallback for video without thumbnail
                imageUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+VmlkZW88L3RleHQ+PC9zdmc+';
            }

            mediaElement = document.createElement('img');
            mediaElement.src = imageUrl;
            mediaElement.alt = item.name;
            mediaElement.referrerPolicy = "no-referrer"; // Important for Google Drive links

            // Add error handler for broken video thumbnails
            mediaElement.onerror = function () {
                this.onerror = null; // Prevent infinite loop
                this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+VmlkZW88L3RleHQ+PC9zdmc+';
            };

            const videoIcon = document.createElement('div');
            videoIcon.className = 'video-icon';
            videoIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            gridItem.appendChild(videoIcon);
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = imageUrl; // Use thumbnailLink if available
            mediaElement.alt = item.name;
            mediaElement.loading = 'lazy';
            mediaElement.referrerPolicy = "no-referrer"; // Important for Google Drive links

            // Add error handler for broken image thumbnails
            mediaElement.onerror = function () {
                this.onerror = null; // Prevent infinite loop
                this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+SW1hZ2U8L3RleHQ+PC9zdmc+';
            };
        }

        gridItem.appendChild(mediaElement);

        // Click event
        gridItem.addEventListener('click', () => openLightbox(index));

        return gridItem;
    };


    const populateCollections = (media) => {
        const imageCollections = new Set();
        const videoCollections = new Set();

        media.forEach(item => {
            if (item.mimeType.startsWith('image/')) {
                imageCollections.add(item.collection);
            } else if (item.mimeType.startsWith('video/')) {
                videoCollections.add(item.collection);
            }
        });

        const imagesDropdown = document.getElementById('images-dropdown');
        const videosDropdown = document.getElementById('videos-dropdown');

        imagesDropdown.innerHTML = '';
        videosDropdown.innerHTML = '';

        imageCollections.forEach(collectionName => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'nav-item';
            link.textContent = collectionName;
            link.dataset.filter = 'collection-image';
            link.dataset.collectionName = collectionName;
            imagesDropdown.appendChild(link);
        });

        videoCollections.forEach(collectionName => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'nav-item';
            link.textContent = collectionName;
            link.dataset.filter = 'collection-video';
            link.dataset.collectionName = collectionName;
            videosDropdown.appendChild(link);
        });

        // Dropdown Toggle Logic
        const dropdownHeaders = document.querySelectorAll('.dropdown-header');
        dropdownHeaders.forEach(header => {
            // Remove existing listeners to prevent duplicates if re-populated
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            newHeader.addEventListener('click', () => {
                newHeader.classList.toggle('active');
                const content = newHeader.nextElementSibling;
                content.classList.toggle('active');
            });
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
            case 'collection-image':
                const imgCollection = target.dataset.collectionName;
                currentlyDisplayedMedia = allMedia.filter(item => item.collection === imgCollection && item.mimeType.startsWith('image/'));
                break;
            case 'collection-video':
                const vidCollection = target.dataset.collectionName;
                currentlyDisplayedMedia = allMedia.filter(item => item.collection === vidCollection && item.mimeType.startsWith('video/'));
                break;
        }
        sortAndRenderMedia();

        // Close mobile menu if open
        if (navContent.classList.contains('active')) {
            navToggle.classList.remove('active');
            navContent.classList.remove('active');
        }
    };

    // --- Lightbox Logic ---
    const openLightbox = (index) => {
        currentLightboxIndex = index;
        const item = currentlyDisplayedMedia[currentLightboxIndex];

        lightboxMediaContainer.innerHTML = ''; // Clear previous media
        let mediaElement;

        if (item.mimeType.startsWith('video/') || item.mimeType.startsWith('image/')) {
            mediaElement = document.createElement('iframe');
            mediaElement.src = `https://drive.google.com/file/d/${item.id}/preview`;
            mediaElement.width = "800"; // Set a base width, CSS will make it responsive
            mediaElement.height = "450";
            mediaElement.allow = "autoplay; fullscreen";
            mediaElement.style.border = "none";
            mediaElement.className = "lightbox-iframe";
        } else {
            // Fallback for other types if any
            mediaElement = document.createElement('img');
            mediaElement.src = item.url;
        }

        lightboxMediaContainer.appendChild(mediaElement);

        // Update download link
        // Use the standard Drive download URL format
        downloadLightboxBtn.href = `https://drive.google.com/uc?export=download&id=${item.id}`;

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

    // --- Swipe Navigation ---
    let touchStartX = 0;
    let touchEndX = 0;

    const handleSwipe = () => {
        const swipeThreshold = 50; // Minimum distance for a swipe
        if (touchEndX < touchStartX - swipeThreshold) {
            showNextMedia();
        }
        if (touchEndX > touchStartX + swipeThreshold) {
            showPrevMedia();
        }
    };

    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    // --- Mobile Navigation Logic ---
    if (navToggle) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navToggle.classList.toggle('active');
            navContent.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (navContent.classList.contains('active') && !navContent.contains(e.target) && e.target !== navToggle) {
                navToggle.classList.remove('active');
                navContent.classList.remove('active');
            }
        });
    }

    // --- Initial Load ---
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    fetchMedia();
});
