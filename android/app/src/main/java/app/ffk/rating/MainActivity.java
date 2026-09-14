package app.ffk.rating;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  public static class Host {
    private volatile boolean stay = true;

    @JavascriptInterface
    public void setStay(boolean value) {
      stay = value;
    }

    boolean stay() {
      return stay;
    }
  }

  private final Host host = new Host();
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private OnBackPressedCallback backCallback;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    attachHost();
    backCallback = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        if (!host.stay()) {
          moveTaskToBack(true);
          return;
        }
        runInAppBack();
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

  private void runInAppBack() {
    Bridge bridge = getBridge();
    if (bridge == null) return;
    // Run after the system gesture finishes — Samsung drops JS during the swipe.
    mainHandler.postDelayed(() -> bridge.eval(
      "(function(){try{window.handleAppBack&&window.handleAppBack()}catch(e){}})()",
      null
    ), 32);
  }

  private void attachHost() {
    if (getBridge() == null || getBridge().getWebView() == null) return;
    WebView webView = getBridge().getWebView();
    webView.addJavascriptInterface(host, "FfkHost");
  }
}
