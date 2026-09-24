import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/roboto/latin-400.css';import '@fontsource/roboto/latin-500.css';import '@fontsource/roboto/latin-700.css';
import App from './App';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
