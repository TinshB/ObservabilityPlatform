// App.tsx is intentionally minimal — routing lives in src/routes/index.tsx
// This file exists as the conventional React entry component for Storybook
// and testing tooling that expects an App export.
import AppRoutes from './routes'

export default function App() {
  return <AppRoutes />
}
