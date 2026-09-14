package app.ffk.rating;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private final Handler mainHandler = new Handler(Looper.getMainLooper());

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && webView.canGoBack()) {
          webView.goBack();
          mainHandler.postDelayed(() -> {
            Bridge bridge = getBridge();
            if (bridge != null) {
              bridge.eval("window.requestAppBack&&window.requestAppBack()", null);
            }
          }, 80);
          return;
        }
        moveTaskToBack(true);
      }
    });
  }
}
