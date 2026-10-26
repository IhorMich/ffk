package app.tempo;

import android.webkit.WebView;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.Bridge;
import java.util.Collections;
import java.util.List;
import org.json.JSONObject;

/** Google Play subscription for TEMPO Pro. Product id must match the Play Console subscription. */
public final class PlayBilling implements PurchasesUpdatedListener {
  static final String PRODUCT_ID = "tempo_pro";

  private final MainActivity activity;
  private BillingClient client;
  private ProductDetails product;
  private String price = "";
  private boolean ready;
  private boolean connecting;

  PlayBilling(MainActivity activity) {
    this.activity = activity;
  }

  void start() {
    if (client != null) return;
    client = BillingClient.newBuilder(activity)
      .setListener(this)
      .enablePendingPurchases(
        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
      )
      .build();
    connect();
  }

  void refresh() {
    if (client == null) {
      start();
      return;
    }
    if (!ready) {
      connect();
      return;
    }
    queryProduct(false);
    queryPurchases(false);
  }

  void purchase() {
    activity.runOnUiThread(() -> {
      if (client == null || !ready || product == null) {
        refresh();
        emit(false, "unavailable", true, true);
        return;
      }
      String token = offerToken(product);
      if (token.isEmpty()) {
        emit(false, "unavailable", true, true);
        return;
      }
      BillingFlowParams.ProductDetailsParams params = BillingFlowParams.ProductDetailsParams.newBuilder()
        .setProductDetails(product)
        .setOfferToken(token)
        .build();
      BillingFlowParams flow = BillingFlowParams.newBuilder()
        .setProductDetailsParamsList(Collections.singletonList(params))
        .build();
      BillingResult result = client.launchBillingFlow(activity, flow);
      int code = result.getResponseCode();
      if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
        queryPurchases(true);
      } else if (code != BillingClient.BillingResponseCode.OK) {
        emit(false, code == BillingClient.BillingResponseCode.USER_CANCELED ? "cancelled" : "error", true, true);
      }
    });
  }

  @Override
  public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
    int code = result.getResponseCode();
    if (code == BillingClient.BillingResponseCode.OK) {
      applyPurchases(purchases, true);
      return;
    }
    if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
      emit(false, "cancelled", true, false);
      return;
    }
    if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
      queryPurchases(true);
      return;
    }
    emit(false, "error", true, true);
  }

  private void connect() {
    if (client == null || connecting || ready) return;
    connecting = true;
    client.startConnection(new BillingClientStateListener() {
      @Override
      public void onBillingSetupFinished(BillingResult result) {
        connecting = false;
        ready = result.getResponseCode() == BillingClient.BillingResponseCode.OK;
        if (ready) {
          queryProduct(false);
          queryPurchases(false);
        } else {
          emit(false, "unavailable", false, true);
        }
      }

      @Override
      public void onBillingServiceDisconnected() {
        connecting = false;
        ready = false;
      }
    });
  }

  private void queryProduct(boolean userAction) {
    if (client == null || !ready) return;
    QueryProductDetailsParams.Product item = QueryProductDetailsParams.Product.newBuilder()
      .setProductId(PRODUCT_ID)
      .setProductType(BillingClient.ProductType.SUBS)
      .build();
    QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
      .setProductList(Collections.singletonList(item))
      .build();
    client.queryProductDetailsAsync(params, (result, details) -> {
      if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && details != null) {
        for (ProductDetails itemDetails : details) {
          if (PRODUCT_ID.equals(itemDetails.getProductId())) {
            product = itemDetails;
            price = formattedPrice(itemDetails);
            break;
          }
        }
      }
      if (product == null && userAction) emit(false, "unavailable", true, true);
      else emit(false, "price", false, false);
    });
  }

  private void queryPurchases(boolean userAction) {
    if (client == null || !ready) return;
    QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
      .setProductType(BillingClient.ProductType.SUBS)
      .build();
    client.queryPurchasesAsync(params, (result, purchases) -> {
      if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
        if (userAction) emit(false, "error", true, true);
        return;
      }
      applyPurchases(purchases, userAction);
    });
  }

  private void applyPurchases(List<Purchase> purchases, boolean userAction) {
    boolean active = false;
    boolean pending = false;
    if (purchases != null) {
      for (Purchase purchase : purchases) {
        if (purchase.getProducts() == null || !purchase.getProducts().contains(PRODUCT_ID)) continue;
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
          active = true;
          acknowledge(purchase);
        }
      }
    }
    if (active) emit(true, "active", userAction, true);
    else if (pending) emit(false, "pending", userAction, true);
    else emit(false, "none", userAction, true);
  }

  private void acknowledge(Purchase purchase) {
    if (purchase.isAcknowledged() || client == null) return;
    AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
      .setPurchaseToken(purchase.getPurchaseToken())
      .build();
    client.acknowledgePurchase(params, result -> {});
  }

  private void emit(boolean active, String status, boolean userAction, boolean checked) {
    activity.runOnUiThread(() -> {
      Bridge bridge = activity.getBridge();
      WebView webView = bridge != null ? bridge.getWebView() : null;
      if (webView == null) return;
      try {
        JSONObject payload = new JSONObject();
        payload.put("active", active);
        payload.put("price", price == null ? "" : price);
        payload.put("status", status == null ? "" : status);
        payload.put("userAction", userAction);
        payload.put("checked", checked);
        String js = "window.ffkApplyPlayBilling&&window.ffkApplyPlayBilling(" + payload.toString() + ")";
        webView.evaluateJavascript(js, null);
      } catch (Exception ignored) {}
    });
  }

  private static String offerToken(ProductDetails details) {
    List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
    if (offers == null || offers.isEmpty()) return "";
    String token = offers.get(0).getOfferToken();
    return token == null ? "" : token;
  }

  private static String formattedPrice(ProductDetails details) {
    List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
    if (offers == null || offers.isEmpty()) return "";
    ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
    if (offer.getPricingPhases() == null) return "";
    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
    if (phases == null || phases.isEmpty()) return "";
    String formatted = phases.get(phases.size() - 1).getFormattedPrice();
    return formatted == null ? "" : formatted;
  }
}
