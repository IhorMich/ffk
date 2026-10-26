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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/** Google Play subscriptions. Product ids must match the Play Console subscriptions. */
public final class PlayBilling implements PurchasesUpdatedListener {
  static final String PRO = "tempo_pro";
  static final String COACH = "tempo_coach";
  private static final List<String> PRODUCTS = Arrays.asList(PRO, COACH);

  private final MainActivity activity;
  private BillingClient client;
  private final Map<String, ProductDetails> products = new HashMap<>();
  private boolean ready;
  private boolean connecting;
  private String pendingProduct = "";

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
    queryProducts(false);
    queryPurchases(false);
  }

  void purchase(String productId, String period) {
    final String id = productId == null || productId.isEmpty() ? PRO : productId;
    final String plan = period == null ? "" : period;
    activity.runOnUiThread(() -> {
      ProductDetails details = products.get(id);
      if (client == null || !ready || details == null) {
        pendingProduct = id;
        refresh();
        emit(id, false, "unavailable", true, true);
        return;
      }
      ProductDetails.SubscriptionOfferDetails offer = offerFor(details, plan);
      if (offer == null || offer.getOfferToken() == null || offer.getOfferToken().isEmpty()) {
        emit(id, false, "unavailable", true, true);
        return;
      }
      pendingProduct = id;
      BillingFlowParams.ProductDetailsParams params = BillingFlowParams.ProductDetailsParams.newBuilder()
        .setProductDetails(details)
        .setOfferToken(offer.getOfferToken())
        .build();
      BillingFlowParams flow = BillingFlowParams.newBuilder()
        .setProductDetailsParamsList(Arrays.asList(params))
        .build();
      BillingResult result = client.launchBillingFlow(activity, flow);
      int code = result.getResponseCode();
      if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
        queryPurchases(true);
      } else if (code != BillingClient.BillingResponseCode.OK) {
        emit(id, false, code == BillingClient.BillingResponseCode.USER_CANCELED ? "cancelled" : "error", true, true);
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
    String id = pendingProduct.isEmpty() ? PRO : pendingProduct;
    if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
      emit(id, false, "cancelled", true, false);
      return;
    }
    if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
      queryPurchases(true);
      return;
    }
    emit(id, false, "error", true, true);
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
          queryProducts(false);
          queryPurchases(false);
        } else {
          for (String id : PRODUCTS) emit(id, false, "unavailable", false, true);
        }
      }

      @Override
      public void onBillingServiceDisconnected() {
        connecting = false;
        ready = false;
      }
    });
  }

  private void queryProducts(boolean userAction) {
    if (client == null || !ready) return;
    List<QueryProductDetailsParams.Product> items = new ArrayList<>();
    for (String id : PRODUCTS) {
      items.add(QueryProductDetailsParams.Product.newBuilder()
        .setProductId(id)
        .setProductType(BillingClient.ProductType.SUBS)
        .build());
    }
    QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
      .setProductList(items)
      .build();
    client.queryProductDetailsAsync(params, (result, details) -> {
      if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && details != null) {
        for (ProductDetails item : details) {
          if (item.getProductId() != null) products.put(item.getProductId(), item);
        }
      }
      for (String id : PRODUCTS) {
        if (products.get(id) == null && userAction && id.equals(pendingProduct)) {
          emit(id, false, "unavailable", true, true);
        } else {
          emit(id, false, "price", false, false);
        }
      }
    });
  }

  private void queryPurchases(boolean userAction) {
    if (client == null || !ready) return;
    QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
      .setProductType(BillingClient.ProductType.SUBS)
      .build();
    client.queryPurchasesAsync(params, (result, purchases) -> {
      if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
        if (userAction) {
          String id = pendingProduct.isEmpty() ? PRO : pendingProduct;
          emit(id, false, "error", true, true);
        }
        return;
      }
      applyPurchases(purchases, userAction);
    });
  }

  private void applyPurchases(List<Purchase> purchases, boolean userAction) {
    for (String id : PRODUCTS) {
      boolean active = false;
      boolean pending = false;
      if (purchases != null) {
        for (Purchase purchase : purchases) {
          if (purchase.getProducts() == null || !purchase.getProducts().contains(id)) continue;
          if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
          if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
            active = true;
            acknowledge(purchase);
          }
        }
      }
      boolean touched = userAction && (id.equals(pendingProduct) || pendingProduct.isEmpty());
      if (active) emit(id, true, "active", touched, true);
      else if (pending) emit(id, false, "pending", touched, true);
      else emit(id, false, "none", touched, true);
    }
  }

  private void acknowledge(Purchase purchase) {
    if (purchase.isAcknowledged() || client == null) return;
    AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
      .setPurchaseToken(purchase.getPurchaseToken())
      .build();
    client.acknowledgePurchase(params, result -> {});
  }

  private void emit(String productId, boolean active, String status, boolean userAction, boolean checked) {
    activity.runOnUiThread(() -> {
      Bridge bridge = activity.getBridge();
      WebView webView = bridge != null ? bridge.getWebView() : null;
      if (webView == null) return;
      try {
        ProductDetails details = products.get(productId);
        JSONObject payload = new JSONObject();
        payload.put("product", productId == null ? "" : productId);
        payload.put("active", active);
        payload.put("price", priceOf(details, ""));
        payload.put("priceMonth", priceOf(details, "month"));
        payload.put("priceYear", priceOf(details, "year"));
        payload.put("status", status == null ? "" : status);
        payload.put("userAction", userAction);
        payload.put("checked", checked);
        String js = "window.ffkApplyPlayBilling&&window.ffkApplyPlayBilling(" + payload.toString() + ")";
        webView.evaluateJavascript(js, null);
      } catch (Exception ignored) {}
    });
  }

  private static ProductDetails.SubscriptionOfferDetails offerFor(ProductDetails details, String period) {
    List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
    if (offers == null || offers.isEmpty()) return null;
    if (period == null || period.isEmpty() || "month".equals(period)) {
      ProductDetails.SubscriptionOfferDetails month = findPeriod(offers, "month");
      if (month != null) return month;
      return period == null || period.isEmpty() ? offers.get(0) : null;
    }
    if ("year".equals(period)) return findPeriod(offers, "year");
    return offers.get(0);
  }

  private static ProductDetails.SubscriptionOfferDetails findPeriod(
    List<ProductDetails.SubscriptionOfferDetails> offers,
    String period
  ) {
    for (ProductDetails.SubscriptionOfferDetails offer : offers) {
      String billing = billingPeriod(offer);
      if ("month".equals(period) && "P1M".equals(billing)) return offer;
      if ("year".equals(period) && ("P1Y".equals(billing) || "P12M".equals(billing))) return offer;
    }
    return null;
  }

  private static String priceOf(ProductDetails details, String period) {
    if (details == null) return "";
    ProductDetails.SubscriptionOfferDetails offer = offerFor(details, period);
    if (offer == null || offer.getPricingPhases() == null) return "";
    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
    if (phases == null || phases.isEmpty()) return "";
    String formatted = phases.get(phases.size() - 1).getFormattedPrice();
    return formatted == null ? "" : formatted;
  }

  private static String billingPeriod(ProductDetails.SubscriptionOfferDetails offer) {
    if (offer.getPricingPhases() == null) return "";
    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
    if (phases == null || phases.isEmpty()) return "";
    String period = phases.get(phases.size() - 1).getBillingPeriod();
    return period == null ? "" : period;
  }
}
