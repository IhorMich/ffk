package app.ffk.rating;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  public static class Host {
    private volatile boolean stay = true;
    private volatile int backSeq = 0;

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

    void requestBack() {
      backSeq++;
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
  }
}
