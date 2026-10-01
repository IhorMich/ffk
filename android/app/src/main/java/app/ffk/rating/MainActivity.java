package app.ffk.rating;

import android.app.AlarmManager;
import android.content.SharedPreferences;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

  // v2: recreate channel so Android picks up the phone's default notification sound.
  private static final String ALERT_CHANNEL = "matchcard_alerts_v2";
  private static final String ACTION_OPEN_CHAT = "app.ffk.rating.OPEN_CHAT";
  private static int notifySeq = 1000;
  private volatile boolean keepSplash = true;
  private String pendingChatPlayerId = null;
  private String pendingChatKind = null;
  private static volatile MainActivity aliveInstance;
  private final Handler chatPollHandler = new Handler(Looper.getMainLooper());
  private volatile boolean chatPollHandlerActive = false;
  private long chatPollHandlerIntervalMs = 12000L;
  private final Runnable chatPollHandlerTick = new Runnable() {
    @Override
    public void run() {
      if (!chatPollHandlerActive) return;
      runBackgroundChatPoll();
      chatPollHandler.postDelayed(this, chatPollHandlerIntervalMs);
    }
  };

  static MainActivity getAlive() {
    return aliveInstance;
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    aliveInstance = this;
    SplashScreen splash = SplashScreen.installSplashScreen(this);
    splash.setKeepOnScreenCondition(() -> keepSplash);
    splash.setOnExitAnimationListener(view -> view.remove());
    new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplash = false, 5000);
    registerPlugin(GalleryPickerPlugin.class);
    super.onCreate(savedInstanceState);
    ensureAlertChannel();
    captureChatIntent(getIntent());
    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    window.setStatusBarColor(Color.parseColor("#030308"));
    window.setNavigationBarColor(Color.parseColor("#030308"));
    if (Build.VERSION.SDK_INT >= 29) {
      window.setNavigationBarContrastEnforced(false);
    }
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView != null) {
      webView.setBackgroundColor(Color.parseColor("#030308"));
      webView.addJavascriptInterface(new SplashBridge(), "FfkSplash");
      webView.addJavascriptInterface(new NotifyBridge(), "FfkNotify");
    }
    getOnBackPressedDispatcher()
      .addCallback(
        this,
        new OnBackPressedCallback(true) {
          @Override
          public void handleOnBackPressed() {
            handleBack();
          }
        }
      );
    // Web layer may not be ready yet — retry open-chat after load.
    new Handler(Looper.getMainLooper()).postDelayed(this::flushPendingChatIntent, 1200);
    new Handler(Looper.getMainLooper()).postDelayed(this::flushPendingChatIntent, 2800);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    captureChatIntent(intent);
    flushPendingChatIntent();
  }

  @Override
  public void onResume() {
    super.onResume();
    aliveInstance = this;
    // Foreground: JS interval owns polling; stop native wake loop.
    stopBackgroundChatPollInternal();
    flushPendingChatIntent();
    runForegroundChatPoll();
  }

  @Override
  public void onPause() {
    // Don't wait for JS visibility events — WebView may freeze before they run.
    startBackgroundChatPollInternal(10000L);
    super.onPause();
  }

  @Override
  public void onDestroy() {
    if (aliveInstance == this) aliveInstance = null;
    // Keep AlarmManager alive after destroy so minimized delivery can resume.
    chatPollHandlerActive = false;
    chatPollHandler.removeCallbacks(chatPollHandlerTick);
    super.onDestroy();
  }

  /** Called from ChatPollReceiver / Handler while app is backgrounded. */
  void runBackgroundChatPoll() {
    Bridge bridge = getBridge();
    WebView webView = bridge != null ? bridge.getWebView() : null;
    if (webView == null) return;
    try {
      // Ensure JS can run even if Chromium paused timers while hidden.
      webView.resumeTimers();
    } catch (Exception e) {}
    final String js =
      "(function(){"
        + "try{"
        + "  if(window.ParentCloud&&typeof window.ParentCloud.pollInboxChats==='function'){"
        + "    window.ParentCloud.pollInboxChats({push:false});"
        + "    return '1';"
        + "  }"
        + "  return '0';"
        + "}catch(e){return '0';}"
        + "})()";
    webView.post(() -> {
      try {
        webView.evaluateJavascript(js, null);
      } catch (Exception e) {}
    });
  }

  private void runForegroundChatPoll() {
    Bridge bridge = getBridge();
    WebView webView = bridge != null ? bridge.getWebView() : null;
    if (webView == null) return;
    try { webView.resumeTimers(); } catch (Exception e) {}
    final String js =
      "(function(){"
        + "try{"
        + "  if(window.ParentCloud&&typeof window.ParentCloud.pollInboxChats==='function'){"
        + "    window.ParentCloud.pollInboxChats({push:true});"
        + "    return '1';"
        + "  }"
        + "  return '0';"
        + "}catch(e){return '0';}"
        + "})()";
    webView.post(() -> {
      try { webView.evaluateJavascript(js, null); } catch (Exception e) {}
    });
  }

  void startBackgroundChatPollInternal(long intervalMs) {
    long interval = intervalMs > 0 ? intervalMs : 10000L;
    if (interval < 8000L) interval = 8000L;
    chatPollHandlerIntervalMs = interval;
    chatPollHandlerActive = true;
    chatPollHandler.removeCallbacks(chatPollHandlerTick);
    chatPollHandler.postDelayed(chatPollHandlerTick, 1500L);
    ChatPollReceiver.start(this, interval);
  }

  void stopBackgroundChatPollInternal() {
    chatPollHandlerActive = false;
    chatPollHandler.removeCallbacks(chatPollHandlerTick);
    ChatPollReceiver.stop(this);
  }

  private void captureChatIntent(Intent intent) {
    if (intent == null) return;
    String playerId = intent.getStringExtra("team_player_id");
    if (playerId == null || playerId.isEmpty()) return;
    pendingChatPlayerId = playerId;
    String kind = intent.getStringExtra("chat_kind");
    pendingChatKind = kind == null ? "" : kind;
    intent.removeExtra("team_player_id");
    intent.removeExtra("chat_kind");
  }

  private void flushPendingChatIntent() {
    final String playerId = pendingChatPlayerId;
    if (playerId == null || playerId.isEmpty()) return;
    final String chatKind = pendingChatKind == null ? "" : pendingChatKind;
    Bridge bridge = getBridge();
    WebView webView = bridge != null ? bridge.getWebView() : null;
    if (webView == null) return;
    try {
      String idJson = JSONObject.quote(playerId);
      String kindJson = JSONObject.quote(chatKind);
      String js =
        "(function(){"
          + "var id=" + idJson + ";"
          + "var kind=" + kindJson + ";"
          + "var opts=kind==='team'?{kind:'team'}:undefined;"
          + "function go(){"
          + "  if(window.openPlayerCoachChat){window.openPlayerCoachChat(id,null,opts);return true;}"
          + "  if(window.ParentUI&&window.ParentUI.openPlayerCoachChat){window.ParentUI.openPlayerCoachChat(id,null,opts);return true;}"
          + "  return false;"
          + "}"
          + "if(go()) return '1';"
          + "setTimeout(function(){go();},400);"
          + "return '0';"
          + "})()";
      webView.post(() -> webView.evaluateJavascript(js, value -> {
        if (value != null && value.contains("1")) {
          pendingChatPlayerId = null;
          pendingChatKind = null;
        }
      }));
    } catch (Exception e) {
      // keep pending for next resume
    }
  }

  private void ensureAlertChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    // Drop legacy channel so sound/importance changes apply.
    try { nm.deleteNotificationChannel("matchcard_alerts"); } catch (Exception e) {}
    NotificationChannel existing = nm.getNotificationChannel(ALERT_CHANNEL);
    if (existing != null) return;
    NotificationChannel channel = new NotificationChannel(
      ALERT_CHANNEL,
      "Matchcard messages",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Chat and match alerts");
    channel.enableVibration(true);
    channel.enableLights(true);
    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    AudioAttributes attrs = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build();
    channel.setSound(sound, attrs);
    nm.createNotificationChannel(channel);
  }

  private void postAlert(String title, String body, String playerId) {
    postAlert(title, body, playerId, "", "");
  }

  private void postAlert(String title, String body, String playerId, String chatKind) {
    postAlert(title, body, playerId, chatKind, "");
  }

  private void postAlert(String title, String body, String playerId, String chatKind, String broadcastId) {
    ensureAlertChannel();
    Intent open = new Intent(this, MainActivity.class);
    open.setAction(ACTION_OPEN_CHAT);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
    if (playerId != null && !playerId.isEmpty()) {
      open.putExtra("team_player_id", playerId);
    }
    if (chatKind != null && !chatKind.isEmpty()) {
      open.putExtra("chat_kind", chatKind);
    }
    if (broadcastId != null && !broadcastId.isEmpty()) {
      open.putExtra("broadcast_id", broadcastId);
    }
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    int req = 0;
    if (broadcastId != null && !broadcastId.isEmpty()) {
      req = Math.abs(broadcastId.hashCode());
    } else if (playerId != null && !playerId.isEmpty()) {
      req = Math.abs(playerId.hashCode());
    }
    PendingIntent pi = PendingIntent.getActivity(this, req, open, flags);
    Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title == null || title.isEmpty() ? "Matchcard" : title)
      .setContentText(body == null ? "" : body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body == null ? "" : body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setAutoCancel(true)
      .setContentIntent(pi)
      .setSound(sound)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    // Stable id for team broadcasts so fan-out replaces instead of stacking.
    int notifyId;
    boolean onlyAlertOnce = false;
    if (broadcastId != null && !broadcastId.isEmpty()) {
      notifyId = 0x40000000 | (Math.abs(broadcastId.hashCode()) & 0x0fffffff);
      onlyAlertOnce = true;
    } else if (playerId != null && !playerId.isEmpty() && "team".equals(chatKind)) {
      notifyId = 0x41000000 | (Math.abs(playerId.hashCode()) & 0x0fffffff);
      onlyAlertOnce = true;
    } else if (playerId != null && !playerId.isEmpty()) {
      // Stable id per personal dialog — replace instead of stacking.
      notifyId = 0x42000000 | (Math.abs(playerId.hashCode()) & 0x0fffffff);
      onlyAlertOnce = true;
    } else {
      notifyId = ++notifySeq;
    }
    if (onlyAlertOnce) {
      builder.setOnlyAlertOnce(true);
    }
    try {
      NotificationManagerCompat.from(this).notify(notifyId, builder.build());
    } catch (SecurityException e) {
      // POST_NOTIFICATIONS not granted yet
    }
  }

  private class SplashBridge {
    @JavascriptInterface
    public void ready() {
      keepSplash = false;
    }
  }

  private class NotifyBridge {
    @JavascriptInterface
    public void show(String title, String body) {
      runOnUiThread(() -> postAlert(title, body, ""));
    }

    @JavascriptInterface
    public void showChat(String title, String body, String playerId) {
      runOnUiThread(() -> postAlert(title, body, playerId == null ? "" : playerId, ""));
    }

    @JavascriptInterface
    public void showChatKind(String title, String body, String playerId, String chatKind) {
      runOnUiThread(() -> postAlert(
        title,
        body,
        playerId == null ? "" : playerId,
        chatKind == null ? "" : chatKind,
        ""
      ));
    }

    @JavascriptInterface
    public void showChatBroadcast(String title, String body, String playerId, String chatKind, String broadcastId) {
      runOnUiThread(() -> postAlert(
        title,
        body,
        playerId == null ? "" : playerId,
        chatKind == null ? "" : chatKind,
        broadcastId == null ? "" : broadcastId
      ));
    }

    @JavascriptInterface
    public void schedule(String id, String title, String body, double whenMs) {
      long at = (long) whenMs;
      if (id == null || id.isEmpty() || at <= System.currentTimeMillis()) return;
      Intent intent = new Intent(MainActivity.this, TrainingAlarmReceiver.class);
      intent.setAction("app.ffk.rating.TRAINING_REMINDER");
      intent.putExtra("id", id);
      intent.putExtra("title", title == null ? "Matchcard" : title);
      intent.putExtra("body", body == null ? "" : body);
      int req = Math.abs(id.hashCode());
      int flags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
      PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, req, intent, flags);
      AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
      if (am == null) return;
      try {
        if (Build.VERSION.SDK_INT >= 23) {
          am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
          am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
        }
      } catch (SecurityException e) {
        am.set(AlarmManager.RTC_WAKEUP, at, pi);
      }
      SharedPreferences sp = getSharedPreferences("ffk_train_alarms", MODE_PRIVATE);
      sp.edit().putLong(id, at).putString(id + "_title", title == null ? "" : title)
        .putString(id + "_body", body == null ? "" : body).apply();
    }

    @JavascriptInterface
    public void cancel(String id) {
      if (id == null || id.isEmpty()) return;
      Intent intent = new Intent(MainActivity.this, TrainingAlarmReceiver.class);
      intent.setAction("app.ffk.rating.TRAINING_REMINDER");
      int req = Math.abs(id.hashCode());
      int flags = PendingIntent.FLAG_UPDATE_CURRENT;
      if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
      PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, req, intent, flags);
      AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
      if (am != null) am.cancel(pi);
      getSharedPreferences("ffk_train_alarms", MODE_PRIVATE).edit()
        .remove(id).remove(id + "_title").remove(id + "_body").apply();
    }

    /** Native wake loop while app is minimized — WebView setInterval is frozen. */
    @JavascriptInterface
    public void startBackgroundChatPoll(double intervalMs) {
      runOnUiThread(() -> startBackgroundChatPollInternal((long) intervalMs));
    }

    @JavascriptInterface
    public void stopBackgroundChatPoll() {
      runOnUiThread(() -> stopBackgroundChatPollInternal());
    }
  }

  private void handleBack() {
    Bridge bridge = getBridge();
    WebView webView = bridge != null ? bridge.getWebView() : null;
    if (webView == null) {
      moveTaskToBack(true);
      return;
    }
    webView.evaluateJavascript(
      "(window.ffkBack&&window.ffkBack())?'1':'0'",
      value -> {
        if (value == null || !value.contains("1")) moveTaskToBack(true);
      }
    );
  }
}
