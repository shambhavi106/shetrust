# SheTrust

**A crowd-sourced women's safety platform for Bengaluru.**

SheTrust helps women make safer travel decisions using community safety ratings, a custom **Safety Trust Index (STI)**, safe route planning, and safety-focused cab recommendations.

🔗 **Live demo:** [shetrust-frontend.vercel.app](https://shetrust-frontend.vercel.app)

---

## Features

- **Crowd-sourced safety ratings** for 35+ Bengaluru locations (metro stations, bus stops, markets, commercial areas), split into four time slots: morning, afternoon, evening and night.
- **Safety Trust Index (STI)**: a score built from lighting, crowd levels, police presence and incident history. Submissions are anonymous and authenticated with JWT.
- **Outlier detection** that filters out unusual ratings so one bad actor can't skew a location's score.
- **Self-tuning weights**: an Ordinary Least Squares regression engine, written from scratch with Gauss–Jordan matrix inversion, re-derives the STI weights from user survey data every few hours. It falls back to sensible defaults until there is enough data.
- **Safe route planner** with an SOS button that finds the nearest police station.
- **Cab booking panel** with safety-focused recommendations.
- **Incident reporting** with basic text analysis of reports.
- **Real-time updates** and notifications over Socket.io.
- **AI chatbot** powered by the Google Gemini API.
- **Offline support** through a service worker.
- **Admin dashboard** for moderating ratings and incidents.

## Tech Stack

| Layer    | Technologies                                                          |
| -------- | --------------------------------------------------------------------- |
| Frontend | React 18, Vite, React Router, Mapbox GL (react-map-gl), Socket.io client |
| Backend  | Node.js, Express, MongoDB (Mongoose), Socket.io, JWT, Helmet, rate limiting |
| AI       | Google Gemini API                                                     |
| Hosting  | Vercel (frontend)                                                     |

## Project Structure

```
shetrust/
├── backend/
│   ├── models/        # Mongoose schemas (Location, Rating, Incident, Survey, ...)
│   ├── routes/        # API routes (auth, locations, ratings, incidents, chat, admin, ...)
│   ├── middleware/    # JWT auth
│   ├── utils/         # STI engine, OLS regression, NLP analyser, seed script
│   ├── socket.js      # Real-time events
│   └── server.js      # Express entry point
├── frontend/
│   ├── public/        # Service worker + offline page
│   └── src/
│       ├── pages/       # Home, Map, Safe Route, How It Works, Auth, Admin
│       ├── components/  # Rating/survey/incident modals, SOS button, cab panel, chatbot, ...
│       ├── hooks/       # useLocations, useRating, useSocket
│       └── utils/       # API client, socket, offline manager
├── .env.example
└── package.json       # npm workspaces (runs frontend + backend together)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer, and npm
- A MongoDB database: a free [MongoDB Atlas](https://cloud.mongodb.com) cluster or a local MongoDB install
- A free [Mapbox access token](https://account.mapbox.com/access-tokens)
- *(Optional)* A [Google Gemini API key](https://aistudio.google.com/) for the chatbot

### 1. Clone the repository

```bash
git clone https://github.com/shambhavi106/shetrust.git
cd shetrust
```

### 2. Install dependencies

This installs packages for both the frontend and the backend:

```bash
npm install
```

### 3. Set up environment variables

Copy the example files and fill in your own values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**`backend/.env`**

| Variable         | Required | Description                                        |
| ---------------- | -------- | -------------------------------------------------- |
| `MONGODB_URI`    | Yes      | Your MongoDB connection string                     |
| `JWT_SECRET`     | Yes      | Any long random string                             |
| `PORT`           | No       | Defaults to `5000`                                 |
| `GEMINI_API_KEY` | No       | Enables the AI chatbot (a fallback is used without it) |
| `FRONTEND_URL`   | Prod only | Your deployed frontend URL, used for CORS         |

Email (SMTP) and browser push (VAPID) settings are optional; see `backend/.env.example` for details.

**`frontend/.env`**

| Variable            | Required | Description                                  |
| ------------------- | -------- | -------------------------------------------- |
| `VITE_MAPBOX_TOKEN` | Yes      | Your Mapbox public token (starts with `pk.`) |
| `VITE_API_URL`      | Yes      | Backend URL, e.g. `http://localhost:5000/api` |

### 4. Seed the database (first run only)

This loads the Bengaluru locations and some demo ratings so the map isn't empty:

```bash
npm run seed --workspace=backend
```

### 5. Start the app

```bash
npm run dev
```

This runs both servers together:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## How the Safety Trust Index Works

Each rating scores a location on four factors: **lighting**, **crowd**, **police presence** and **incident history**. The STI is a weighted combination of these factors, calculated separately for each time slot, so a place can be rated safe in the afternoon but less safe at night.

The weights start at defaults (30% lighting, 30% crowd, 20% police, 20% incidents). As users fill in surveys, the regression engine learns which factors matter most to people's sense of safety and updates the weights automatically. Unusual ratings are flagged as outliers and given less influence on the score.

## API Overview

| Route                | Purpose                                 |
| -------------------- | --------------------------------------- |
| `/api/auth`          | Anonymous sign-up and login (JWT)       |
| `/api/locations`     | Locations and their STI scores          |
| `/api/ratings`       | Submit safety ratings (rate-limited)    |
| `/api/incidents`     | Report and view incidents               |
| `/api/survey`        | Survey responses used for STI weights   |
| `/api/notifications` | User notifications                      |
| `/api/chat`          | Gemini-powered chatbot                  |
| `/api/admin`         | Admin moderation tools                  |

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a pull request.

---

**SheTrust: making safer journeys a community effort.**
