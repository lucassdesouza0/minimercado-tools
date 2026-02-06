// Google API Configuration
// TODO: Replace these with your actual Google Cloud credentials

const GOOGLE_CONFIG = {
  CLIENT_ID: "14165686939-st6n41k9tj4f8sr86r6uutsmspprbr1n.apps.googleusercontent.com",
  API_KEY: "AIzaSyA7szSiIGQX3V2_gkDhQVnCr95k-lWmZBI",
  SCOPES: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ],
  // Change this to the folder ID where your Google Sheets are located
  FOLDER_ID: "1EHecwJu1q_FOsNqIEwsQ9nam3R78AzUo",
  // client secret - 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
};

// How to get your Google Cloud Credentials:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project
// 3. Enable Google Drive API and Google Sheets API
// 4. Create OAuth 2.0 Web Application credentials
// 5. Add http://localhost:8000 (or your domain) to authorized redirect URIs
// 6. Copy your Client ID and API Key here
//
// How to get the folder ID:
// 1. Open Google Drive
// 2. Navigate to your target folder
// 3. Look at the URL: https://drive.google.com/drive/folders/[FOLDER_ID]
// 4. Copy the FOLDER_ID part
