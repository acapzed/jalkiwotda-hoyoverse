(() => {
  const app = window.JALKIWOTDA_HSR;
  if (!app) return;

  app.panel.installPanelWhenReady();
  app.network.installFetchHook();
  app.network.installXhrHook();
})();
