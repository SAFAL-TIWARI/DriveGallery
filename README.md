# DriveGallery - A Google Drive Media Aggregator

This is a web application that aggregates images and video clips from specific Google Drive folders and displays them in a unified, user-friendly gallery.

## Tech Stack

-   **Frontend:** HTML5, CSS3 (Modern Flexbox/Grid), Vanilla JavaScript (ES6+)
-   **Backend:** Node.js with Express
-   **API:** Google Drive API v3

## Features

-   **Google Photos Style Layout:** A Masonry Grid layout that handles different aspect ratios gracefully.
-   **Lazy Loading:** For performance.
-   **Categorization & Sorting:** Sidebar for "All Photos," "Videos Only," and "Collections" (based on folder names), and a toolbar to sort by date, name, or size.
-   **Light/Dark Mode:** A theme toggle that persists using LocalStorage.
-   **Media Viewer:** A full-screen Lightbox/Modal for viewing images and videos.

## Project Structure

```
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── server.js
├── package.json
└── README.md
```

## Setup and Running the Application

1.  **Enable Google Drive API:**
    -   Go to the [Google Cloud Platform Console](https://console.cloud.google.com/).
    -   Create a new project.
    -   Go to "APIs & Services" > "Library".
    -   Search for "Google Drive API" and enable it.

2.  **Create a Service Account:**
    -   Go to "APIs & Services" > "Credentials".
    -   Click "Create Credentials" > "Service account".
    -   Fill in the details and grant the "Viewer" role.
    -   Click "Done".
    -   In the credentials page, click on the newly created service account.
    -   Go to the "Keys" tab, click "Add Key" > "Create new key".
    -   Select "JSON" as the key type and click "Create". This will download a `credentials.json` file.

3.  **Share Google Drive Folders:**
    -   Open the `credentials.json` file and find the `client_email`.
    -   In Google Drive, right-click on the folder(s) you want to use and click "Share".
    -   Paste the `client_email` and give it "Viewer" access.

4.  **Configure the Application:**
    -   Place the downloaded `credentials.json` file in the root of the project directory.
    -   Open `server.js` and replace the placeholder folder IDs in the `DRIVE_FOLDER_IDS` array with your actual Google Drive folder IDs.
        ```javascript
        const DRIVE_FOLDER_IDS = ['YOUR_FOLDER_ID_1', 'YOUR_FOLDER_ID_2'];
        ```

5.  **Install Dependencies and Run:**
    -   Open your terminal in the project root and run:
        ```bash
        npm install
        ```
    -   Then, start the server:
        ```bash
        npm start
        ```
    -   Open your browser and go to `http://localhost:3000`.

## How to get the Folder ID

You can get the folder ID from the URL of the folder in Google Drive. For example, if the URL is `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`, the folder ID is `1a2b3c4d5e6f7g8h9i0j`.
