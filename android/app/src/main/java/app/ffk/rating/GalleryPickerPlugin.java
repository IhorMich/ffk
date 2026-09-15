package app.ffk.rating;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * The system photo picker is served by Google Photos on this phone, so the
 * gallery of the device itself is unreachable through it. ACTION_PICK still
 * offers every gallery app installed, which is what parents expect to see.
 */
@CapacitorPlugin(name = "GalleryPicker")
public class GalleryPickerPlugin extends Plugin {

  private static final int MAX_SIDE = 1600;

  @PluginMethod
  public void pickImage(PluginCall call) {
    Intent pick = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
    pick.setType("image/*");
    try {
      // Package visibility rules make resolveActivity unreliable, so let the
      // launch itself tell us whether a gallery app exists.
      startActivityForResult(call, pick, "pickResult");
    } catch (ActivityNotFoundException e) {
      call.reject("no gallery app", "NO_PICKER");
    }
  }

  /**
   * A download link does nothing inside the web view, so the card is written
   * straight into the gallery, where a parent looks for pictures anyway.
   */
  @PluginMethod
  public void saveImage(PluginCall call) {
    String dataUrl = call.getString("dataUrl", "");
    String name = call.getString("filename", "ffk_card.png");
    int comma = dataUrl.indexOf(',');
    if (comma < 0) {
      call.reject("no image data", "NO_DATA");
      return;
    }
    try {
      byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
      ContentValues values = new ContentValues();
      values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
      values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Matchcard");
      }
      ContentResolver resolver = getContext().getContentResolver();
      dropOldCopy(resolver, name);
      Uri target = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
      if (target == null) {
        call.reject("gallery rejected the file", "NO_TARGET");
        return;
      }
      try (OutputStream out = resolver.openOutputStream(target)) {
        if (out == null) {
          call.reject("cannot write", "NO_STREAM");
          return;
        }
        out.write(bytes);
      }
      JSObject ret = new JSObject();
      ret.put("uri", target.toString());
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() == null ? "save failed" : e.getMessage(), "SAVE");
    }
  }

  @ActivityCallback
  private void pickResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    Uri uri = result.getData() != null ? result.getData().getData() : null;
    if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
      call.reject("cancelled", "CANCELLED");
      return;
    }
    try {
      String dataUrl = readAsJpegDataUrl(uri);
      if (dataUrl == null) {
        call.reject("cannot decode image", "DECODE");
        return;
      }
      JSObject ret = new JSObject();
      ret.put("dataUrl", dataUrl);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() == null ? "read failed" : e.getMessage(), "READ");
    }
  }

  // Saving the same card twice should replace it instead of leaving
  // "card (1)", "card (2)" behind.
  private void dropOldCopy(ContentResolver resolver, String name) {
    String where = MediaStore.Images.Media.DISPLAY_NAME + "=?";
    try (
      Cursor c = resolver.query(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        new String[] { MediaStore.Images.Media._ID },
        where,
        new String[] { name },
        null
      )
    ) {
      while (c != null && c.moveToNext()) {
        Uri old = Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(c.getLong(0)));
        try {
          resolver.delete(old, null, null);
        } catch (Exception ignored) {}
      }
    } catch (Exception ignored) {}
  }

  private String readAsJpegDataUrl(Uri uri) throws Exception {
    BitmapFactory.Options bounds = new BitmapFactory.Options();
    bounds.inJustDecodeBounds = true;
    try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
      BitmapFactory.decodeStream(in, null, bounds);
    }
    BitmapFactory.Options opts = new BitmapFactory.Options();
    opts.inSampleSize = sampleSize(Math.max(bounds.outWidth, bounds.outHeight));
    Bitmap bitmap;
    try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
      bitmap = BitmapFactory.decodeStream(in, null, opts);
    }
    if (bitmap == null) return null;
    bitmap = rotate(bitmap, degreesOf(uri));
    bitmap = shrink(bitmap);
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    bitmap.compress(Bitmap.CompressFormat.JPEG, 86, out);
    bitmap.recycle();
    return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
  }

  private int sampleSize(int side) {
    int sample = 1;
    while (side / (sample * 2) >= MAX_SIDE) sample *= 2;
    return sample;
  }

  private Bitmap shrink(Bitmap bitmap) {
    int side = Math.max(bitmap.getWidth(), bitmap.getHeight());
    if (side <= MAX_SIDE) return bitmap;
    float k = (float) MAX_SIDE / side;
    Bitmap scaled = Bitmap.createScaledBitmap(
      bitmap,
      Math.max(1, Math.round(bitmap.getWidth() * k)),
      Math.max(1, Math.round(bitmap.getHeight() * k)),
      true
    );
    if (scaled != bitmap) bitmap.recycle();
    return scaled;
  }

  private Bitmap rotate(Bitmap bitmap, int degrees) {
    if (degrees == 0) return bitmap;
    Matrix matrix = new Matrix();
    matrix.postRotate(degrees);
    Bitmap turned = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
    if (turned != bitmap) bitmap.recycle();
    return turned;
  }

  // Gallery apps expose the angle through MediaStore; documents and cloud
  // copies only carry it in the EXIF header.
  private int degreesOf(Uri uri) {
    try (
      Cursor c = getContext()
        .getContentResolver()
        .query(uri, new String[] { MediaStore.Images.Media.ORIENTATION }, null, null, null)
    ) {
      if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getInt(0);
    } catch (Exception ignored) {}
    try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
      if (in == null) return 0;
      int tag = new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
      if (tag == ExifInterface.ORIENTATION_ROTATE_90) return 90;
      if (tag == ExifInterface.ORIENTATION_ROTATE_180) return 180;
      if (tag == ExifInterface.ORIENTATION_ROTATE_270) return 270;
    } catch (Exception ignored) {}
    return 0;
  }
}
