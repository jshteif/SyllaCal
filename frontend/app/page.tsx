export default function Home() {
  return (
    <main className="container">
      <h1>syllaCal</h1>
      <p className="subtitle">Turn syllabi into a study plan & calendar.</p>

      <button onClick={() => (window.location.href = "/plan")}>
        Go to Planner →
      </button>
    </main>
  )
}