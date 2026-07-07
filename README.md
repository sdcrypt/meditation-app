# Still — Meditation App

Still is a full-stack meditation web application focused on guided audio,
personalized discovery, persistent playback, and trustworthy practice tracking.

The application currently supports:

- A responsive marketing landing page
- A searchable and filterable meditation library
- Meditation artwork, teachers, descriptions, tags, and benefits
- Featured and personalized recommendations
- Four-step anonymous onboarding
- Email/password user registration and login
- A persistent audio player with resume support
- Mindful-minute, history, and timezone-aware streak tracking
- An authenticated content-management interface
- Audio and artwork uploads to Amazon S3

> **Project status:** active development. The application is suitable for local
> development and product validation, but it still needs the production
> hardening described in [Known limitations](#known-limitations-and-production-work).

## Contents

- [Architecture](#architecture)
- [Feature overview](#feature-overview)
- [Project structure](#project-structure)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Creating an admin account](#creating-an-admin-account)
- [Content-management workflow](#content-management-workflow)
- [Playback and progress tracking](#playback-and-progress-tracking)
- [Anonymous personalization](#anonymous-personalization)
- [API reference](#api-reference)
- [Useful commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations-and-production-work)

## Architecture

```text
React + Vite frontend
        |
        | HTTP / JSON
        v
FastAPI application
        |
        +---- PostgreSQL
        |       Meditations, sessions, activity events, admins
        |
        +---- Amazon S3
                Meditation audio and artwork
```

### Frontend

- React 18
- React Router
- Vite
- Tailwind utilities plus application-specific CSS
- Context providers for authentication, playback, and preferences
- Browser `localStorage` for anonymous identity, player state, and preferences

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL 15
- Alembic migrations
- Pydantic request and response validation
- HTTP-only cookie authentication backed by JWTs for normal users and administrators
- Boto3 for S3 uploads

## Feature overview

### Public landing page

The homepage is a responsive, scrollable marketing experience with:

- Hero and call-to-action sections
- Meditation categories
- Featured-practice visuals
- Social proof and testimonials
- Links into the live meditation library

### Explore and meditation details

The Explore page loads published content from the public API and supports:

- Artwork cards with generated visual fallbacks
- Search across titles, teachers, descriptions, categories, tags, and benefits
- Category, duration, and experience-level filters
- Featured meditations
- Personalized “For You” recommendations
- Click-through detail pages at `/meditations/:id`

Meditation detail pages display the complete content record and launch the
persistent player.

### Persistent audio player

The global player remains mounted while the user navigates between pages.
It provides:

- Play and pause
- Seekable progress
- Elapsed and remaining time
- 15-second backward and forward controls
- Playback speeds from `0.75×` to `2×`
- Volume control
- Local and server-side resume position
- Desktop and collapsible mobile layouts
- Automatic session progress heartbeats

### Progress experience

The Progress page at `/progress` includes:

- All-time mindful minutes
- Today’s mindful time
- Completed-practice count
- Current and longest streak
- Seven-day activity chart
- Paginated listening history
- Completed and in-progress statuses
- Resume percentages

### Admin content studio

Authenticated administrators can:

- Create meditations
- Edit all metadata
- Publish or unpublish content
- Mark meditations as featured
- Upload or replace audio
- Upload or replace artwork
- Preview media
- Delete meditations

## Project structure

```text
meditation_app/
├── backend/
│   ├── alembic.ini
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── migrations/
│   │   └── versions/
│   ├── requirements.txt
│   └── app/
│       ├── api/v1/
│       │   ├── admin/
│       │   ├── auth.py
│       │   ├── meditations.py
│       │   └── sessions.py
│       ├── core/
│       ├── db/
│       ├── models/
│       ├── schemas/
│       └── services/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── utils/
│       ├── App.jsx
│       └── index.css
└── README.md
```

## Local development

### Prerequisites

- Docker Desktop with Docker Compose
- Node.js 18 or newer
- npm
- An AWS S3 bucket if media uploads are required

### 1. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and provide your own values. Never commit this file.

### 2. Start PostgreSQL and the API

```bash
cd backend
docker compose up -d --build
```

Startup performs these operations in order:

1. Waits for PostgreSQL to become healthy
2. Runs `alembic upgrade head`
3. Seeds demo meditations if the meditation table is empty
4. Starts FastAPI with development auto-reload

Useful backend URLs:

- API: <http://127.0.0.1:8000>
- Health: <http://127.0.0.1:8000/api/v1/health/>
- Swagger documentation: <http://127.0.0.1:8000/api/v1/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/api/v1/openapi.json>

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

Useful frontend routes:

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/explore` | Meditation discovery and onboarding |
| `/meditations/:id` | Meditation details and playback |
| `/progress` | Mindful minutes, streaks, and history |
| `/login` | User registration and user/admin login |
| `/account` | Authenticated user account |
| `/admin` | Protected content studio |

## Environment variables

The backend reads `backend/.env` through Pydantic settings.

| Variable | Description | Development default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL SQLAlchemy URL | `postgresql://postgres:postgres@db:5432/meditation` |
| `AWS_ACCESS_KEY` | AWS access key for uploads | Empty |
| `AWS_SECRET_KEY` | AWS secret key for uploads | Empty |
| `AWS_REGION` | S3 bucket region | `ap-south-1` |
| `AWS_S3_BUCKET` | Media bucket name | Empty |
| `ADMIN_API_KEY` | Legacy optional admin key setting | `dev-secret` |
| `JWT_SECRET_KEY` | JWT signing secret | Development-only fallback |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Auth-cookie/JWT lifetime | `60` |
| `AUTH_COOKIE_NAME` | Browser session cookie name | `still_session` |
| `AUTH_COOKIE_SECURE` | Require HTTPS-only cookies | `False` |
| `AUTH_COOKIE_SAMESITE` | Cookie SameSite policy | `lax` |
| `LOG_LEVEL` | Backend logging level | `INFO` |

The `.env` file and local virtual environments are excluded from Docker image
builds through `backend/.dockerignore`.

### S3 requirements

The configured AWS identity needs permission to upload objects to the bucket.
Uploaded files are returned as public S3 URLs, so the bucket or its delivery
layer must permit browser reads.

For browser playback and artwork rendering, configure appropriate S3 CORS
rules for the frontend origins used by the app.

## Database migrations

Alembic owns schema changes. Do not use `Base.metadata.create_all()` as a
replacement for migrations.

Current migration history:

| Revision | Purpose |
| --- | --- |
| `20260704_0001` | Adoption-safe baseline schema |
| `20260704_0002` | Meditation content and discovery metadata |
| `20260705_0003` | Playback position and listened-time tracking |
| `20260706_0004` | Daily activity events for timezone-aware progress |
| `20260707_0005` | Normal user account status and creation metadata |

Apply migrations:

```bash
cd backend
docker compose exec api alembic upgrade head
```

Inspect the current revision:

```bash
docker compose exec api alembic current
```

Check whether models and migrations differ:

```bash
docker compose exec api alembic check
```

Create a migration after changing models:

```bash
docker compose exec api alembic revision --autogenerate -m "describe change"
```

Always review autogenerated migrations before applying them.

## Creating an admin account

Normal users can register through the UI. Create or update a local development
administrator with:

```bash
cd backend
docker compose exec api python -c "from app.db.session import SessionLocal; from app.models.user import User; from app.core.security import hash_password; db=SessionLocal(); email='admin@example.com'; user=db.query(User).filter(User.email == email).first() or User(email=email); user.hashed_password=hash_password('change-this-password'); user.is_admin=True; db.add(user); db.commit(); db.close()"
```

Then open <http://localhost:5173/login>.

Replace the example credentials and do not use this command as a production
account-provisioning workflow.

## Content-management workflow

1. Sign in at `/login`.
2. Open `/admin`.
3. Create a meditation with:
   - Title
   - Category
   - Duration
   - Experience level
   - Description
   - Teacher
   - Tags
   - Benefits
   - Featured and published states
4. Optionally select audio and artwork.
5. Save the meditation.

The create request runs before uploads because S3 objects need a meditation ID.
Audio and artwork are then uploaded through separate protected endpoints.

### Meditation data

Meditations currently include:

- `title`
- `category`
- `duration_sec`
- `level`
- `audio_url`
- `description`
- `teacher_name`
- `artwork_url`
- `tags`
- `benefits`
- `is_featured`
- `is_published`
- `created_at`

Artwork accepts JPEG, PNG, WebP, or AVIF files up to 10 MB.

## Playback and progress tracking

### Anonymous identity

Until user accounts are implemented, the frontend creates a random numeric
`device_id` and stores it in browser `localStorage`.

All session and progress APIs use this device identifier. It is convenient for
anonymous product testing, but it is not a secure identity mechanism.

### Session lifecycle

1. Playback starts.
2. The frontend calls `POST /sessions/start`.
3. The backend reuses an unfinished session for the same device and meditation,
   or creates a new one.
4. Every 10 seconds, and on pause or page exit, the player sends:
   - Current playback position
   - Accumulated real listening time
5. When audio ends, the player marks the session complete.

Playback position and actual listening time are deliberately separate.
Seeking forward does not increase mindful minutes.

### Mindful minutes and streak rules

- **Mindful minutes:** accumulated real listening time
- **History:** sessions with at least one second of listening
- **Streak day:** a local day with a completed meditation or at least 60
  seconds of listening
- **Current streak:** consecutive qualifying days ending today, or yesterday
  when today has no activity yet
- **Longest streak:** longest consecutive sequence of qualifying days

The browser supplies an IANA timezone. The backend converts activity timestamps
into that timezone before grouping days. Legacy aliases such as
`Asia/Calcutta` are normalized to canonical identifiers such as
`Asia/Kolkata`.

Activity heartbeats are also stored independently so a single unfinished
session spanning multiple days contributes to the correct local dates.

## Anonymous personalization

The Explore onboarding asks:

1. What the visitor needs help with
2. Preferred meditation duration
3. Experience level
4. Preferred practice time

No account is required. Preferences are stored under:

```text
still_meditation_preferences_v1
```

Example value:

```json
{
  "goals": ["stress", "sleep"],
  "duration": "short",
  "experience": "beginner",
  "practiceTime": "evening",
  "version": 1,
  "updatedAt": "2026-07-06T12:00:00.000Z"
}
```

### Recommendation ranking

The “For You” section ranks published meditations using:

- Goal matches against category, title, description, tags, and benefits
- Preferred duration
- Experience-level compatibility
- Preferred practice-time keywords
- Previously listened categories
- Stronger affinity for completed categories
- A small reduction for already-completed individual meditations to encourage
  variety

The ranking is deterministic and displays a reason such as “Less stress,”
“Your preferred length,” or “Inspired by your history.”

Preferences can be changed from the Explore hero or the “For You” section.

### Browser storage keys

| Key | Purpose |
| --- | --- |
| `device_id` | Anonymous device identifier |
| `still_meditation_preferences_v1` | Personalization profile |
| `still_onboarding_dismissed` | “Not now” onboarding state |
| `still_current_meditation` | Persistent player selection |
| `still_meditation_progress` | Local playback positions |
| `still_player_volume` | Volume preference |
| `still_player_speed` | Playback-speed preference |

Preferences survive browser restarts but do not synchronize across browsers or
devices. Auth sessions are stored in an HTTP-only cookie and are not readable
from frontend JavaScript. Clearing browser storage removes local preferences and
anonymous progress state, but logging out is handled through `/auth/logout`.

## API reference

All endpoints use the `/api/v1` prefix.

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health/` | Service health |

### Public meditation catalog

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/meditations/` | Published meditation list |
| `GET` | `/meditations/{id}` | Published meditation details |

List query parameters:

- `category`
- `featured`
- `limit` from 1 to 100
- `offset`

### Playback sessions and progress

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/sessions/start` | Create or resume an unfinished session |
| `PATCH` | `/sessions/{id}/progress` | Save position and mindful time |
| `POST` | `/sessions/{id}/complete` | Complete a session |
| `GET` | `/sessions/progress/{device_id}` | Progress summary and seven-day activity |
| `GET` | `/sessions/history/{device_id}` | Paginated listening history |
| `GET` | `/sessions/stats/{device_id}` | Lightweight legacy totals |

Progress summary accepts a `timezone` query parameter:

```text
GET /api/v1/sessions/progress/123456?timezone=Asia%2FKolkata
```

### User and administrator authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Register a normal user and set an HTTP-only auth cookie |
| `POST` | `/auth/login` | Log in a normal user or administrator and set an HTTP-only auth cookie |
| `GET` | `/auth/me` | Validate the current cookie session and return account details |
| `POST` | `/auth/logout` | Clear the auth cookie |

### Protected meditation administration

Browser requests use the HTTP-only auth cookie. The backend still accepts
`Authorization: Bearer <token>` for direct API compatibility, but the React app
does not store JWTs in `localStorage`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/admin/meditations/` | Published and unpublished content |
| `POST` | `/admin/meditations/` | Create a meditation |
| `PATCH` | `/admin/meditations/{id}` | Update metadata and publication state |
| `DELETE` | `/admin/meditations/{id}` | Delete meditation and session data |
| `POST` | `/admin/meditations/{id}/upload-audio` | Upload or replace audio |
| `POST` | `/admin/meditations/{id}/upload-artwork` | Upload or replace artwork |

Use Swagger at <http://127.0.0.1:8000/api/v1/docs> for exact schemas.

## Useful commands

### Backend

```bash
cd backend

# Start services
docker compose up -d

# Rebuild after dependency or Dockerfile changes
docker compose up -d --build

# View API logs
docker compose logs -f api

# Stop services without deleting data
docker compose down

# Inspect migration state
docker compose exec api alembic current

# Open PostgreSQL
docker compose exec db psql -U postgres -d meditation
```

Do not use `docker compose down -v` unless you intentionally want to delete the
PostgreSQL volume and all local data.

### Frontend

```bash
cd frontend

# Development server
npm run dev

# Production compilation check
npm run build

# Preview a production build
npm run preview
```

## Troubleshooting

### Progress page is empty

1. Open the browser Network panel.
2. Confirm these requests return `200`:
   - `/sessions/progress/{device_id}`
   - `/sessions/history/{device_id}`
3. Listen for at least 10 seconds so the first heartbeat is recorded.
4. Refresh `/progress`; it also refreshes automatically every 30 seconds.
5. Confirm the same browser profile is being used, since identity is based on
   `localStorage.device_id`.

### `Invalid timezone`

The current backend includes IANA timezone data and legacy aliases. Rebuild the
API if dependencies were changed:

```bash
cd backend
docker compose up -d --build api
```

### Frontend cannot connect to the API

Confirm:

- Docker services are running: `docker compose ps`
- API health returns `200`
- The frontend is running on port `5173`
- CORS origins in `backend/app/core/config.py` include the frontend origin
- `frontend/src/config.js` points to the correct API URL

### Media uploads fail

Check:

- AWS credentials in `backend/.env`
- Bucket name and region
- IAM `s3:PutObject` permissions
- Bucket read policy or delivery configuration
- S3 CORS configuration
- Artwork type and 10 MB size limit

### Uploaded media does not render

Open the generated S3 URL directly. If access is denied, update the bucket/CDN
read policy. If browser playback is blocked, inspect S3 CORS and content-type
metadata.

### Onboarding does not appear again

Use the Explore **Edit my preferences** button, or clear the onboarding keys in
DevTools:

```js
localStorage.removeItem("still_meditation_preferences_v1");
localStorage.removeItem("still_onboarding_dismissed");
```

### Docker source changes are not visible

Python source is bind-mounted and normally auto-reloads. Rebuild only when
dependencies, the Dockerfile, or image-level configuration changes:

```bash
cd backend
docker compose up -d --build api
```

## Known limitations and production work

Before production deployment:

1. Make `JWT_SECRET_KEY` required instead of using a development fallback,
   and rotate it for each environment.
2. Enable `AUTH_COOKIE_SECURE=true` in HTTPS environments and add CSRF
   protection if cross-site cookie flows are introduced.
3. Pin and audit all backend dependency versions.
4. Move the frontend API base URL into Vite environment configuration.
5. Add password reset, email verification, and account recovery.
6. Associate preferences, favorites, history, and progress with authenticated
   users for cross-device synchronization.
7. Replace random numeric device IDs with cryptographically strong anonymous
   identifiers during the transition to accounts.
8. Add rate limiting to authentication, session, and upload endpoints.
9. Add structured API and frontend automated test suites.
10. Add production monitoring, error reporting, backups, and migration
    procedures.
11. Serve media through private S3 objects and signed URLs or a CDN where
    appropriate.
12. Configure production CORS origins and remove development defaults.

## Planned product work

The next major product phase is secure account synchronization:

- Secure HTTP-only cookie authentication
- Password reset and email verification
- Favorites
- Cross-device preferences and progress
- Saved playlists
- Multi-day programs
- Reminders
- Account-level recommendations
