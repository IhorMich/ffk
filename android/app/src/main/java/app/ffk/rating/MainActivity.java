package app.ffk.rating;

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

public class MainActivity extends BridgeActivity {

  private static final String ALERT_CHANNEL = "matchcard_alerts";
  private static int notifySeq = 1000;
  private volatile boolean keepSplash = true;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen splash = SplashScreen.installSplashScreen(this);
    splash.setKeepOnScreenCondition(() -> keepSplash);
    splash.setOnExitAnimationListener(view -> view.remove());
    new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplash = false, 5000);
    registerPlugin(GalleryPickerPlugin.class);
    super.onCreate(savedInstanceState);
    ensureAlertChannel();
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
    // Added after the plugins, so this callback is the top of the stack and gets
    // both the back key and the edge gesture.
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
  }

  private void ensureAlertChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    NotificationChannel existing = nm.getNotificationChannel(ALERT_CHANNEL);
    if (existing != null) return;
    NotificationChannel channel = new NotificationChannel(
      ALERT_CHANNEL,
      "Matchcard alerts",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Match invites and player cards");
    channel.enableVibration(true);
    channel.enableLights(true);
    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    AudioAttributes attrs = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build();
    channel.setSound(sound, attrs);
    // Notification stream (not ringer) — still plays when the phone is on silent/vibrate.
    nm.createNotificationChannel(channel);
  }

  private void postAlert(String title, String body) {
    ensureAlertChannel();
    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, flags);
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL)
      .setSmallIcon(getApplicationInfo().icon)
      .setContentTitle(title == null || title.isEmpty() ? "Matchcard" : title)
      .setContentText(body == null ? "" : body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body == null ? "" : body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setAutoCancel(true)
      .setContentIntent(pi)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    try {
      NotificationManagerCompat.from(this).notify(++notifySeq, builder.build());
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
      runOnUiThread(() -> postAlert(title, body));
    }
  }

  private void handleBack() {
    Bridge bridge = getBridge();
    WebView webView = bridge != null ? bridge.getWebView() : null;
    if (webView == null) {
      moveTaskToBack(true);
      return;
    }
    // The web layer closes its own overlays and tabs; "0" means there is
    // nothing left to close, so the app goes to the background.
    webView.evaluateJavascript(
      "(window.ffkBack&&window.ffkBack())?'1':'0'",
      value -> {
        if (value == null || !value.contains("1")) moveTaskToBack(true);
      }
    );
  }
}
