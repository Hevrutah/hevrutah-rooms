# Hevrutah Room Management – Setup Guide

## Overview

This app uses:
- **Username/password login** (no Google OAuth)
- **Google Service Account** to access all room calendars without individual user logins
- **JWT sessions** stored in localStorage (7-day expiry)
- **Vercel** for hosting the frontend + serverless API

---

## 1. Google Service Account Setup

### Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com) → your project
2. APIs & Services → Credentials → Create Credentials → Service Account
3. Give it a name (e.g., "hevrutah-rooms")
4. Click Done

### Download JSON Key
1. Click the service account → Keys tab → Add Key → Create new key → JSON
2. Download the `.json` file (keep it safe!)

### Share Room Calendars with the Service Account
For each of the 6 room calendars in Google Calendar:
1. Open Calendar Settings → Share with specific people
2. Add the service account email (looks like `name@project.iam.gserviceaccount.com`)
3. Set permission: **Make changes to events**

---

## 2. Vercel Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `JWT_SECRET` | A long random string (32+ characters) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The **entire content** of the service account JSON file |

To get the JSON as a single line:
```bash
cat service-account.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))"
```

---

## 3. Initial Admin Login

- **Username:** `yaad`
- **Password:** `admin123`

Change this immediately by editing `data/users.json` (see below).

---

## 4. Managing Users

Users are stored in `data/users.json`. Two ways to manage:

### Via Admin UI
1. Log in as admin → click ⚙️ ניהול
2. Add or delete users from the interface
3. If Vercel can't write the file automatically, copy the shown JSON and edit the file manually

### Manual edit
1. Generate a password hash:
   ```bash
   node -e "require('bcryptjs').hash('yourpassword', 12).then(h => console.log(h))"
   ```
2. Add to `data/users.json`:
   ```json
   {
     "id": "2",
     "name": "שם המטפל",
     "username": "username",
     "passwordHash": "<hash>",
     "role": "therapist"
   }
   ```
3. Commit + push → auto-deploys in ~60 seconds

---

## 5. Local Development

```bash
npm install -g vercel
vercel dev
```

For frontend-only (calendar grid, no auth):
```bash
npm run dev
```

Create `.env.local` for local API testing:
```
JWT_SECRET=local-dev-secret
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...full JSON...}
```
