/**
 * @file App.jsx
 * @description Root application component for the meditation app. Sets up React Router,
 * global layout (dark theme, nav), and route definitions for Home, Explore, and Admin.
 */

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";


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
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <nav className="flex gap-4 p-4 border-b border-gray-800">
          <Link className="text-gray-200 hover:text-white" to="/">
            Home
          </Link>
          <Link className="text-gray-200 hover:text-white" to="/explore">
            Explore
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
              }
            />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
