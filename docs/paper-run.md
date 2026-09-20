# 新版 PAPERHOOD iframe

> 当前已改为外部登记：game_key 为后台生成的 gx ID，`/campaigns/:slug/game` 提供入口 URL。下文内置 paper-run / VITE_PAPERHOOD_GAME_URL 配置已停用。游戏必须部署后台下载的 p2l-config.js；通信测试和正式局次使用同一个 gx ID。

Live 模式 `/campaign/:slug/play` 和 `/campaign/:slug/compete` 按活动绑定的规则启动游戏；不再提供页面内练习入口。独立游戏的 demo 模式仍可分享，Web demo 构建维持原展示行为。

`paperhood/paperhood-v1` 保留旧游戏；`paper-run/paper-run-practice-v5` 加载独立 2D iframe。已发布活动规则锁定，不会自动替换旧 phood 活动或混合新旧榜单。

## 配置

- Web 构建：`VITE_PAPERHOOD_GAME_URL=https://game.example.com/`。开发未配置时使用 `http://127.0.0.1:5190/`；线上必须明确配置，不回退 localhost。
- GitHub workflow 已传入同名 repository variable。
- 游戏构建：`VITE_P2L_PARENT_ORIGINS=https://web.example.com,https://admin.example.com`。
- 使用独立游戏 origin；HTTPS Web 不支持 HTTP iframe。游戏 CSP 允许 Web 的 frame-ancestors，不要设置阻止嵌入的 X-Frame-Options。
- 重启新版 API 后，新建活动选择 paper-run，完成发布、加入队伍，然后开始游戏。不要直接修改已发布活动的绑定。

Web 验证消息来源、origin、实例和局次，仅通过自身认证 API 提交报告。账号 token 不传给 iframe。后端接受后可查看成绩/贡献；网络失败由 SDK 用原 submission_id 和报告重试。退出后未提交局次保持至到期，再进入会复用该局次。正式局不允许暂停，最多 90 秒，服务端局次有效期最多 5 分钟。

当前采用分数合理性检查而非可信回放，不适合直接作为高价值奖励的安全保证。后台完整试玩仍为模拟局次，不进入真实榜单。
