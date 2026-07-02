# GroupWork

> Structured group work collaboration — task allocation, progress tracking, accountability.

---

## What's in the box

| Layer | Tech | Purpose |
|-------|------|---------|
| Backend | Django + Django REST Framework | API, database, business rules |
| Auth | JWT (djangorestframework-simplejwt) | Secure login tokens |
| Frontend | React (Create React App) | Web UI |
| Database | SQLite (built-in) | No separate DB install needed |

---

## Quick Start (Your Laptop)

### Step 1 — Set up the backend

**Mac / Linux:**
```bash
cd backend
chmod +x setup.sh
./setup.sh
```

**Windows:**
```
Double-click backend/setup.bat
```

This will:
- Create a Python virtual environment
- Install all packages
- Create the database
- Create an admin account (username: `admin`, password: `admin1234`)

### Step 2 — Start the backend server

**Mac / Linux:**
```bash
cd backend/Groupwork
source venv/bin/activate
python manage.py runserver
```

**Windows:**
```bash
cd backend\Groupwork
venv\Scripts\activate
python manage.py runserver
```

Server runs at: **http://localhost:8000**

### Step 3 — Set up the frontend

Open a **second terminal window** (keep the backend running):

```bash
cd frontend
npm install
npm start
```

Frontend opens at: **http://localhost:3000**

---

## Making it accessible on your phone (same WiFi)

When both the backend and frontend are running on your laptop:

1. Find your laptop's local IP address:
   - **Mac:** System Settings → Wi-Fi → Details → IP Address
   - **Windows:** Open Command Prompt → type `ipconfig` → look for IPv4 Address
   - Example: `192.168.1.45`

2. Edit `frontend/src/api/client.js` — change this line:
   ```js
   const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
   ```
   To:
   ```js
   const BASE_URL = 'http://192.168.1.45:8000/api';  // use your actual IP
   ```

3. Start the backend so it listens on all interfaces:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

4. Start the frontend:
   ```bash
   npm start
   ```

5. On your phone (connected to the same WiFi), open:
   ```
   http://192.168.1.45:3000
   ```

That's it — the app will work on your phone's browser.

---

## Accounts to create for testing

Register these accounts via the `/register` page (or the Django admin):

| Name | Role | What they can do |
|------|------|-----------------|
| Dr. Wanjiru | lecturer | Create units, post assignments, link assignments to groups |
| Brian | leader | Create a group, assign tasks, view progress |
| Mary | student | Join group with code, update task status |
| Jane | student | Join group with code, update task status |

### Test flow to see everything working

1. **Register** Dr. Wanjiru as `lecturer`
2. Log in as Dr. Wanjiru → **Assignments** → Create Unit (e.g. "OR301 - Operations Research")
3. Still as Dr. Wanjiru → Create Assignment (set a deadline a few days from now)
4. **Register** Brian as `leader`
5. Log in as Brian → **My Group** → Create Group (e.g. "Team Alpha")
6. Note the group code shown on screen (e.g. `A9PN6G`)
7. **Register** Mary as `student`
8. Log in as Mary → **My Group** → Join with code → enter `A9PN6G`
9. Do the same for Jane
10. Back as Dr. Wanjiru → **Assignments** → "Link to Group" → select the assignment and Team Alpha → Link
11. As Brian → **Tasks** → New Task → assign "Section A Q1-5" to Mary, link to the assignment
12. As Mary → **Tasks** → click the task → change status to "In Progress"
13. As Brian → **Progress** → see Mary's task showing "In Progress"
14. As Brian → **Notifications** → see that Mary updated her task

---

## API Endpoints (for Postman testing)

Base URL: `http://localhost:8000/api`

| Method | URL | Who | What |
|--------|-----|-----|------|
| POST | `/token/` | Anyone | Login → returns access + refresh token |
| POST | `/register/` | Anyone | Create account |
| GET | `/me/` | Logged in | My profile |
| POST | `/groups/create/` | Leader | Create a group |
| POST | `/groups/join/` | Student/Rep | Join with `{"code": "A9PN6G"}` |
| GET | `/groups/mine/` | Any member | My group + members |
| GET | `/groups/progress/` | Leader | Per-member task breakdown |
| GET | `/groups/all/` | Lecturer/Rep | All groups |
| GET/POST | `/tasks/` | Authenticated | List / create tasks |
| GET/PATCH/DELETE | `/tasks/<id>/` | Authenticated | Task detail |
| GET/POST | `/assignments/` | Authenticated | List / create assignments |
| POST | `/assignments/group-assignments/` | Lecturer | Link assignment to group |
| GET | `/notifications/` | Authenticated | My notifications |
| PATCH | `/notifications/<id>/read/` | Authenticated | Mark one read |
| POST | `/notifications/read-all/` | Authenticated | Mark all read |
| GET | `/dashboard/` | Authenticated | Role-specific stats |

---

## Django Admin

Go to **http://localhost:8000/admin**
Login: `admin` / `admin1234`

From here you can directly create/edit/delete any data.

---

## Project structure

```
groupwork_complete/
├── backend/
│   ├── requirements.txt
│   ├── setup.sh          ← Run this first (Mac/Linux)
│   ├── setup.bat         ← Run this first (Windows)
│   └── Groupwork/
│       ├── manage.py
│       ├── Groupwork/    ← Django settings, URLs
│       ├── users/        ← Custom user model (roles)
│       ├── groups/       ← Groups, invite codes
│       ├── assignments/  ← Units, Assignments, GroupAssignments, Submissions
│       ├── tasks/        ← Tasks with status tracking
│       ├── notifications/← Auto-notifications
│       └── api/          ← All views, serializers, URLs
└── frontend/
    ├── package.json
    └── src/
        ├── App.js
        ├── api/client.js       ← Axios + JWT auto-refresh
        ├── contexts/AuthContext.js
        ├── pages/
        │   ├── LoginPage.js
        │   ├── RegisterPage.js
        │   ├── DashboardPage.js
        │   ├── GroupPage.js
        │   ├── TasksPage.js
        │   ├── AssignmentsPage.js
        │   ├── ProgressPage.js
        │   ├── NotificationsPage.js
        │   └── AdminPage.js
        └── components/
            └── common/Sidebar.js
```
