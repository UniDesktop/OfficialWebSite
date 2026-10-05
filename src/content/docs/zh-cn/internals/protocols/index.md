---
title: 协议概览
description: 四种底层协议各自的职责，以及它们如何拼成跨平台的外观与托盘能力。
---

UDA 在 Linux 与 Windows 上落到不同的底层协议。本分区逐一记录这些协议的接口细节、已知陷阱与 UDA 的取舍；本页先说明它们各自负责什么，以及互相之间如何衔接。

## 一览

| 协议 | 平台 | 承担的能力 |
|------|------|------------|
| XDG Desktop Portal | Linux | 降级链 Tier 1；UDA 目前只用其中的 `Settings` 接口读取深浅色与强调色 |
| StatusNotifierItem（SNI） | Linux | 托盘图标与激活事件 |
| `com.canonical.dbusmenu` | Linux | 托盘上下文菜单，由 shell 主动拉取 |
| `Shell_NotifyIconW` | Windows | 托盘图标与菜单，本地 `HMENU` 配合专用工作线程 |

## Linux：Portal 排在最前，但常常不够

Portal 是 freedesktop 的标准沙箱化接口层，由各桌面环境自己实现，应用通过 D-Bus 调用，不必区分背后是 GNOME 还是 KDE。UDA 把它作为降级链的 **Tier 1**：接口存在且已导出就用它，失败再落到原生 IPC 与 CLI 工具。

实际覆盖差异很大：GNOME 42+ 较完整，KDE 与 XFCE 视版本部分实现，Hyprland / Sway 通常没有 Portal。

需要注意，Portal 里虽然有 `Wallpaper` 与 `Inhibit` 接口，但 UDA 的后端并未使用它们——壁纸直接走桌面原生通道与 CLI 工具链，防休眠调用会话总线上的 `org.freedesktop.ScreenSaver.Inhibit`。目前唯一真正经由 Portal 的能力是外观设置。

## Linux 托盘：SNI 与 DBusMenu 是一对

托盘在 Wayland 上只能走 D-Bus：旧的 XEmbed 托盘依赖一个全局 X 窗口，而 Wayland 不具备这个前提。

两个协议分工明确，缺一不可：

- **SNI** 负责图标本身与激活事件——点击、滚轮、上下文菜单请求。
- **DBusMenu** 负责菜单内容，方向是 shell 主动拉取，而不是由 item 推送。

因此菜单状态的维护责任落在 item 一侧：用户操作后 item 必须广播 `ItemsPropertiesUpdated`，shell 才会重绘复选框。漏发这一步的典型表现是「第一次点击有响应，再点又回到旧状态」。

## Windows 托盘：一个窗口，一条线程

`Shell_NotifyIconW` 的 `NOTIFYICONDATAW` 中含有一个 `hWnd`，shell 通过它投递回调消息，而窗口归属于创建它的线程。UDA 因此起一个专用工作线程，创建 message-only 窗口并运行自己的消息循环；宿主侧的每次状态变更都以消息转发过去，既不占用宿主的事件循环，也满足「同一线程拥有窗口」的约束。

菜单不走协议：本地 `HMENU` 配合 `TrackPopupMenuEx` 直接弹出。两种托盘机制的差异由 `TrayManager` trait 吸收，调用方看到的是同一套 `TrayMenu` 模型。

## 阅读顺序

- [XDG Desktop Portal](/zh-cn/internals/protocols/portal/)——Tier 1 的接口布局、探测方式与覆盖缺口
- [StatusNotifierItem（SNI）](/zh-cn/internals/protocols/statusnotifieritem/)——Linux 托盘的图标与激活协议
- [DBusMenu](/zh-cn/internals/protocols/dbusmenu/)——托盘菜单的拉取式协议与 id 分配
- [Shell_NotifyIconW](/zh-cn/internals/protocols/notifyicon/)——Windows 侧的线程模型与 v0.2.0 修复的两个缺陷

上层用法见[系统托盘](/zh-cn/guides/tray/)，能力探测与降级链见[能力与降级](/zh-cn/guides/capability-and-fallback/)。
