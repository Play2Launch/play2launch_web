# DashFun 登录复用接入清单

状态：源码对齐及客户端协议适配已完成。当前使用方法、存储策略与测试范围见 [API.md](API.md)，该页已替换历史 Cookie/验证码登录提案。

实施进度：同级 PlayToLaunch_server 已建立兼容身份模块并通过本机 MongoDB/Redis 集成测试。客户端已完成密码登录、注册/激活/重置、Token 恢复与取消处理的自动测试；真实浏览器双入口联调仍待进行。下文保留源码核对依据。

## 已确定边界

- Go / Gin / Wire / Swaggo / Zap / MongoDB / Redis。
- 沿用 harryhowardai_server 的 Account、User、认证协议及雪花 ID 体系，不迁移数据、不另设计身份体系。
- Web 使用账户登录；TMA 使用原始 Telegram initData，由服务端验证。两种认证最终取得 DashFunUser.id。
- 不自动绑定或合并邮箱与 Telegram 身份，不把账户 ID、Telegram ID 当成业务用户 ID。
- 活动发布仅限后台；KOL 是正常业务用户附加认证资料，不使用旧 DF_UserFrom_Kol 推广占位用户。
- 不复制线上配置、密钥或数据库数据。实际部署地址、数据库隔离与凭证通过服务端配置确定。

## 源码核对依据

参考前端：dashfun_gamecenter_tma/src/main.tsx、pages/Entry/EntryPage.tsx、utils/DashFunApi.tsx、components/DashFun/DashFunUser.tsx、components/DashFunData/UserData.tsx。

参考服务端：D:/Projects/CoinBridge/harryhowardai_server 下 api/api_account.go、api/api_user.go、api/result.go、utils/Utils.go、accountcenter/accountcenter.go、usercenter/usercenter.go。

这份旧前端的活动入口支持 /entry/:channel，保存 channel 并跳转目标页；默认渠道为 tg。已找到的登录客户端使用 tma 鉴权。未找到完整的账户登录页面或 acc/login、check_token 客户端调用，不能声称已有可直接复制的 Web 登录 UI。

服务端 user/tg_login 的名字和部分注释仍写 Telegram，但实际 UserLogin 已按 Authorization method 分流，也接受账户 Token。

## 保留的账户接口

以下路径统一以 /api/v1 为前缀，均为 POST JSON；成功外层为 { code: 0, msg, data }，不能只凭 HTTP 200 判断已登录。

| 路径 | 请求字段 | 用途 |
| --- | --- | --- |
| /acc/create | username, password, acc_type: 1 | 邮箱账户注册 |
| /acc/login | username, password, acc_type: 1 | 密码登录 |
| /acc/send_email | account_id | 发送激活验证码 |
| /acc/verify_email | account_id, code | 激活邮箱，成功返回账户及 Token |
| /acc/check_token | account_id, token, acc_type: 1 | 校验并更新 Token |
| /acc/request_reset_password | username | 申请密码重置验证码 |
| /acc/reset_password | username, code, password | 重置密码 |

账户返回包括 account_id、username、type、status、token、display_name。状态：0 未验证、1 正常、2 冻结、3 删除。未验证账户登录可能 HTTP 200/code 0，但没有可用 Token，必须进入激活流程，不得视为登录成功。

现有 Token 是签名字符串协议，不是 JWT；前端将其视为不透明凭证，不自行构造或改写。

## Web 登录链路

1. acc/login 获得正常账户与 Token；未验证则走发送/验证邮箱流程。
2. POST /api/v1/user/tg_login，Authorization: bearer <accountToken>，表单传 referrer_id（可空）。虽然路径名含 tg，现有服务端支持账户认证。
3. 解包 DashFunUser，登录完成后才执行用户仍授权的 Join/Save 等操作。
4. 后续受保护请求继续携带 bearer Token。账户认证别名 account / duc 为服务端现有兼容能力，新适配统一使用 bearer。
5. 刷新恢复：若采用持久化凭证，先 check_token 更新凭证，再调用用户登录恢复业务身份；不能仅信任本地用户对象。存储介质、过期与跨标签同步策略在适配时明确，不声称旧前端已有实现。
6. 原协议没有已核实的服务端 logout/session 撤销端点。退出先清理客户端身份与凭证；这不等于撤销已经签发的所有 Token，不伪造 logout API。

