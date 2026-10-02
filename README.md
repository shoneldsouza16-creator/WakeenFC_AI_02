# KAYDA SATHI — Fresh MVP

This is a clean two-part project: `backend` (Node/Express) and `mobile` (Expo React Native).

## 1. Install Node.js
Install Node.js 20+ on Windows, then reopen VS Code.

Check:
`node --version`
`npm --version`

## 2. Backend
Open a VS Code terminal:
`cd backend`
`npm install`

Copy `backend/.env.example` to `backend/.env`. An Anthropic key is optional because the backend has a local demo classifier fallback.

Start:
`npm start`

Test in your browser:
`http://localhost:4000/health`

You should see `{ "ok": true, ... }`.

## 3. Mobile
Open a SECOND VS Code terminal:
`cd mobile`
`npm install`

Copy `mobile/.env.example` to `mobile/.env`.

For a physical phone, run `ipconfig` in PowerShell, find the laptop Wi-Fi IPv4 address, and change the mobile `.env` to:
`EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_IP:4000`

Example: `EXPO_PUBLIC_API_URL=http://192.168.1.10:4000`

Keep phone and laptop on the same Wi-Fi.

Start:
`npx expo start`

Scan the QR code with Expo Go.

## 4. Demo
Home → Try demo → Understand my problem → show issue, completeness, rights, action plan, documents, authority → Generate complaint → edit → My Cases.

## 5. Important
The app is a hackathon prototype for general legal guidance. It must not be presented as a substitute for a lawyer or as a guarantee of legal outcomes. Verify legal content and contact details before production use.
