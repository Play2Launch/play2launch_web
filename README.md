# Play2Launch Web

PLAY TO LAUNCH（P2L）玩家端：轻量 H5 游戏、活动队伍、排行榜与社区解锁进度。

## 关联仓库

- [服务端](https://github.com/Play2Launch/play2launch_server)
- [管理端](https://github.com/Play2Launch/play2launch_admin)

## 技术栈

React 18、TypeScript、Vite、Tailwind CSS、自定义响应式样式、React Router、Vitest / Testing Library；钱包使用 Reown / WalletConnect。

## 本地运行

需要 Node.js 22 LTS 和 npm。

```sh
npm ci
npm run dev
```

默认地址 http://localhost:5173，端口在 vite.config.ts 中配置；strictPort 开启，端口占用时不会自动换端口。

### 演示模式

默认 demo 模式，不依赖服务器。活动、身份、成绩等为本地演示数据，不代表真实奖励。

```sh
npm run build
npm run preview
```

### Live 模式

先启动 Go 服务（默认 http://127.0.0.1:8088），再运行：

```sh
npm run dev:live
npm run build:live
```

.env.live 提供本地 API 地址。其他环境复制 .env.example 为 .env.local，配置 VITE_API_MODE、VITE_API_BASE_URL（包含 /api/v1）、Telegram Bot 信息和公开的 Reown Project ID。注意本地环境变量可能覆盖构建模式；制作演示包时不要遗留 live 配置。

所有 VITE_* 值都会进入浏览器，不得填写后端签名密钥、邮件凭证或私钥。WalletConnect Project ID 是公开标识，仍应在 Reown 配置域名限制。

## 当前功能

- 活动发现、主视觉与封面配置、活动详情、阶段与时间窗口展示。
- 同一用户在不同活动独立入队；认证 KOL 可创建活动队伍。
- Referral 记录邀请者和目标队伍，不影响积分分配。
- 内置 PAPERHOOD 游戏：本地练习与服务端校验计分分开。
- 个人 / 队伍榜、首页推荐活动前三队、最高分折算解锁贡献。
- 邮箱注册、验证、登录、密码找回；TMA 通过 initData 自动认证。
- 公开显示名称、唯一 @username、头像与服务端 KOL 认证徽章。
- Web 钱包连接；TMA 隔离钱包入口。连接不代表已实现 token 领取。

## 验证

```sh
npm test
npm run build
npm run build:live
```

测试覆盖登录、入口、队伍、邀请、资料、游戏与榜单等。自动测试不能替代 Telegram 真机和生产网络验收。

## 部署

上传对应模式的 dist/ 到静态服务器，使用 HTTPS。所有前端路由应回退 /index.html。当前默认部署在域名根路径。
Live 包必须在构建时配置可访问的 API 地址；跨域直连时需要服务端 allowed_origins 允许该网页 Origin，或使用同域 /api 反向代理。

## 目录

- src/pages：活动、个人资料、队伍、排行榜、游戏等页面。
- src/components：共享组件。
- src/lib：API、Web/TMA 入口、邀请、钱包及业务工具。
- src/state.tsx：用户与演示状态。
- public：静态素材。
- docs：设计、规则与历史接入记录。部分文件为早期原型说明，当前行为以代码与本 README 为准。

## MVP 边界

链上发行、交易、token 分配 / 领取、聊天和用户名搜索尚未实现。外部 H5 通信测试不等于成绩认证。上线前仍需真实邮件、生产密钥、Telegram 真机、隐私条款和部署安全验收。
