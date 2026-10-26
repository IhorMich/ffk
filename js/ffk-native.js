/* Bridge Android JavascriptInterface and Capacitor iOS plugins to one FfkNotify / FfkBilling API. */
(function (global) {
  function capPlugin(name) {
    try {
      const C = global.Capacitor;
      if (!C) return null;
      if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
      if (typeof C.registerPlugin === 'function') return C.registerPlugin(name);
    } catch (e) {}
    return null;
  }

  function wrapNotify(raw) {
    if (!raw) return null;
    // Android injects positional methods; Capacitor plugins take one object.
    if (typeof raw.schedule === 'function' && raw.schedule.length >= 3) return raw;
    return {
      show(title, body) {
        return raw.show({ title: String(title || 'TEMPO'), body: String(body || '') });
      },
      showChat(title, body, playerId) {
        return raw.showChat({
          title: String(title || 'TEMPO'),
          body: String(body || ''),
          playerId: String(playerId || '')
        });
      },
      showChatKind(title, body, playerId, chatKind) {
        return raw.showChatKind({
          title: String(title || 'TEMPO'),
          body: String(body || ''),
          playerId: String(playerId || ''),
          chatKind: String(chatKind || '')
        });
      },
      showChatBroadcast(title, body, playerId, chatKind, broadcastId) {
        return raw.showChatBroadcast({
          title: String(title || 'TEMPO'),
          body: String(body || ''),
          playerId: String(playerId || ''),
          chatKind: String(chatKind || ''),
          broadcastId: String(broadcastId || '')
        });
      },
      schedule(id, title, body, whenMs) {
        return raw.schedule({
          id: String(id || ''),
          title: String(title || 'TEMPO'),
          body: String(body || ''),
          whenMs: Number(whenMs) || 0
        });
      },
      cancel(id) {
        return raw.cancel({ id: String(id || '') });
      },
      canExactReminders() {
        try {
          const ret = raw.canExactReminders();
          if (ret && typeof ret.then === 'function') return true;
          if (ret && typeof ret.value === 'boolean') return ret.value;
          return true;
        } catch (e) {
          return true;
        }
      },
      requestExactReminders() {
        try { raw.requestExactReminders(); } catch (e) {}
      },
      startBackgroundChatPoll() {
        try { raw.startBackgroundChatPoll({}); } catch (e) {}
      },
      stopBackgroundChatPoll() {
        try { raw.stopBackgroundChatPoll({}); } catch (e) {}
      }
    };
  }

  function wrapBilling(raw) {
    if (!raw) return null;
    if (typeof raw.purchase === 'function' && raw.purchase.length === 0 && !raw.__ffkCap) {
      // Could be Android (no args) or Capacitor (optional object). Prefer Cap wrapper if Plugins.FfkBilling.
    }
    const isCap = !!(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.FfkBilling === raw);
    if (!isCap && typeof raw.purchase === 'function') return raw;
    return {
      __ffkCap: true,
      refresh() {
        return raw.refresh({});
      },
      purchase() {
        return raw.purchase({});
      },
      purchaseProduct(productId, period) {
        return raw.purchaseProduct({
          productId: String(productId || 'tempo_pro'),
          period: String(period || '')
        });
      }
    };
  }

  function install() {
    const notifyRaw = global.FfkNotify || capPlugin('FfkNotify');
    const billingRaw = global.FfkBilling || capPlugin('FfkBilling');
    const notify = wrapNotify(notifyRaw);
    const billing = wrapBilling(billingRaw);
    if (notify) global.FfkNotify = notify;
    if (billing) global.FfkBilling = billing;
  }

  install();
  // Capacitor plugins appear after the bridge boots.
  setTimeout(install, 400);
  setTimeout(install, 1500);
  setTimeout(install, 3500);
  try {
    document.addEventListener('deviceready', install, { once: true });
  } catch (e) {}
})(window);
