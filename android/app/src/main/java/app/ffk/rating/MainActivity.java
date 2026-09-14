package app.ffk.rating;

import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.lang.ref.WeakReference;

public class MainActivity extends BridgeActivity {
  public static class Host {
    private final WeakReference<MainActivity> activity;
    private volatile boolean stay = true;
    private volatile int backSeq = 0;

    Host(MainActivity activity) {
      this.activity = new WeakReference<>(activity);
    }

    @JavascriptInterface
    public void setStay(boolean value) {
      stay = value;
    }

    @JavascriptInterface
    public int takeBack() {
      int n = backSeq;
      backSeq = 0;
      return n;
    }

    @JavascriptInterface
    public void goHome() {
      MainActivity a = activity.get();
      if (a != null) a.runOnUiThread(() -> a.moveTaskToBack(true));
    }

    void requestBack() {
      backSeq++;
    }

    boolean stay() {
      return stay;
    }
  }

  private Host host;
  private OnBackPressedCallback backCallback;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    host = new Host(this);
    attachHost();
    backCallback = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        if (!host.stay()) {
          moveTaskToBack(true);
          return;
        }
        host.requestBack();
      }
    };
    getOnBackPressedDispatcher().addCallback(this, backCallback);
  }

  @Override
  public void onStart() {
    super.onStart();
    attachHost();
    if (backCallback != null) {
      backCallback.remove();
      getOnBackPressedDispatcher().addCallback(this, backCallback);
    }
  }

  private void attachHost() {
    if (getBridge() == null || getBridge().getWebView() == null) return;
    WebView webView = getBridge().getWebView();
    webView.addJavascriptInterface(host, "FfkHost");
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    webView.setHorizontalScrollBarEnabled(false);
  }
}
