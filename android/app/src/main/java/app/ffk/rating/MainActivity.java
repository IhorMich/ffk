package app.ffk.rating;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private OnBackPressedCallback backCallback;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    backCallback = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
          moveTaskToBack(true);
          return;
        }
        webView.evaluateJavascript(
          "(function(){try{return window.handleAppBack&&window.handleAppBack()?'1':'0';}catch(e){return '0';}})()",
          value -> {
            boolean handled = value != null && value.contains("1");
            if (!handled) moveTaskToBack(true);
          }
        );
      }
    };
    getOnBackPressedDispatcher().addCallback(this, backCallback);
  }

  @Override
  public void onStart() {
    super.onStart();
    if (backCallback != null) {
      // Re-register last so this wins over Capacitor App's WebView.goBack().
      backCallback.remove();
      getOnBackPressedDispatcher().addCallback(this, backCallback);
    }
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().clearHistory();
    }
  }
}
