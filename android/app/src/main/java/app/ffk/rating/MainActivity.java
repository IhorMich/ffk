package app.ffk.rating;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
          moveTaskToBack(true);
          return;
        }
        getBridge().getWebView().evaluateJavascript(
          "(function(){try{return window.handleAppBack&&window.handleAppBack()?'1':'0';}catch(e){return '0';}})()",
          value -> {
            boolean handled = value != null && value.contains("1");
            if (!handled) moveTaskToBack(true);
          }
        );
      }
    });
  }
}
