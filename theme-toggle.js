(() => {
  const button = document.getElementById('themeToggle');
  if (!button) return;
  let industrial = false;
  try { industrial = localStorage.getItem('roleplayVisualTheme') === 'industrial'; } catch (_) {}
  function render() {
    document.documentElement.classList.toggle('industrial-theme', industrial);
    button.setAttribute('aria-pressed', String(industrial));
    button.textContent = industrial ? '通常のデザインに戻す' : '未来的なデザインに切替';
  }
  button.addEventListener('click', () => {
    industrial = !industrial;
    render();
    try { localStorage.setItem('roleplayVisualTheme', industrial ? 'industrial' : 'standard'); } catch (_) {}
  });
  render();
})();
