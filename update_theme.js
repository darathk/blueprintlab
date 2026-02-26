import fs from 'fs';

const globalsCss = `
@import "tailwindcss";

:root {
  /* Clean Light Theme */
  --background: #f4f4f5; /* Zinc 100 background */
  --foreground: #09090b; /* Zinc 950 text */

  --card-bg: #ffffff;
  --card-border: #e4e4e7; /* Zinc 200 */

  --primary: #18181b; /* Zinc 900 for modern high contrast primary */
  --primary-hover: #27272a; 
  --primary-foreground: #ffffff;

  --secondary: #f4f4f5; /* Zinc 100 */
  --secondary-hover: #e4e4e7; /* Zinc 200 */
  --secondary-foreground: #52525b; /* Zinc 600 */

  --accent: #2563eb; /* Blue 600 for important links/accents */
  --danger: #ef4444;
  --success: #10b981;
  --warning: #f59e0b;

  --font-sans: 'Inter', system-ui, sans-serif;

  --radius: 8px; /* Slightly sharper for modern clean look */
  --header-height: 64px;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  height: 100%;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
  text-decoration: none;
}

/* Utilities */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.glass-panel {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
}

.neon-text {
  /* Legacy class kept for compatibility, updated style for light mode */
  font-weight: 700;
  color: var(--primary);
}

.neon-border {
  border: 1px solid var(--primary);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius);
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid transparent;
  font-size: 0.875rem;
  letter-spacing: 0.01em;
}

.btn-primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-secondary {
  background: var(--secondary);
  color: var(--foreground);
  border: 1px solid var(--card-border);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.btn-secondary:hover {
  background: var(--secondary-hover);
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
}

.input {
  background: #ffffff;
  border: 1px solid var(--card-border);
  color: var(--foreground);
  padding: 0.6rem 1rem;
  border-radius: var(--radius);
  width: 100%;
  font-size: 0.875rem;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--secondary-foreground);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--card-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--secondary-foreground);
}

/* -------------------------------------
   MOBILE RESPONSIVENESS
-------------------------------------- */
@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .card {
    padding: 1rem;
  }

  .btn {
    padding: 0.4rem 1rem;
    font-size: 0.8rem;
  }
}
`;

fs.writeFileSync('/Users/Darath/.gemini/antigravity/scratch/athlete-analytics-tool/src/app/globals.css', globalsCss.trim());
console.log('Successfully updated globals.css with Light Theme');
