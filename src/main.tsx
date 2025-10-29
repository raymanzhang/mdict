import React from "react";
import ReactDOM from "react-dom/client";
import { enableMapSet } from "immer";
import AppLoader from "./AppLoader";

// Ionic Core CSS
import '@ionic/react/css/core.css';

// Ionic Basic CSS
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

// Ionic Palettes (required for dark mode)
// Using dark.class.css to enable manual dark mode control via class instead of system preference
import '@ionic/react/css/palettes/dark.class.css';

// Optional Ionic CSS utilities
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

// Custom Ionic styles
import './ionicStyles.css';

/**
 * Application Entry Point
 * 
 * Zustand stores are now used instead of Context API.
 * No need for provider wrappers - stores are directly imported where needed.
 * Following best practices: Zustand for state management with Ionic React.
 */

// Enable Immer's MapSet plugin for Zustand stores that use Set/Map
enableMapSet();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppLoader />
  </React.StrictMode>,
);
