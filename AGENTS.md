# PlayToLaunch Web 约定

修改界面时遵循 `docs/DESIGN.md` 的按钮规范：普通操作使用 `.btn` + `.btn-primary` 或 `.btn-secondary`；Primary 留给当前操作区最重要的动作，Normal 用于辅助动作。禁用状态必须同时保证视觉不可用和行为不可用，不能保留 hover 效果。不要只写 `.btn` 或引入未定义的按钮级别。游戏交易、筛选标签、图标和纯文字操作按各自控件样式处理。
