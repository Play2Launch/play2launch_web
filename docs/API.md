# 登录 API 接入契约

## 活动目录接入（新增）

### 图片、推荐与排序配置

API 新增 `cover_image`（活动卡片）、`hero_image`（首页大图和详情主图）、`image_alt`、`featured`、`sort_order`。图片可填 `/images/paperhood.png` 这类站内路径，或无用户名密码的 HTTPS 地址。前端拒绝其他协议、协议相对地址和异常路径；缺图/加载失败均显示活动缩写，主图未配置时可复用封面。改图后刷新即可，不按 phood 判断图片。

列表由服务端按 featured 降序、sort_order 升序、ID 升序排列；推荐活动中第一条作为首页大图，没有推荐则用列表第一条。复合 `next_cursor` 是不透明分页参数，客户端原样传回，旧 cp-only 游标不再支持，升级后刷新列表。排序字段在翻页途中变动不保证快照一致性，修改推荐/排序后应刷新首页。

本地 seed 工具只给带 fixture 标记的测试记录补充缺失配置，不覆盖已有值。没有上传、S3 或管理编辑接口；当前通过 MongoDB 配置路径，图片仍可随前端静态资源提供。Demo 的对应图片信息保存在 data.ts，与 Live 共用 CampaignArtwork 组件及既有布局。

视觉与数据分离：LiveCatalog 仅负责请求、分页和错误状态，首页复用 Discover，详情复用 CampaignPage，与 Demo 共用原产品布局、图片及样式。Live 缺失统计显示 `—`，不渲染演示排行榜和倒计时；未接入的分享、入队、榜单及发行操作保留位置但禁用。Trending / New arrivals 尚无对应排序字段，暂禁用，提供 All projects 和阶段筛选；搜索作用于已加载活动。API 空列表或失败时不补入演示活动。

Live 模式首页和 `/campaign/:slug` 从同一个 API base 请求 `GET /campaigns?limit=20&after=...` 及 `GET /campaigns/:slug`。活动包含独立 Snowflake `id` 和路由 `slug`，不把两者混用。前端验证响应结构并显示加载、空数据、失败重试、404，翻页去重且路由切换取消旧请求。失败不回退 Demo，也不把接口未提供的参与人数/成绩补成模拟数值。

运行后端 `make seed-campaigns` 可准备受本地限制的测试数据；后端重启后生效。队伍/榜单仍为预览，Practice 仍不提交真实成绩。默认 Demo 模式保持原页面。Live 不注册仍基于演示目录的 WebMCP 工具，避免把演示活动作为服务端数据输出。

