# Ride Hailing Application - MERN Stack

A fully functional, modern Ride-Hailing Minimum Viable Product (MVP) built with the MERN (MongoDB, Express, React, Node.js) stack. This application features real-time bid-and-match systems for riders and drivers, geospatial queries, and a highly polished Admin Control Panel.

## 🚀 Features

### Rider App
- **Authentication**: Secure JWT-based authentication via HTTP-only cookies.
- **Ride Requests**: Riders can request a ride from a specific pickup to a drop-off location using Google Maps.
- **Fare Estimation**: Calculates distance and estimated fare prior to booking.
- **Real-Time Tracking**: Listen to live updates of the driver's location and ride status changes via WebSockets.

### Driver App
- **Real-Time Ride Broadcasts**: Drivers instantly receive ride requests based on their geographical location (using MongoDB `2dsphere` indexes).
- **Ride Management**: Accept rides, navigate to riders, update status (Arriving, Ongoing, Completed).
- **Location Sync**: Continuously broadcasts the driver's current coordinates to the server and assigned rider.

### Admin Dashboard
- **Real-Time Telemetry**: Real-time KPI cards for active rides, total drivers, and total riders.
- **Driver Management**: Manually override driver statuses (Force Online/Offline) and clear stuck rides.
- **Live Ride Monitoring**: A beautifully designed SaaS-style dashboard using Tailwind CSS to oversee all active platform operations.
- **Premium UI**: Custom-designed split-screen login and a glassmorphic dashboard interface.

---

## 🏗 Architecture & Technologies

### Backend (`/backend`)
- **Node.js & Express**: Core server framework.
- **MongoDB & Mongoose**: Database and ODM. Utilizes `2dsphere` indexes for rapid location-based querying of nearby drivers.
- **Socket.IO**: Real-time bidirectional event-based communication for ride broadcasts and location updates.
- **JWT**: Stateless, secure authentication via `cookie-parser`.

### Frontend (`/frontend`)
- **React 18 & Vite**: Lightning-fast frontend build tool and library.
- **Redux Toolkit**: Global state management (Auth, Active Ride, Driver Location).
- **Tailwind CSS**: Utility-first CSS framework powering the premium dashboard and modern UI components.
- **React Router Dom**: Client-side routing.
- **Google Maps API**: Render interactive maps, markers, and calculate routes using `@react-google-maps/api`.

---

## 📂 Project Structure

```text
RideHailingApp/
├── .gitignore               # Safely ignores node_modules, .env, and dist files
├── README.md                # Project documentation
│
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variables and DB connection
│   │   ├── constants/       # Ride state enums and transitions
│   │   ├── controllers/     # Route logic (auth, admin, driver, ride)
│   │   ├── middleware/      # JWT verification, Role-based access control
│   │   ├── models/          # Mongoose Schemas (User, Ride, Driver)
│   │   ├── routes/          # Express API routes
│   │   ├── services/        # Geospatial matching algorithms and Google Maps distance logic
│   │   ├── socket/          # Socket.IO connection and event handlers
│   │   ├── utils/           # JWT generation helpers
│   │   ├── app.js           # Express app configuration (CORS, middlewares)
│   │   └── server.js        # Entry point, HTTP & Socket server init
│   └── package.json
│
└── frontend/
    ├── public/              # Static assets (e.g., login-bg.png)
    ├── src/
    │   ├── api/             # Axios instances and API helper functions
    │   ├── app/             # Main App.jsx router wrapper
    │   ├── components/      # Reusable UI components (ShellLayout, ProtectedRoutes)
    │   ├── hooks/           # Custom React hooks (useSocket)
    │   ├── pages/           # Application views (Login, Register, Dashboards)
    │   ├── store/           # Redux Toolkit slices (user, activeRide)
    │   ├── main.jsx         # React DOM renderer
    │   └── styles.css       # Tailwind directives and global styles
    ├── tailwind.config.js   # Tailwind configuration
    ├── postcss.config.js    # PostCSS configuration
    ├── vite.config.js       # Vite configuration
    └── package.json
```

---

## ⚙️ Installation & Setup

### 1. Clone the repository
Ensure you have cloned this repository and are in the root folder.

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory (you can copy `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ride_hailing
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory (you can copy `.env.example`):
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Start the frontend development server:
```bash
npm run dev
```

---

## 🔐 Authentication & Roles

The system operates on three primary roles:
1.  **`rider`**: Standard user who can request rides.
2.  **`driver`**: Registered driver with a connected `Driver` profile. Can accept rides and toggle online status.
3.  **`admin`**: Administrative user. Accesses `/admin` to monitor the platform metrics and override driver states. 

*(Note: To create an Admin, register a standard user and manually update their `role` to `"admin"` in the MongoDB database).*

---

## 🛠 Available Scripts

**Frontend**:
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles the React application into static files for production in the `dist/` folder.

---

## 📡 API Reference

### Auth Routes (`/api/auth`)
- `POST /register`: Register a new user.
- `POST /login`: Login and receive an HTTP-only cookie.
- `POST /logout`: Clear the authentication cookie.
- `GET /me`: Fetch the current authenticated user profile.

### Ride Routes (`/api/rides`)
- `POST /estimate`: Get distance and fare estimation.
- `POST /request`: Initiate a ride request and broadcast to nearby drivers.
- `PATCH /:id/status`: Update ride status (e.g., ONGOING, COMPLETED).
- `GET /history`: Fetch ride history for the current user.
- `POST /:id/rate`: Submit a rating for a completed ride.

### Driver Routes (`/api/drivers`)
- `PATCH /location`: Update driver's current GPS coordinates.
- `PATCH /availability`: Toggle driver's online/offline status.
- `GET /nearby`: Find drivers within a specific radius (Geospatial).

### Admin Routes (`/api/admin`)
- `GET /stats`: Fetch aggregate platform statistics.
- `GET /rides/active`: Monitor all ongoing rides in real-time.
- `GET /drivers`: List all drivers and their current statuses.
- `PATCH /drivers/:id/status`: Force status update or clear stuck rides.

---

## 🔌 Socket.IO Events

The application uses real-time events to sync state across all clients.

### Server Emits
- `new_ride_request`: Sent to nearby drivers when a rider requests a trip.
- `ride_accepted`: Sent to the rider when a driver accepts their request.
- `ride_status_update`: Sent to both parties when the ride progress changes.
- `location_update`: Real-time coordinate streaming from driver to rider.

### Client Emits
- `join_ride`: Joins a socket room for a specific ride ID.
- `update_location`: (Driver) Sends latest coordinates to the server.

---

## 🛡️ Security Features
- **HTTP-Only Cookies**: Prevents XSS attacks by keeping JWTs inaccessible to client-side scripts.
- **Role-Based Access Control (RBAC)**: Middleware ensures only authorized users (Rider, Driver, Admin) can hit specific endpoints.
- **Input Validation**: Sanitized inputs and defined Mongoose schemas.
- **Geospatial Integrity**: Validates coordinates and enforces proximity checks for ride assignments.

---

## 🤝 Contributing
1. Fork the project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

