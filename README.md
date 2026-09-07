# 知芽 Zhiya

面向小学至高中学生的个性化 AI 学习搭子，帮助学生学习编程与人工智能通识知识。

知芽 希望通过持续了解学生的知识基础、兴趣与学习表现，调整教学内容、讲解方式和学习路径，让每一次提问、练习与实践都能帮助安排下一步学习。

## 产品方向

产品围绕三个学习场景展开：

- **课程学习**：沿着明确的知识结构学习，通过图文课件、语音讲解和互动练习理解知识，支持随时提问并回到课堂。
- **自由知识探索**：从学生感兴趣的问题出发，提供简短答疑或可回看、可追问的微课程。
- **AI 实验室**：通过可视化操作、参数实验和编程实践，将课堂知识应用到具体任务中。

三个场景共享学生画像与学习状态，形成“了解学生 → 教学与实践 → 评估掌握情况 → 调整后续学习”的闭环。核心教学内容以教材和知识库为依据，AI 根据学生情况组织表达与交互。

## 项目状态

应用骨架提供 React 占位页面、Tauri 桌面入口和 Go 健康检查服务。上述业务功能为产品规划，具体需求、约束和待明确事项以 [总需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3) 的正文为准。

## 本地开发

需要 Node.js 22.12+、npm、Go 1.26+；桌面开发还需要 Rust 和对应系统的 [Tauri 开发环境](https://v2.tauri.app/start/prerequisites/)。在仓库根目录安装依赖：

```sh
npm install
```

按需要在独立终端运行：

```sh
npm run dev          # 浏览器：http://127.0.0.1:1420
npm run dev:desktop  # Tauri 桌面窗口，自行启动前端；与 dev 二选一
npm run dev:server   # Go：http://127.0.0.1:8080/health
```

前端和后端独立启动，占位页面不依赖后端。健康检查返回 `ok`。

```sh
npm run check          # TypeScript 检查
npm test               # Go 行为测试与已有 PR 模板检查测试
npm run build          # 前端构建
npm run build:server   # 后端构建，输出到 dist/server
npm run build:desktop  # 桌面可执行文件构建，不制作安装包
```

移动端平台工程、签名与发行配置在确定支持平台后接入。

## 文档与协作

- [总需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)：维护本轮开发的产品目标、学习场景、设计约束与验收场景；完成验收后关闭归档。
- [技术选型 Issue #2](https://github.com/LanternCX/zhiya/issues/2)：查阅已确认的技术栈、职责边界与待定项。
- [开发约定](AGENTS.md)：参与开发前阅读的项目规则。
- [Reference Sync](.agents/skills/reference-sync/SKILL.md)：用于查阅、核对和更新项目需求文档的技能说明。
