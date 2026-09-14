package app.ffk.rating;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Added after the plugins, so this callback is the top of the stack and gets
    // both the back key and the edge gesture.
    getOnBackPressedDispatcher()
      .addCallback(
        this,
        new OnBackPressedCallback(true) {
          @Override
          public void handleOnBackPressed() {
            handleBack();
          }
        }
      );
  }

  private void handleBack() {
    Bridge bridge = getBridge();
    WebView webView = bridge != null ? bridge.getWebView() : null;
    if (webView == null) {
      moveTaskToBack(true);
      return;
    }
    // The web layer closes its own overlays and tabs; "0" means there is
    // nothing left to close, so the app goes to the background.
    webView.evaluateJavascript(
      "(window.ffkBack&&window.ffkBack())?'1':'0'",
      value -> {
        if (value == null || !value.contains("1")) moveTaskToBack(true);
      }
    );
  }
}
