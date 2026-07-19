export default function AppLoading() {
  return (
    <div className="app-content" aria-label="Loading">
      <div
        className="skeleton"
        style={{ width: 130, height: 14, marginBottom: 15 }}
      />
      <div
        className="skeleton"
        style={{ width: "min(540px, 88%)", height: 50, marginBottom: 10 }}
      />
      <div
        className="skeleton"
        style={{ width: "min(680px, 100%)", height: 20, marginBottom: 38 }}
      />
      <div className="stats-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="stat" key={item}>
            <div className="skeleton" style={{ height: 64 }} />
          </div>
        ))}
      </div>
      <div className="skeleton" style={{ height: 280, marginTop: 30 }} />
    </div>
  );
}
