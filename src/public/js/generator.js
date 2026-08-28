/** Boots the generator only when its controller bundle and page DOM are available. */
(function bootstrapOutreachGenerator(browserWindow) {
  const GeneratorController = browserWindow?.OutreachOps?.OutreachGeneratorController;
  if (!GeneratorController) return;

  browserWindow.OutreachOps.generator = GeneratorController.mount({
    documentObject: browserWindow.document,
    windowObject: browserWindow
  });
})(typeof window === 'undefined' ? undefined : window);
