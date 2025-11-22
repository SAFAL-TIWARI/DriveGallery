const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const port = 3000;

// --- Configuration ---
// IMPORTANT: Replace with your actual credentials and folder IDs
const CREDENTIALS_PATH = path.join(__dirname, 'gcsj-2025-73866c4d9bd1.json');
const DRIVE_FOLDER_IDS = ['1sVtMywFKCzv7LwPLQrV3Q2lb7XH69KVt', '14bNr079rGkdUzpyXzDxK50K16qFypbLI', '1gIunPxW8QUAbiFYPeq0nUh5xhPr2LH4d', '13or1YN_aQlYZLmX8vwhvbLFdQf2mcKPY', '1YKUw48VvU6BwgOumbjxWIbN5xPoLbAvA'];
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// --- Google Drive API Authentication ---
async function getAuthenticatedClient() {
    // Check for environment variable (for Vercel)
    if (process.env.GOOGLE_CREDENTIALS) {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });
        const authClient = await auth.getClient();
        return google.drive({ version: 'v3', auth: authClient });
    }

    // Fallback to local file
    const auth = new google.auth.GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: SCOPES,
    });
    const authClient = await auth.getClient();
    return google.drive({ version: 'v3', auth: authClient });
}

// --- API Endpoint to Fetch Media ---
app.get('/api/media', async (req, res) => {
    try {
        console.log(`Fetching media for folders: ${DRIVE_FOLDER_IDS}`);
        const drive = await getAuthenticatedClient();
        // Log the service account email (if possible to extract from auth client, otherwise just log that we are authenticated)
        console.log('Drive client authenticated.');

        let mediaFiles = [];

        for (const folderId of DRIVE_FOLDER_IDS) {
            console.log(`Querying folder: ${folderId}`);
            try {
                const folderResponse = await drive.files.get({
                    fileId: folderId,
                    fields: 'name',
                });
                const collectionName = folderResponse.data.name;
                console.log(`Found folder: ${collectionName}`);

                let pageToken = null;
                do {
                    const response = await drive.files.list({
                        q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
                        fields: 'nextPageToken, files(id, name, createdTime, mimeType, thumbnailLink, imageMediaMetadata, videoMediaMetadata)',
                        pageSize: 100,
                        pageToken: pageToken,
                    });

                    console.log(`  Fetched ${response.data.files.length} files from ${collectionName}`);

                    const files = response.data.files.map(file => ({
                        id: file.id,
                        name: file.name,
                        createdTime: file.createdTime,
                        url: `/api/file/${file.id}`,
                        thumbnailLink: file.thumbnailLink, // Add thumbnail link
                        mimeType: file.mimeType,
                        collection: collectionName,
                        width: file.imageMediaMetadata ? file.imageMediaMetadata.width : null,
                        height: file.imageMediaMetadata ? file.imageMediaMetadata.height : null,
                        durationMillis: file.videoMediaMetadata ? file.videoMediaMetadata.durationMillis : null,
                    }));

                    mediaFiles = mediaFiles.concat(files);
                    pageToken = response.data.nextPageToken;
                } while (pageToken);
            } catch (folderError) {
                console.error(`Error accessing folder ${folderId}:`, folderError.message);
            }
        }

        console.log(`Total media files found: ${mediaFiles.length}`);
        res.json(mediaFiles);
    } catch (error) {
        console.error('Fatal error in /api/media:', error);
        res.status(500).json({ error: 'Failed to fetch media from Google Drive.' });
    }
});

// --- API Endpoint to Proxy File Content ---
// --- API Endpoint to Proxy File Content (HEAD support for Video Players) ---
app.head('/api/file/:fileId', async (req, res) => {
    try {
        const drive = await getAuthenticatedClient();
        const fileId = req.params.fileId;

        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType, size'
        });

        res.setHeader('Content-Type', fileMetadata.data.mimeType);
        res.setHeader('Content-Length', fileMetadata.data.size);
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200).end();
    } catch (error) {
        console.error('Error in HEAD request:', error.message);
        res.status(500).end();
    }
});

// --- API Endpoint to Proxy File Content (GET with Robust Range Support) ---
app.get('/api/file/:fileId', async (req, res) => {
    try {
        const drive = await getAuthenticatedClient();
        const fileId = req.params.fileId;
        const range = req.headers.range;

        console.log(`[Stream] Request for ${fileId} | Range: ${range || 'None'}`);

        // 1. Fetch Metadata
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType, size, name'
        });

        const fileSize = parseInt(fileMetadata.data.size);
        const mimeType = fileMetadata.data.mimeType;

        // Set common headers
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Accept-Ranges', 'bytes');

        const requestParams = {
            fileId: fileId,
            alt: 'media',
        };

        const requestOptions = {
            responseType: 'stream',
            headers: {}
        };

        // 2. Handle Range Requests
        if (range) {
            requestOptions.headers['Range'] = range;
        } else {
            res.setHeader('Content-Length', fileSize);
        }

        const response = await drive.files.get(requestParams, requestOptions);

        // 3. Handle Response Status
        // If Drive returns 200 but we asked for a Range (starting at 0), we can synthesize a 206.
        if (range && response.status === 200) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);

            if (start === 0) {
                // We have the full stream, and client asked for 0-. This is effectively the whole file.
                // We can send 206 with the full content range.
                res.status(206);
                res.setHeader('Content-Range', `bytes 0-${fileSize - 1}/${fileSize}`);
                res.setHeader('Content-Length', fileSize);
                // console.log('  -> Synthesizing 206 for full stream');
            } else {
                // We asked for a partial range (e.g. 1000-) but got the whole file (200).
                // We can't easily skip bytes in the stream without overhead.
                // Sending 200 OK might force the browser to redownload or handle it.
                res.status(200);
                res.setHeader('Content-Length', fileSize);
                // console.log('  -> Drive ignored non-zero range, sending 200 OK');
            }
        } else {
            // Forward whatever status Drive gave us (200 or 206)
            res.status(response.status);

            if (response.headers['content-range']) {
                res.setHeader('Content-Range', response.headers['content-range']);
            }
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }
        }

        response.data
            .on('error', err => {
                console.error('Error streaming file:', err);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            })
            .pipe(res);

    } catch (error) {
        console.error('Error fetching file content:', error.message);
        if (!res.headersSent) {
            res.status(500).send('Error fetching file');
        }
    }
});

// --- Serve Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Server Start ---
// Only start the server if we are not in a Vercel environment (Vercel handles the start)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
        console.log('Please ensure your `credentials.json` is in the root directory and you have replaced the placeholder DRIVE_FOLDER_IDS.');
    });
}

module.exports = app;
