import Foundation
import Capacitor
import StoreKit

/// App Store subscriptions. Product ids must match App Store Connect: tempo_pro, tempo_coach.
@objc(FfkBillingPlugin)
public class FfkBillingPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "FfkBillingPlugin"
  public let jsName = "FfkBilling"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "purchaseProduct", returnType: CAPPluginReturnPromise)
  ]

  private static let proId = "tempo_pro"
  private static let coachId = "tempo_coach"
  private var products: [String: Product] = [:]
  private var listenTask: Task<Void, Never>?

  override public func load() {
    listenTask = Task { [weak self] in
      for await _ in Transaction.updates {
        await self?.emitAll(userAction: false)
      }
    }
    Task { await refreshInternal(userAction: false) }
  }

  deinit {
    listenTask?.cancel()
  }

  @objc func refresh(_ call: CAPPluginCall) {
    Task {
      await refreshInternal(userAction: false)
      call.resolve()
    }
  }

  @objc func purchase(_ call: CAPPluginCall) {
    Task {
      await buy(Self.proId, userAction: true)
      call.resolve()
    }
  }

  @objc func purchaseProduct(_ call: CAPPluginCall) {
    let id = call.getString("productId") ?? Self.proId
    Task {
      await buy(id, userAction: true)
      call.resolve()
    }
  }

  private func refreshInternal(userAction: Bool) async {
    do {
      let list = try await Product.products(for: [Self.proId, Self.coachId])
      var map: [String: Product] = [:]
      for item in list { map[item.id] = item }
      products = map
    } catch {
      products = [:]
    }
    await emitAll(userAction: userAction)
  }

  private func buy(_ productId: String, userAction: Bool) async {
    if products[productId] == nil {
      await refreshInternal(userAction: false)
    }
    guard let product = products[productId] else {
      emit(productId, active: false, status: "unavailable", userAction: userAction, checked: true)
      return
    }
    do {
      let result = try await product.purchase()
      switch result {
      case .success(let verification):
        if case .verified(let transaction) = verification {
          await transaction.finish()
          emit(productId, active: true, status: "active", userAction: userAction, checked: true)
          await emitAll(userAction: false)
        } else {
          emit(productId, active: false, status: "error", userAction: userAction, checked: true)
        }
      case .userCancelled:
        emit(productId, active: false, status: "cancelled", userAction: userAction, checked: false)
      case .pending:
        emit(productId, active: false, status: "pending", userAction: userAction, checked: true)
      @unknown default:
        emit(productId, active: false, status: "error", userAction: userAction, checked: true)
      }
    } catch {
      emit(productId, active: false, status: "error", userAction: userAction, checked: true)
    }
  }

  private func emitAll(userAction: Bool) async {
    for id in [Self.proId, Self.coachId] {
      let active = await hasEntitlement(id)
      emit(id, active: active, status: active ? "active" : "none", userAction: userAction, checked: true)
    }
  }

  private func hasEntitlement(_ productId: String) async -> Bool {
    for await result in Transaction.currentEntitlements {
      if case .verified(let tx) = result, tx.productID == productId {
        return true
      }
    }
    return false
  }

  private func emit(_ productId: String, active: Bool, status: String, userAction: Bool, checked: Bool) {
    let product = products[productId]
    var price = ""
    var priceMonth = ""
    var priceYear = ""
    if let product {
      price = product.displayPrice
      if let sub = product.subscription {
        switch sub.subscriptionPeriod.unit {
        case .year:
          priceYear = product.displayPrice
        default:
          priceMonth = product.displayPrice
        }
      } else {
        priceMonth = product.displayPrice
      }
    }
    let payload: [String: Any] = [
      "product": productId,
      "active": active,
      "price": price,
      "priceMonth": priceMonth,
      "priceYear": priceYear,
      "status": status,
      "userAction": userAction,
      "checked": checked
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8) else { return }
    let js = "window.ffkApplyPlayBilling&&window.ffkApplyPlayBilling(\(json))"
    DispatchQueue.main.async {
      self.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
    }
  }
}