当前客户端已适配 PlayToLaunch_server 的 DashFun 兼容协议。原 /v1/auth/* 邮箱验证码登录及 Cookie session 提案已移除，不再用于实现。

## 运行与配置

- 默认 `npm run dev`：Demo 模式，不请求真实认证服务（除非你自己在 .env.local 中覆盖模式）。
- `npm run dev:live`：显式使用 .env.live，本机认证 API 前缀为 `http://127.0.0.1:8088/api/v1`。
- 切换模式需要重启 Vite；两个模式共用 5173，不同时启动两个实例。
- `VITE_API_BASE_URL` 必须包含完整 API 前缀 `/api/v1`。相对路径也需要部署侧正确代理。
- 服务器需另行启动并配置账户签名密钥；客户端不会自动创建已激活账户、配置密钥或启动后端。
- 所有 VITE_* 都是公开客户端配置，严禁填写 Bot Token、账户签名密钥、数据库或 AWS 凭证。
- TMA 真机需要可访问的 HTTPS 前后端地址及允许的 Origin，不能直接使用手机上的 127.0.0.1。

## Web 账户登录

1. POST /acc/login：JSON `{username,password,acc_type:1}`。
2. 服务端返回 `{code,msg,data}`。必须同时检查 HTTP 状态与 code；code=0 不代表已激活。
3. status=0 时展示邮箱激活界面，不创建已登录身份；status=1 且有 Token 后才继续。
4. POST /user/tg_login：`Authorization: bearer <accountToken>`，URL 编码表单 `referrer_id`。
5. 取返回的业务用户 data.id，而不是 account_id 或 channel_id。显示名按 nickname、display_name、user_name、id 回退。
6. 当前请求仍有效时，才保存凭证和完成登录。密码、验证码不写入浏览器存储。

## 注册、激活与找回密码

| 接口（均为 POST，JSON） | 字段 |
| --- | --- |
| /acc/create | username, password, acc_type:1 |
| /acc/send_email | account_id |
| /acc/verify_email | account_id, code |
| /acc/request_reset_password | username |
| /acc/reset_password | username, code, password |
| /acc/check_token | account_id, token, acc_type:1 |

- 注册成功停在激活页，不自动发送邮件，也不假装已登录。
- 激活码/重置码是 6 位字母或数字，不再错误限定为纯数字；输入规范化为大写。
- 新密码至少 8 个字符、最多 72 UTF-8 字节；注册/重置有确认密码。
- 邮件默认未配置时，503/11006 展示真实不可用提示，不显示“已发送”。
- 激活成功后再取得业务用户；改密码成功后返回登录表单，不自动登录，不声称旧 Token 已全局撤销。
- 邮件流程仅自动测试：客户端使用模拟 HTTP 响应，服务端集成测试使用内存发送器。未创建 Dev 收件箱、测试验证码公开接口，也不发送真实邮件。

## TMA 登录

- 使用当前启动的原始 initData，POST /user/tg_login，`Authorization: tma <initData>`。
- 身份必须由服务端验签；前端运行环境识别、URL 参数和解析出来的 user.id 都不是可信身份。
- 启动时先清除可能残留的 Web 账户凭证，不将另一种账户恢复到 TMA。
- TMA 登录面板只提供当前 Telegram 身份的登录/重试，不隐式降级成邮箱账户或 Demo 用户。
- 原始 initData 仅在内存中使用，不持久化、不放进分享链接、日志或请求体。

## 凭证、恢复、取消与退出

- 所有请求 `credentials: omit`、`cache: no-store`；不使用 Cookie session。
- Web 凭证保存在当前标签页 sessionStorage（按 API base 隔离），包含 accountId 和不透明 Token；浏览器禁用存储时只在内存中保持。
- 刷新时先 check_token，再 user/tg_login。只相信服务器重验后的身份，不从本地用户 JSON 恢复权限。
- sessionStorage 的 Token 可被同源 JavaScript 读取，**不是 HttpOnly 的等价替代**。正式部署需要 HTTPS、XSS 防护和严格 CSP；后续如需 HttpOnly/BFF 应另行设计协议，不在此轮悄悄添加。
- 401/403 恢复失败清除失效凭证；网络失败不伪造身份，也不把临时故障当成账户被删除。
- 每次登录使用 AbortController 与请求序号；关闭弹窗、退出或组件卸载会使旧请求失效。晚到的结果不得重新登录、写 Token 或执行已取消的入队/保存操作。
- 退出只清除本地身份和凭证，不调用不存在的 logout 接口，不等于撤销服务端签发的全部 Token。
- 当前没有跨标签页全局退出或账户合并；新标签页与 TMA 仍需各自验证身份。

## 活动来源和演示数据边界

- Campaign / Team / Referrer / Source 继续按 Campaign 保存于原有入口上下文，登录或退出不清除邀请。
- 只有 ur 前缀的实际业务用户 ID 候选才作为全局 referrer_id 发送；服务端仍需确认其存在，演示 player_42 不发送。
- 不把 guestId、完整活动 payload 或客户端成绩当作认证资料上传；活动归因需后续业务接口独立处理。
- Demo 数据继续使用 p2l.preview.v1；live 本地练习使用 p2l.practice.v1，互不覆盖。
- live 模式不读取 Demo 身份/会员关系/KOL 权限，不将练习成绩归入真实用户榜单。登录后尝试入队/保存会明确提示真实业务接口尚未接入。
- 练习历史属于当前设备，不代表当前账户的服务器记录。

## 验证范围

- API 合约测试：路径、JSON/表单、Authorization、响应外层、激活状态、错误码、Token 恢复、超时及取消。
- React 自动交互测试：密码登录、刷新恢复、退出/切换账号、注册/激活/重置、邮件不可用、邀请保留、取消后晚到响应、TMA 身份优先、演示隔离。
- 原有 Demo、游戏、活动、入口测试继续运行。
- 仍需真实浏览器与 Go 服务的联合验收，以及 Telegram 真机和邮件供应商送达测试。自动测试通过不等于完成这些验收。
