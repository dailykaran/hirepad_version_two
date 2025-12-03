(async () => {
  try {
    const mod = await import('./services/geminiService.js');
    console.log('Import succeeded. Exported keys:', Object.keys(mod));
  } catch (err) {
    console.error('Import failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
