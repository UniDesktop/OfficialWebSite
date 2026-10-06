---
title: Protocol overview
description: What each of the four low-level protocols is responsible for, and how they combine into the cross-platform appearance and tray capabilities.
---

UDA lands on different low-level protocols on Linux and on Windows. This section documents each protocol's interface details, its known traps, and the trade-offs UDA makes. This page explains what each one covers and how they fit together.

## At a glance

| Protocol | Platform | Capability it carries |
|---|---|---|
| XDG Desktop Portal | Linux | Tier 1 of the fallback chain; UDA consumes only its `Settings` interface, for the colour scheme and accent colour |
| StatusNotifierItem (SNI) | Linux | the tray icon and its activation events |
| `com.canonical.dbusmenu` | Linux | the tray context menu, pulled by the shell |
| `Shell_NotifyIconW` | Windows | the tray icon and menu, via a local `HMENU` and a dedicated worker thread |

## Linux: the portal goes first, but is often not enough

The portal is freedesktop's standard sandboxed interface layer. Every desktop environment implements it itself, and applications reach it over D-Bus without caring whether GNOME or KDE sits behind it. UDA treats it as **Tier 1** of the fallback chain: if the interface exists and is exported, use it; otherwise drop to native IPC and CLI tools.

Real coverage varies a lot. GNOME 42+ is fairly complete, KDE and XFCE implement it partially depending on version, and Hyprland / Sway usually have none at all.

It is worth noting that although the portal defines `Wallpaper` and `Inhibit` interfaces, UDA's backends do not use them — wallpaper goes straight to the desktop-native path and CLI toolchain, and keep-awake calls `org.freedesktop.ScreenSaver.Inhibit` on the session bus. The only capability that actually travels through the portal today is appearance.

## Linux tray: SNI and DBusMenu come as a pair

On Wayland the tray can only go over D-Bus: the older XEmbed tray depends on a globally owned X window, and Wayland has no such thing.

The two protocols have clearly separated duties, and neither is optional:

- **SNI** carries the icon itself and the activation events — clicks, scroll, context-menu requests.
- **DBusMenu** carries the menu contents, and the direction is the shell pulling rather than the item pushing.

That puts the responsibility for menu state on the item side: after a user interaction the item must broadcast `ItemsPropertiesUpdated` before the shell redraws a checkmark. The classic symptom of skipping that step is "the first click works, the second snaps back to the old state".

## Windows tray: one window, one thread

`Shell_NotifyIconW`'s `NOTIFYICONDATAW` embeds an `hWnd`, and the shell posts callback messages through it — but a window belongs to the thread that created it. UDA therefore spawns a dedicated worker thread, creates a message-only window there and runs its own message loop; every host-side state change is posted across as a message. That keeps the host's event loop free while still satisfying "the owning thread makes the calls".

The menu takes no protocol at all: a local `HMENU` plus `TrackPopupMenuEx` pops it directly. `TrayManager` absorbs the difference between the two tray mechanisms, so callers see one `TrayMenu` model.

## Reading order

- [XDG Desktop Portal](/en/internals/protocols/portal/) — Tier 1's endpoint layout, probing, and coverage gaps
- [StatusNotifierItem (SNI)](/en/internals/protocols/statusnotifieritem/) — the Linux tray icon and activation protocol
- [DBusMenu](/en/internals/protocols/dbusmenu/) — the pull-based tray menu protocol and its id allocation
- [Shell_NotifyIconW](/en/internals/protocols/notifyicon/) — the Windows threading model and the two defects fixed in v0.2.0

For the high-level API see the [system tray guide](/en/guides/tray/); for capability probing and the tier chain see [capability and fallback](/en/guides/capability-and-fallback/).
