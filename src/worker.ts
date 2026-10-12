// Content scripts need explicit access to the short-lived session area.
void chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
}).catch(() => {});
