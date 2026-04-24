# सफल — SAFAL
### Service Accountability & File Action Log

> **A PWA-enabled, Nepali-language file tracking system for Nepal Government offices**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made for Nepal Gov](https://img.shields.io/badge/Made%20for-Nepal%20Government-red.svg)](https://nepal.gov.np)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-brightgreen.svg)](#pwa--installation)
[![Nepali BS Calendar](https://img.shields.io/badge/Calendar-Nepali%20BS-orange.svg)](#features)
[![Built with GAS](https://img.shields.io/badge/Backend-Google%20Apps%20Script-yellow.svg)](#tech-stack)

---

## 📋 Overview

**सफल (SAFAL)** is an open-source, single-file Progressive Web App (PWA) designed for Nepal Government offices to track daily file movement across administrative levels — from **नायब सुब्बा → शाखा अधिकृत → निर्देशक → सम्पन्न**.

Built entirely in **HTML + vanilla JavaScript**, with **Google Apps Script** as the backend and **Google Sheets** as the database — no server required, no hosting cost.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📅 **Nepali BS Calendar** | Full Bikram Sambat date picker & display (२०७५–२०९०) |
| 🎨 **Theme Support** | Light / Dark / Sepia themes with persistence |
| 🔤 **Font Size Control** | Adjustable 12px–22px via slider or quick buttons |
| 📲 **PWA / Installable** | Add to Home Screen on Android & iOS |
| 📡 **Offline Banner** | Detects and shows network status |
| 🔒 **Role-Based Access** | नायब सुब्बा, शाखा अधिकृत, निर्देशक, Admin |
| 🟢 **Color Status System** | Green / Yellow / Orange / Red by file age |
| ⏳ **Loading States** | All buttons show loading + prevent double-click |
| 📤 **File Forwarding** | Forward files up the hierarchy with one click |
| 🚫 **No Future Dates** | BS date picker restricts selection to today or earlier |
| 🔐 **Password Change** | Users can change their own passwords |

---

## 🖼️ Screenshots

> _(Add screenshots here after deployment)_

| Login | Dashboard | Forward Modal |
|---|---|---|
| ![Login](screenshots/login.png) | ![Dashboard](screenshots/dashboard.png) | ![Forward](screenshots/forward.png) |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Google Apps Script (GAS) |
| **Database** | Google Sheets |
| **Hosting** | Google Apps Script Web App (free) |
| **Fonts** | Noto Sans Devanagari, IBM Plex Mono |
| **Calendar** | Custom BS ↔ AD conversion engine (2075–2090) |
| **PWA** | Web App Manifest + Service Worker (Blob SW) |

---

## 🚀 Deployment Guide

### Prerequisites
- A Google Account
- A Google Sheet set up as the database (see [Sheet Structure](#google-sheet-structure))

### Step 1 — Set up Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Create a **New Project** — name it `SAFAL`
3. Create these files in the GAS editor:

```
Code.gs          ← main server logic
HtmlService.gs   ← serves index.html
```

4. Copy `Code.gs` from this repo into your GAS project
5. Go to **File → New → HTML file**, name it `index`, paste contents of `index.html`

### Step 2 — Connect Google Sheet

1. Create a new Google Sheet
2. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. In `Code.gs`, set:
```js
var SHEET_ID = 'YOUR_SHEET_ID_HERE';
```

### Step 3 — Deploy as Web App

1. In GAS editor: **Deploy → New Deployment**
2. Type: **Web App**
3. Execute as: **Me**
4. Who has access: **Anyone** (or "Anyone within your organization")
5. Click **Deploy** → copy the Web App URL

### Step 4 — Open in Browser

Visit your Web App URL. On mobile, use **"Add to Home Screen"** to install as a PWA.

---

## 📊 Google Sheet Structure

The backend expects these sheets in your Google Spreadsheet:

### Sheet: `users`
| username | password | fullName | role |
|---|---|---|---|
| admin | (hashed) | Administrator | admin |
| user1 | (hashed) | Ram Bahadur | नायब सुब्बा |

### Sheet: `files`
| id | appNumber | subject | receiveDate | currentLevel | totalDays | levelDays | color | completedDate | remarks |
|---|---|---|---|---|---|---|---|---|---|
| uuid | 2081/001 | नवीकरण | 2024-04-14 | 1 | 5 | 5 | green | | |

### Sheet: `settings`
| green_threshold | yellow_threshold | orange_threshold |
|---|---|---|
| 7 | 12 | 15 |

---

## 👥 User Roles

| Role | Can Add Files | Can Forward | Can View Completed | Can Change Settings |
|---|---|---|---|---|
| `नायब सुब्बा` | ✅ | ✅ | ❌ | ❌ |
| `शाखा अधिकृत` | ❌ | ✅ | ❌ | ❌ |
| `निर्देशक` | ❌ | ✅ | ✅ | ❌ |
| `admin` | ✅ | ❌ | ✅ | ✅ |

---

## 🎨 File Status Colors

| Color | Meaning | Default Days |
|---|---|---|
| 🟢 **सामान्य** | On track | 0 – 7 days |
| 🟡 **ध्यान आवश्यक** | Attention needed | 8 – 12 days |
| 🟠 **ढिलाइ भएको** | Delayed | 13 – 15 days |
| 🔴 **अत्यावश्यक** | Critical / Urgent | 16+ days |

> Thresholds are configurable per-office via the Settings panel.

---

## 📲 PWA & Installation

सफल is a **Progressive Web App**. On supported browsers:

**Android (Chrome)**
1. Open the Web App URL in Chrome
2. Tap the **"📲 एप इन्स्टल गर्नुहोस्"** button, or
3. Tap ⋮ menu → "Add to Home Screen"

**iOS (Safari)**
1. Open the Web App URL in Safari
2. Tap the Share button → "Add to Home Screen"

**Desktop (Chrome/Edge)**
1. Look for the install icon in the address bar

> **Note on Service Worker:** On `script.google.com` shared domain, the SW may be blocked by browser security. For full offline support, publish on a custom domain via GAS custom domain settings.

---

## 📅 Nepali BS Calendar Engine

Built-in BS ↔ AD conversion for years **२०७५ to २०९०** using the standard Bikram Sambat month-day table. The engine:

- Converts any AD date → BS date for display
- Converts BS picker selection → AD ISO string for storage
- Restricts future date selection
- Displays full Nepali format: `बि.सं. २०८३ बैशाख ११ गते शुक्रबार`

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** this repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes
4. **Test** by deploying to a GAS project
5. Submit a **Pull Request**

### Areas needing help
- [ ] More BS calendar years (2090–2100)
- [ ] Export to PDF / Excel
- [ ] Email notifications on file forwarding
- [ ] Multilingual support (English + Nepali toggle)
- [ ] Dark mode improvements
- [ ] Unit tests for BS conversion engine
- [ ] Better offline experience

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

---

## 🐛 Reporting Issues

Found a bug? [Open an issue](../../issues/new) with:
- Steps to reproduce
- Browser & OS
- Screenshot if possible

---

## 📁 Project Structure

```
safal/
├── index.html          # Complete frontend (single file — HTML + CSS + JS)
├── Code.gs             # Google Apps Script backend
├── README.md           # This file
├── CONTRIBUTING.md     # Contribution guidelines
├── LICENSE             # MIT License
└── screenshots/        # App screenshots (add yours here)
    ├── login.png
    ├── dashboard.png
    └── forward.png
```

---

## 🔒 Security Notes

- Passwords should be hashed server-side in `Code.gs` (SHA-256 recommended)
- Deploy GAS with **"Execute as Me"** to protect Sheet access
- Do not expose Sheet ID in client-side code
- Use GAS's built-in `Session` and `LockService` for concurrent access

---

## 📜 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

You are free to use, modify, and distribute this project. Attribution to **Ramlaxman Innovations** is appreciated.

---

## 👨‍💻 Developed By

**Ramlaxman Innovations**
*For Nepal Government*

---

## 🙏 Acknowledgements

- [Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari) — Google Fonts
- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) — Google Fonts
- Nepal Government offices for feedback and requirements
- Bikram Sambat calendar data from standard Nepal calendar references

---

*सफल — सेवा जवाफदेहिता र फाइल कार्य अभिलेख*
*Making Nepal Government file tracking transparent, accountable, and digital.*
