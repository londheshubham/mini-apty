chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.windowId) {
    return;
  }

  void chrome.sidePanel.open({
    windowId: tab.windowId,
  });
});
