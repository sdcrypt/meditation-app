import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Explore from "./pages/Explore";

// export default function Home() {
//   return (
//     <div className="p-6">
//       <h2 className="text-xl font-semibold">Home</h2>
//       <p className="text-gray-300 mt-2">Today’s meditation will appear here.</p>
//     </div>
//   );
// }

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
        </Routes>
      </div>
    </BrowserRouter>
  );
}
