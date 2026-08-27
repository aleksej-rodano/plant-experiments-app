import { Sprout } from 'lucide-react'

function App() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-on-primary-container">
        <Sprout className="size-6" />
        <span className="text-lg font-medium">Plant Experiments</span>
      </div>
      <p className="text-sm text-on-surface-variant">
        Vite + React + Tailwind v4 (MD3) ready. Continue with Task 0c.
      </p>
    </main>
  )
}

export default App
