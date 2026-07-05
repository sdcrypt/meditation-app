/**
 * @file App.jsx
 * @description Root application component for the meditation app. Sets up React Router,
 * global layout (dark theme, nav), and route definitions for Home, Explore, and Admin.
 */

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import MeditationDetail from "./pages/MeditationDetail";
import Progress from "./pages/Progress";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PersistentPlayer from "./components/PersistentPlayer";
import { useAuth } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";


// export default function Home() {
//   return (
//     <div className="p-6">
//       <h2 className="text-xl font-semibold">Home</h2>
//       <p className="text-gray-300 mt-2">Today’s meditation will appear here.</p>
//     </div>
//   );
// }

/**
 * Root App component. Wraps the app in BrowserRouter and renders:
 * - A top nav with links to Home and Explore
 * - Routes: "/" (Home), "/explore" (Explore), "/admin" (Admin)
 * @returns {JSX.Element} The app shell with router and routes
 */
export default function App() {
  const { user, isLoading } = useAuth();

  return (
    <BrowserRouter>
      <PlayerProvider>
        <div className="app-shell">
          <header className="site-header">
            <div className="site-shell site-header__inner">
              <Link className="brand" to="/" aria-label="Still home">
                <span className="brand__mark"><i /><i /><i /></span>
                <span>still.</span>
              </Link>
              <nav className="site-nav" aria-label="Main navigation">
                <a href="/#benefits">Meditate</a>
                <a href="/#featured">Sleep</a>
                <Link to="/explore">Explore</Link>
                <Link to="/progress">Progress</Link>
                <a href="/#benefits">About</a>
              </nav>
              <div className="site-header__actions">
                {!isLoading && (
                  <Link className="login-link" to={user?.is_admin ? "/admin" : "/login"}>
                    {user?.is_admin ? "Admin" : "Log in"}
                  </Link>
                )}
                <Link className="header-cta" to="/explore">Get started</Link>
              </div>
            </div>
          </header>

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/meditations/:meditationId" element={<MeditationDetail />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
                }
              />
          </Routes>
          <footer className="site-footer">
            <div className="site-shell site-footer__inner">
              <Link className="brand brand--footer" to="/">
                <span className="brand__mark"><i /><i /><i /></span><span>still.</span>
              </Link>
              <p>Mindfulness for real life.</p>
              <div><a href="/#benefits">Meditate</a><a href="/#featured">Sleep</a><Link to="/explore">Explore</Link><Link to="/progress">Progress</Link></div>
              <small>© 2026 Still Mindful, Inc.</small>
            </div>
          </footer>
          <PersistentPlayer />
        </div>
      </PlayerProvider>
    </BrowserRouter>
  );
}
