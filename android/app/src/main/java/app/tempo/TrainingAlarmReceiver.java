package app.tempo;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Map;

/** One-shot reminder for a training or match the user turned on. */
public class TrainingAlarmReceiver extends BroadcastReceiver {
  private static final String ALERT_CHANNEL = "matchcard_alerts_v2";
  static final String PREFS = "ffk_train_alarms";
  private static final String ACTION = "app.tempo.TRAINING_REMINDER";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || context == null) return;
    if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
      restore(context);
      return;
    }
    String title = intent.getStringExtra("title");
    String body = intent.getStringExtra("body");
    ensureChannel(context);
    Intent open = new Intent(context, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    PendingIntent pi = PendingIntent.getActivity(context, 0, open, flags);
    Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALERT_CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title == null || title.isEmpty() ? "TEMPO" : title)
      .setContentText(body == null ? "" : body)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(body == null ? "" : body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setAutoCancel(true)
      .setContentIntent(pi)
      .setSound(sound)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    try {
      int id = Math.abs((intent.getStringExtra("id") == null ? "train" : intent.getStringExtra("id")).hashCode());
      NotificationManagerCompat.from(context).notify(id, builder.build());
    } catch (SecurityException e) {
      // POST_NOTIFICATIONS not granted
    }
  }

  static void schedule(Context context, String id, String title, String body, long at) {
    if (context == null || id == null || id.isEmpty() || at <= System.currentTimeMillis()) return;
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    PendingIntent pi = pending(context, id, title, body);
    try {
      if (canExact(am)) {
        if (Build.VERSION.SDK_INT >= 23) {
          am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
          am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
        }
      } else if (Build.VERSION.SDK_INT >= 23) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
      } else {
        am.set(AlarmManager.RTC_WAKEUP, at, pi);
      }
    } catch (SecurityException e) {
      if (Build.VERSION.SDK_INT >= 23) {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
      } else {
        am.set(AlarmManager.RTC_WAKEUP, at, pi);
      }
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putLong(id, at)
      .putString(id + "_title", title == null ? "" : title)
      .putString(id + "_body", body == null ? "" : body)
      .apply();
  }

  static void cancel(Context context, String id) {
    if (context == null || id == null || id.isEmpty()) return;
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am != null) am.cancel(pending(context, id, "", ""));
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .remove(id).remove(id + "_title").remove(id + "_body").apply();
  }

  static boolean canExact(Context context) {
    if (context == null) return false;
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    return canExact(am);
  }

  private static boolean canExact(AlarmManager am) {
    if (am == null) return false;
    if (Build.VERSION.SDK_INT < 31) return true;
    return am.canScheduleExactAlarms();
  }

  /** After reboot, put back reminders that were still in the future. */
  static void restore(Context context) {
    SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    Map<String, ?> all = sp.getAll();
    long now = System.currentTimeMillis();
    for (Map.Entry<String, ?> entry : all.entrySet()) {
      String key = entry.getKey();
      if (key.endsWith("_title") || key.endsWith("_body")) continue;
      if (!(entry.getValue() instanceof Long)) continue;
      long at = (Long) entry.getValue();
      if (at <= now) {
        sp.edit().remove(key).remove(key + "_title").remove(key + "_body").apply();
        continue;
      }
      schedule(
        context,
        key,
        sp.getString(key + "_title", "TEMPO"),
        sp.getString(key + "_body", ""),
        at
      );
    }
  }

  private static PendingIntent pending(Context context, String id, String title, String body) {
    Intent intent = new Intent(context, TrainingAlarmReceiver.class);
    intent.setAction(ACTION);
    intent.putExtra("id", id);
    intent.putExtra("title", title == null ? "TEMPO" : title);
    intent.putExtra("body", body == null ? "" : body);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(context, Math.abs(id.hashCode()), intent, flags);
  }

  private void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    if (nm.getNotificationChannel(ALERT_CHANNEL) != null) return;
    NotificationChannel channel = new NotificationChannel(
      ALERT_CHANNEL,
      "TEMPO alerts",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Match invites and training reminders");
    Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
    AudioAttributes attrs = new AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build();
    channel.setSound(sound, attrs);
    nm.createNotificationChannel(channel);
  }
}