## TMA 登录链路

1. 使用当前启动的原始 initData，不使用前端解析出来的 user.id 作为认证凭证。
2. POST /api/v1/user/tg_login，Authorization: tma <initData>，使用 FormData 或 URL 编码表单传 referrer_id。不要改成 JSON，否则旧 handler 的 GetPostForm 读不到该值。
3. 解包 DashFunUser；后续请求携带 tma 凭证。服务端也支持 telegram 别名。
4. 认证失效或切换 Telegram 用户后停止受保护操作，重新获取有效启动数据；不能自动改用另一个本地账户身份。
5. P2L 普通 Web 不依赖 Telegram SDK 启动，不复制旧项目模拟 Telegram 用户的方式。入口判断不等于身份验证。

## 用户字段映射

| 服务端字段 | 前端用途 |
| --- | --- |
| id | 唯一业务用户 ID；队伍、成绩、认证、奖励关联依据 |
| channel_id | Telegram ID 或账户 ID，仅作渠道信息 |
| display_name | 展示名，可按规则回退 user_name/id |
| user_name | 用户名 |
| avatar_url | 头像 |
| from | 用户来源，不是管理员或 KOL 权限 |

保留 AC/ur 前缀及已有雪花 ID 编码，全部以字符串传输。新增业务实体也使用统一雪花生成器；多实例 worker 分配、序列溢出和时钟回拨问题在后端实现阶段修正。

## 分发与认证分离

- 继续保留 P2L EntryContext、按活动隔离的邀请来源、普通网页深链接与 TMA start payload。
- 旧用户 ReferrerId 是全局首次邀请关系，不足以表达活动归因；不能直接把完整 P2L start payload 当 referrer_id。
- campaign/team/source 等通过业务接口单独校验并记录；访问邀请链接不自动加入队伍。
- 同一个用户可在不同活动加入不同队伍；身份复用不改变活动内唯一成员关系。

## 接入前需要修正及验收

- 已完成：src/lib/api.ts 改为 /acc/* 和 /user/tg_login，使用 Authorization，统一处理响应外层、HTTP 错误与业务状态。
- 已完成：邮箱密码 UI、注册、激活、找回密码，以及 Demo/真实身份隔离；邮件仍只做自动测试。
- 参考旧项目的发送邮件失败分支直接 return；P2L 服务端已改为统一错误响应，客户端不会误判发送成功。
- 参考旧项目存在 Telegram 有效期 0 和非 Prod Test 用户绕过；P2L 服务端已设置正数有效期并移除绕过。
- 不记录密码、账户 Token、完整 initData；不把凭证放在链接或分享参数中。
- 验证：正常账户、未激活、错误密码、冻结/删除、Token 过期、网络失败、刷新恢复、退出、账号切换、TMA 验签失败、服务重启后恢复、跨活动邀请保留、取消登录后不执行旧操作。
- P2L 服务端已用本机隔离 MongoDB/Redis 测试库验证账户注册及登录闭环；客户端通过模拟 HTTP 响应验证交互。真实邮件发送、浏览器与服务器联合验收、Telegram 真机登录仍未执行。

## 实施顺序

1. 后端骨架与配置：Wire 构造函数注入、Gin、Zap、MongoDB、Redis、雪花生成器、Swaggo。
2. 抽取账户/用户兼容逻辑，隔离旧项目机器人、行情、支付等无关初始化；用隔离测试数据验证上述协议。
3. 前端认证适配与页面状态调整，保留现有视觉、入口和 demo 流程。
4. 通过双入口认证验收后，再接活动、战队、成绩、排行榜及后台审核。
