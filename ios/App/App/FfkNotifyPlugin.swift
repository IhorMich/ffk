import Foundation
import Capacitor
import UserNotifications

/// Local training/match reminders. Chat arrives via FCM/APNs, not a wake poll.
@objc(FfkNotifyPlugin)
public class FfkNotifyPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "FfkNotifyPlugin"
  public let jsName = "FfkNotify"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "showChat", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "showChatKind", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "showChatBroadcast", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "canExactReminders", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "requestExactReminders", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "startBackgroundChatPoll", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stopBackgroundChatPoll", returnType: CAPPluginReturnPromise)
  ]

  private let center = UNUserNotificationCenter.current()

  @objc func show(_ call: CAPPluginCall) {
    post(
      title: call.getString("title") ?? "TEMPO",
      body: call.getString("body") ?? "",
      playerId: "",
      chatKind: "",
      broadcastId: ""
    )
    call.resolve()
  }

  @objc func showChat(_ call: CAPPluginCall) {
    post(
      title: call.getString("title") ?? "TEMPO",
      body: call.getString("body") ?? "",
      playerId: call.getString("playerId") ?? "",
      chatKind: "",
      broadcastId: ""
    )
    call.resolve()
  }

  @objc func showChatKind(_ call: CAPPluginCall) {
    post(
      title: call.getString("title") ?? "TEMPO",
      body: call.getString("body") ?? "",
      playerId: call.getString("playerId") ?? "",
      chatKind: call.getString("chatKind") ?? "",
      broadcastId: ""
    )
    call.resolve()
  }

  @objc func showChatBroadcast(_ call: CAPPluginCall) {
    post(
      title: call.getString("title") ?? "TEMPO",
      body: call.getString("body") ?? "",
      playerId: call.getString("playerId") ?? "",
      chatKind: call.getString("chatKind") ?? "",
      broadcastId: call.getString("broadcastId") ?? ""
    )
    call.resolve()
  }

  @objc func schedule(_ call: CAPPluginCall) {
    let id = call.getString("id") ?? ""
    let title = call.getString("title") ?? "TEMPO"
    let body = call.getString("body") ?? ""
    let whenMs = call.getDouble("whenMs") ?? 0
    guard !id.isEmpty, whenMs > Date().timeIntervalSince1970 * 1000 else {
      call.resolve()
      return
    }
    center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
      let content = UNMutableNotificationContent()
      content.title = title
      content.body = body
      content.sound = .default
      let seconds = max(1.0, (whenMs / 1000.0) - Date().timeIntervalSince1970)
      let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
      let req = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
      self.center.add(req, withCompletionHandler: nil)
      call.resolve()
    }
  }

  @objc func cancel(_ call: CAPPluginCall) {
    let id = call.getString("id") ?? ""
    if !id.isEmpty {
      center.removePendingNotificationRequests(withIdentifiers: [id])
      center.removeDeliveredNotifications(withIdentifiers: [id])
    }
    call.resolve()
  }

  @objc func canExactReminders(_ call: CAPPluginCall) {
    call.resolve(["value": true])
  }

  @objc func requestExactReminders(_ call: CAPPluginCall) {
    center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      call.resolve(["value": granted])
    }
  }

  @objc func startBackgroundChatPoll(_ call: CAPPluginCall) {
    call.resolve()
  }

  @objc func stopBackgroundChatPoll(_ call: CAPPluginCall) {
    call.resolve()
  }

  private func post(title: String, body: String, playerId: String, chatKind: String, broadcastId: String) {
    center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      guard granted else { return }
      let content = UNMutableNotificationContent()
      content.title = title.isEmpty ? "TEMPO" : title
      content.body = body
      content.sound = .default
      var info: [String: String] = [:]
      if !playerId.isEmpty { info["team_player_id"] = playerId }
      if !chatKind.isEmpty { info["chat_kind"] = chatKind }
      if !broadcastId.isEmpty { info["broadcast_id"] = broadcastId }
      content.userInfo = info
      let id: String
      if !broadcastId.isEmpty { id = "bc_" + broadcastId }
      else if !playerId.isEmpty { id = "chat_" + playerId }
      else { id = "alert_" + UUID().uuidString }
      let req = UNNotificationRequest(identifier: id, content: content, trigger: nil)
      self.center.add(req, withCompletionHandler: nil)
    }
  }
}
