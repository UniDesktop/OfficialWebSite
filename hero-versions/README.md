# HERO 版本库

首页 HERO 栏已抽成独立组件 `src/components/Hero.astro`，这里是它的版本快照。
**改 HERO 只需要动那一个文件**，所以测试变体和回滚都是纯文件复制，不会因为改坏了而恢复不了。

## 命令

```sh
npm run hero:list              # 列出所有版本，并标出哪个和当前一致
npm run hero:save              # 把当前 HERO 存成快照（自动时间戳命名）
npm run hero:save -- v2-大字标题  # 存成指定名字
npm run hero:restore           # 回到 00-baseline（默认）
npm run hero:restore -- v2-大字标题
npm run hero:diff              # 当前 HERO 与 00-baseline 的差异
```

也可以不用 npm，直接 `node scripts/hero.mjs list` 等。

## 重要约定

- **`00-baseline.astro` 是冻结的还原点，不要改它。** 想基于它做新变体，先 `hero:restore`，改完再 `hero:save -- 新名字`。
- **每次 restore 都会先把当前文件另存为 `_autosave-<时间戳>.astro`**，所以恢复本身也是可撤销的 —— 误恢复不会丢东西。
- 带 `_` 前缀的是自动备份，可以随时删。
- 改完 HERO 后浏览器硬刷新（Ctrl+F5）才会重播首屏动画，普通刷新有时会命中缓存。

## 动效约束

HERO 里的架构图动画有三条不能破坏的规则，细节见根目录 README 的「首页动效」一节：

1. `motion-arch` 类必须由 `src/pages/index.astro` 头部那段 `is:inline` 脚本添加，**不能改回模块脚本**——模块脚本是延迟执行的，会让浏览器先绘制完成态再清空重画，首屏闪一下。
2. 所有动效规则必须留在 `@media (prefers-reduced-motion: no-preference)` 里。
3. 每条 `<path>` 上的 `pathLength="100"` 不能删，否则描线速度会随非等比缩放忽快忽慢。
