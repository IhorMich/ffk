package app.ffk.rating;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
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
  private OnBackPressedCallback backCallback;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    attachHost();
    backCallback = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
          webView.evaluateJavascript(
            "(function(){try{return window.handleAppBack&&window.handleAppBack()?'1':'0';}catch(e){return '1';}})()",
            null
          );
        }
        if (!host.stay()) moveTaskToBack(true);
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
    webView.clearHistory();
  }
}
