import React, { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import RateModal from "./components/RateModal";
import SurveyModal from "./components/SurveyModal";
import Chatbot from "./components/Chatbot";
import EmergencyButton from "./components/EmergencyButton";

import Home from "./pages/Home";
import MapView from "./pages/MapView";
import HowItWorks from "./pages/HowItWorks";
import SafeRoutePage from "./pages/SafeRoutePage";
import Auth from "./pages/Auth";

export default function App() {
  const [rateOpen, setRateOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const location = useLocation();

  // Hide navbar on full-screen map and auth pages
  const isMap = location.pathname === "/map" || location.pathname === "/route";
  const isAuth = location.pathname === "/auth";

  return (
    <AuthProvider>
      {/* Navbar */}
      {!isAuth && <Navbar onRateClick={() => setRateOpen(true)} onSurveyClick={() => setSurveyOpen(true)} />}

      {/* Routes */}
      <Routes>
        <Route
          path="/"
          element={<Home onRateClick={() => setRateOpen(true)} onSurveyClick={() => setSurveyOpen(true)} />}
        />
        <Route path="/map" element={<MapView />} />
        <Route path="/route" element={<SafeRoutePage />} />
        <Route
          path="/how"
          element={<HowItWorks onRateClick={() => setRateOpen(true)} />}
        />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="*"
          element={<Home onRateClick={() => setRateOpen(true)} onSurveyClick={() => setSurveyOpen(true)} />}
        />
      </Routes>

      {/* Global rate modal */}
      {!isMap && !isAuth && (
        <RateModal
          isOpen={rateOpen}
          onClose={() => setRateOpen(false)}
          onRated={() => setRateOpen(false)}
        />
      )}

      {/* Global survey modal */}
      {!isMap && !isAuth && (
        <SurveyModal
          isOpen={surveyOpen}
          onClose={() => setSurveyOpen(false)}
        />
      )}

      {/* Global AI chatbot (from your version) */}
      {!isAuth && <Chatbot />}

      {/* Emergency SOS button (from friend) */}
      {!isAuth && <EmergencyButton />}
    </AuthProvider>
  );
}
