package app.tempo;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Cancels the old background chat wake loop.
 * Chat notifications are delivered by FCM, not by an exact alarm.
 */
public class ChatPollReceiver extends BroadcastReceiver {
  public static final String ACTION = "app.tempo.CHAT_POLL";
  public static final String PREFS = "ffk_chat_poll";
  private static final int REQ = 91001;

  @Override
  public void onReceive(Context context, Intent intent) {
    if (context == null) return;
    stop(context);
  }

  static void start(Context context, long intervalMs) {
    stop(context);
  }

  static void stop(Context context) {
    if (context == null) return;
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean("enabled", false)
      .apply();
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am != null) am.cancel(pending(context));
  }

  private static PendingIntent pending(Context context) {
    Intent intent = new Intent(context, ChatPollReceiver.class);
    intent.setAction(ACTION);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(context, REQ, intent, flags);
  }
}
