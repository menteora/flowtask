
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { ProjectProvider } from './context/ProjectContext';
import { BranchProvider } from './context/BranchContext';
import { TaskProvider } from './context/TaskContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ProjectProvider>
        <BranchProvider>
          <TaskProvider>
            <App />
          </TaskProvider>
        </BranchProvider>
      </ProjectProvider>
    </ThemeProvider>
  </React.StrictMode>
);
