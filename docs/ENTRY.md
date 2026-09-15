# Web / TMA 分发与验收

## 运行环境与来源

`runtime` 表示实际运行在 Web 还是 TMA；`source` 表示营销来源，如 x / telegram / share。

普通 Web 访问不初始化 Telegram SDK，也不伪造 initData。只有启动 URL 携带 Telegram 数据时才异步加载官方 bridge（最多等待 2.5 秒）；已经存在 bridge 时直接使用。bridge 加载失败仍允许页面渲染，但原生能力可能不可用，需真机验证。

TMA 运行环境识别只是选择 UI 适配，身份可信度始终由服务端验证。单独写 `?startapp=...` 只能演示分发，不能获得 Telegram 身份。

## Web

推荐外部分发：`/phood/alice?ref=player_42&src=x`。

规范路径：`/campaign/phood?team=alice&ref=player_42&src=x`。

兼容入口：`/entry/web/game?game_id=phood` → `/campaign/phood/play`；`/entry/web/game-center` → `/`。旧 `test` 入口明确拒绝，普通 Web 无需模拟 Telegram。

站内查看某支战队用 `?selected=bob`，与分发用的 `?team=bob` 分开，避免 UI 浏览行为覆盖 KOL 来源。

## TMA

在 BotFather 配置同一前端的 HTTPS 地址。可采用 Main Mini App 或命名 Mini App：

```text
https://t.me/<BOT>?startapp=<payload>
https://t.me/<BOT>/<APP>?startapp=<payload>
```

配置 `VITE_TELEGRAM_BOT_USERNAME`（可省略 @）、可选 `VITE_TELEGRAM_APP_NAME` 后，分享弹窗才生成 TMA 链接。Bot 未配置时不猜测、不生成 `t.me/game` 等假链接。

当前 payload 协议：`v1_` + Base64URL 编码的 URLSearchParams，字段 `c` Campaign、`t` Team、`r` Referrer、`s` Source、`p` 目标页面。payload 不包含用户密钥或身份凭证，也不具备签名能力。后端上线时可以替换为服务端短码，保留统一 EntryContext。

示例生成（项目内 JavaScript）：

```ts
encodeStart({
  campaignId: "phood",
  teamId: "alice",
  referrerId: "player_42",
  source: "telegram",
  target: "play",
});
```

原始 `initData` 的 `start_param`、URL 的 `tgWebAppStartParam` 和演示 `startapp` 均可解析；启动处理后规范化地址，清理 URL 中的 Telegram 数据，内存保留本次登录所需的原始值。

## 归因规则（原型）

- 记录 Campaign / Team / Referrer / Source，进入链接不会自动加入战队。
- 归因按 Campaign 存入 sessionStorage；同一标签页刷新、登录、去别的页面再回来都会保留。
- 切换 Campaign 不把上一项目的邀请错误带入新项目；回到旧 Campaign 会恢复其归因。
- 新的明确分发链接覆盖当前 Campaign 的上一次来源，缺失字段不和旧邀请混合。
- 分享优先使用已加入的战队，否则使用当前 Campaign 邀请的战队。个人邀请人是当前用户；游客分享不冒充个人邀请。
- 原型数据只在本地，真实业务的 first-touch / last-touch / 结算规则必须后端确定。

## 部署和真机验收

Vite `BrowserRouter` 需要服务器配置 SPA fallback：所有非静态文件路径回退到 `index.html`。例如 Nginx 的站点 location 内使用 `try_files $uri $uri/ /index.html;`。

TMA 必须通过 Bot 绑定的 HTTPS 站点进入。局域网 HTTP 仅用于普通手机浏览器预览，不代替 TMA 验收；项目的本地 ID 生成已兼容 LAN HTTP 下没有 `crypto.randomUUID` 的情况。

本轮已做自动测试：Web 首访、链接规范化、入口参数、邀请保留、换 Campaign、无效链接、模拟 TMA boot/back、登录契约与失败重试、游客试玩、暂停、结算、保存、分享和阶段切换。

待真实配置后验证：Telegram iOS/Android/Desktop 的启动、安全区、返回、分享；服务器 Authorization/CORS 与验签；真实归因/成绩接口；HTTPS 深层路由刷新。账户切换和身份隔离已做自动测试，尚未做实际浏览器截图或真机测试。
