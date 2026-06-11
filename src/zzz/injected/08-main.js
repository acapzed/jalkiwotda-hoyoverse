(() => {
  const app = window.JALKIWOTDA_ZZZ;
  if (!app) return;

  app.panel.installPanelWhenReady();
  app.network.installFetchHook();
  app.network.installXhrHook();
})();
