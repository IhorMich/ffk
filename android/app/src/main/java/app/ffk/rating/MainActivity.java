package app.ffk.rating;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private volatile boolean keepSplash = true;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen splash = SplashScreen.installSplashScreen(this);
    splash.setKeepOnScreenCondition(() -> keepSplash);
    new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplash = false, 5000);
    registerPlugin(GalleryPickerPlugin.class);
    super.onCreate(savedInstanceState);
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView != null) {
      webView.setBackgroundColor(0xFF030308);
      webView.addJavascriptInterface(new SplashBridge(), "FfkSplash");
    }
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

  private class SplashBridge {
    @JavascriptInterface
    public void ready() {
      keepSplash = false;
    }
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
