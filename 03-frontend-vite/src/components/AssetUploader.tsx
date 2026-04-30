export function AssetUploader() {
  return (
    <section className="panel">
      <h2>AssetUploader</h2>
      <p>
        Presigned upload shell for Phase 7 object bindings. Upload completion is
        expected to call backend asset APIs with RuntimeContext headers.
      </p>
      <div className="actions">
        <button className="button" type="button">
          Draft upload intent
        </button>
        <button className="button secondary" type="button">
          Complete upload contract
        </button>
      </div>
    </section>
  );
}
