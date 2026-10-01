package app.ffk.rating;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

/**
 * Wakes the process while Matchcard is backgrounded and asks MainActivity
 * to run a JS chat poll. WebView setInterval is throttled/frozen in background;
 * AlarmManager is not.
 */
public class ChatPollReceiver extends BroadcastReceiver {
  public static final String ACTION = "app.ffk.rating.CHAT_POLL";
  public static final String PREFS = "ffk_chat_poll";
  public static final String KEY_ENABLED = "enabled";
  public static final String KEY_INTERVAL = "interval_ms";
  private static final long DEFAULT_INTERVAL_MS = 15000L;
  private static final int REQ = 91001;

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    if (action == null) return;
    if (!ACTION.equals(action) && !Intent.ACTION_BOOT_COMPLETED.equals(action)) return;

    SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    if (!sp.getBoolean(KEY_ENABLED, false)) return;

    MainActivity activity = MainActivity.getAlive();
    if (activity != null) {
      activity.runBackgroundChatPoll();
    }

    long interval = sp.getLong(KEY_INTERVAL, DEFAULT_INTERVAL_MS);
    if (interval < 8000L) interval = 8000L;
    scheduleNext(context, interval);
  }

  static void start(Context context, long intervalMs) {
    long interval = intervalMs > 0 ? intervalMs : DEFAULT_INTERVAL_MS;
    if (interval < 8000L) interval = 8000L;
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean(KEY_ENABLED, true)
      .putLong(KEY_INTERVAL, interval)
      .apply();
    scheduleNext(context, interval);
  }

  static void stop(Context context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean(KEY_ENABLED, false)
      .apply();
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am != null) am.cancel(pending(context));
  }

  static void scheduleNext(Context context, long intervalMs) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    PendingIntent pi = pending(context);
    long trigger = SystemClock.elapsedRealtime() + intervalMs;
    try {
      if (Build.VERSION.SDK_INT >= 23) {
        am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pi);
      } else {
        am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pi);
      }
    } catch (SecurityException e) {
      am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pi);
    }
  }

  private static PendingIntent pending(Context context) {
    Intent intent = new Intent(context, ChatPollReceiver.class);
    intent.setAction(ACTION);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(context, REQ, intent, flags);
  }
}
