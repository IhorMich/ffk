package app.ffk.rating;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class TrainingAlarmReceiver extends BroadcastReceiver {
  private static final String ALERT_CHANNEL = "matchcard_alerts_v2";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
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
      .setContentTitle(title == null || title.isEmpty() ? "Matchcard" : title)
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

  private void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    if (nm.getNotificationChannel(ALERT_CHANNEL) != null) return;
    NotificationChannel channel = new NotificationChannel(
      ALERT_CHANNEL,
      "Matchcard alerts",
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
