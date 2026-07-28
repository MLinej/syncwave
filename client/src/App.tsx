import { AppProvider } from "@/context/AppContext";
import Dashboard from "@/pages/Dashboard";

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}
