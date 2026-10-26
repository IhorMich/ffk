package app.tempo;

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
import android.provider.Settings;
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
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

  // v2: recreate channel so Android picks up the phone's default notification sound.
  private static final String ALERT_CHANNEL = "matchcard_alerts_v2";
  private static final String ACTION_OPEN_CHAT = "app.tempo.OPEN_CHAT";
  private static int notifySeq = 1000;
  private volatile boolean keepSplash = true;
  private String pendingChatPlayerId = null;
  private String pendingChatKind = null;

  /** Clock and battery sit on top of scrolling text on Android 16. Keep them off the page. */
  private void hideSystemStatusBar() {
    Window window = getWindow();
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
    if (controller == null) return;
    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.statusBars());
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen splash = SplashScreen.installSplashScreen(this);
    splash.setKeepOnScreenCondition(() -> keepSplash);
    splash.setOnExitAnimationListener(view -> view.remove());
    new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplash = false, 5000);
    registerPlugin(GalleryPickerPlugin.class);
    super.onCreate(savedInstanceState);
    ensureAlertChannel();
    ChatPollReceiver.stop(this);
    captureChatIntent(getIntent());
    Window window = getWindow();
    WindowCompat.setDecorFitsSystemWindows(window, false);
    window.setStatusBarColor(Color.parseColor("#030308"));
    hideSystemStatusBar();
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
    hideSystemStatusBar();
    ChatPollReceiver.stop(this);
    flushPendingChatIntent();
    runForegroundChatPoll();
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

  void stopBackgroundChatPollInternal() {
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
      "TEMPO messages",
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
      .setContentTitle(title == null || title.isEmpty() ? "TEMPO" : title)
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
      TrainingAlarmReceiver.schedule(
        MainActivity.this,
        id,
        title == null ? "TEMPO" : title,
        body == null ? "" : body,
        at
      );
    }

    @JavascriptInterface
    public void cancel(String id) {
      TrainingAlarmReceiver.cancel(MainActivity.this, id);
    }

    @JavascriptInterface
    public boolean canExactReminders() {
      return TrainingAlarmReceiver.canExact(MainActivity.this);
    }

    /** Opens the system screen where the user allows reminders at the set time. */
    @JavascriptInterface
    public void requestExactReminders() {
      if (Build.VERSION.SDK_INT < 31) return;
      runOnUiThread(() -> {
        if (TrainingAlarmReceiver.canExact(MainActivity.this)) return;
        try {
          Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
          intent.setData(Uri.parse("package:" + getPackageName()));
          startActivity(intent);
        } catch (Exception ignored) {}
      });
    }

    /** Kept so older pages can call it. Chat delivery is FCM, not a wake loop. */
    @JavascriptInterface
    public void startBackgroundChatPoll(double intervalMs) {
      runOnUiThread(() -> ChatPollReceiver.stop(MainActivity.this));
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
        if (value != null && value.contains("1")) return;
        String url = webView.getUrl() == null ? "" : webView.getUrl();
        boolean away = url.contains("privacy.html") || url.contains("terms.html");
        if (!away) {
          moveTaskToBack(true);
          return;
        }
        if (webView.canGoBack()) webView.goBack();
        else webView.evaluateJavascript("location.replace('./')", null);
      }
    );
  }
}
