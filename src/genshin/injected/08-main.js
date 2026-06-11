(() => {
  const app = window.JALKIWOTDA_GENSHIN;
  if (!app) return;

  app.panel.installPanelWhenReady();
  app.network.installFetchHook();
  app.network.installXhrHook();
})();
