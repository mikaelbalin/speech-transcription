import "./App.css";
import { Dictation } from "@/components/Dictation";
import { SettingsForm } from "@/components/SettingsForm";

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      <Dictation />
      <SettingsForm />
    </main>
  );
}

export default App;
