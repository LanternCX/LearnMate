<div align="center">

<img src="apps/client/src-tauri/icons/icon.svg" alt="知芽图标" width="128" height="128">

# 知芽 Zhiya

面向小学至高中学生的个性化 AI 学习搭子

让 AI 先认识学生，再用适合他的方式讲解编程与人工智能。

[![License](https://img.shields.io/badge/License-AGPL--3.0-22c55e?style=flat-square)](LICENSE)

[参与贡献](CONTRIBUTING.md) · [本地开发](docs/development.md)

</div>

## 认识知芽

知芽希望成为陪伴学生长期学习的 AI 搭子。它不只回答眼前的问题，还会通过自然对话了解学生的年级、知识基础、兴趣和学习偏好，并根据后续表现持续调整讲解方式与学习内容。

学生只需说出想学什么，知芽便可以一边交流，一边组织图文课件，把一次提问逐步展开成适合当前学生的课堂。

## 学习体验

| 先认识学生 | 动态组织课堂 | 记住学习情况 |
| --- | --- | --- |
| 通过轻量对话了解基础、兴趣与学习偏好，无需填写冗长表单。 | 教学 Agent 负责讲解和节奏，课件 Agent 同时逐页生成内容，第一页准备好即可开始学习。 | 保存学生档案、课程和课堂状态，让后续交流建立在已经发生的学习之上。 |

知芽围绕一个持续循环工作：

> 了解学生 → 组织教学 → 观察反馈 → 更新认识 → 调整下一步学习

## 系统架构

![知芽当前架构](docs/assets/zhiya-architecture.svg)

浏览器和 Tauri 桌面应用共享由 React、TypeScript 与 Vite 构建的学习界面，pi Agent 在客户端负责建档、课堂对话和课件编排。Go 服务提供静态文件、API、WebSocket 会话同步与模型代理，模型密钥不会进入客户端。本地开发通过 Docker Compose 运行 PostgreSQL 17 和 Mailpit；部署环境连接独立的 PostgreSQL、SMTP 与 OpenAI-compatible 模型服务。

架构图使用 [Archify](https://github.com/tt-a1i/archify) 生成，可维护源文件见 [`docs/assets/zhiya-architecture.architecture.json`](docs/assets/zhiya-architecture.architecture.json)。

## 本地运行

准备 Node.js 22.19+、npm、Go 1.26+ 和 Docker，然后在仓库根目录执行：

```sh
npm install
npm run dev:services
```

再分别启动服务端和浏览器客户端：

```sh
npm run dev:server
npm run dev
```

打开 <http://127.0.0.1:1420> 使用知芽；本地验证邮件可在 <http://127.0.0.1:8025> 查看。模型连接、桌面端运行、配置方式和测试命令见[开发指南](docs/development.md)。

## 参与贡献

欢迎通过 Issue 和 Pull Request 一起完善知芽。开始前请阅读[贡献指南](CONTRIBUTING.md)，了解项目的协作方式、人工审核要求和提交流程；项目目标、范围和验收场景见[产品需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)。

## 产品官网

首屏两侧采用反向纵向循环组件带，学习理念采用文字与图形横向无缝循环横带，参考 Neobrutalism 官网。横带右侧按钮可统一暂停／继续装饰滚动，鼠标悬停可暂停对应区域。小屏隐藏侧边组件带，保留横带；减少动态效果模式使用静态展示。循环副本不重复进入无障碍阅读顺序。

官网动效由 `apps/website/src/WebsiteMotion.tsx` 与 `motion.css` 管理：约 3.4 秒的小芽生长成树开屏（按钮、Esc 或 Tab 可跳过），以及标题入场、贴纸入场、滚动展开、课堂／学段切换四组动画。标题、贴纸、背景网格和数学面板以不同幅度响应滚动视差；使用被动滚动监听与 requestAnimationFrame 合并更新，移动端降低幅度。系统启用减少动态效果时跳过开屏并关闭这些动画和视差，保留内容及交互。

产品官网位于 `apps/website`，是独立的 React + Vite 静态站点，不调用账号或教学接口。单独开发官网只需 Node.js 22.19+ 和 npm，不需要 Go、Rust、Docker 或模型密钥。在仓库根目录执行 `npm ci` 安装锁定依赖，然后运行：

```sh
npm run dev:website         # 本机预览：http://127.0.0.1:4174
npm run check:website       # TypeScript 检查
npm run test:website        # 开发服务器上的浏览器行为测试
npm run build:website       # 根路径静态构建，输出到 apps/website/dist
npm run test:website:pages  # 构建 /zhiya/ 版本并运行同一套浏览器测试
```

Windows 测试使用已安装的 Microsoft Edge；其他系统首次测试前运行 `npx playwright install --with-deps chromium`。测试自行启动和关闭所需服务器。端口 4174（开发）和 4175（生产预览）应空闲。测试截图保存在 `apps/website/test-results`，不纳入版本控制。

官网包含课程学习、自由知识探索、AI 实验室、课堂步骤、四学段适配、多模态教学和关于知芽。页面参考 [Neobrutalism](https://www.neobrutalism.dev/) 的网格首屏、两侧拼贴、文字横带和描边面板，以绿色为主色，使用硬阴影和按压式按钮。浅色主题使用黑色文字，不展示项目进展、虚构评价或常见问题栏目。字体通过 Google Fonts 加载，网络不可用时使用本机字体回退。主题支持自动、浅色和深色；浏览器拒绝本地存储时仍可使用，但刷新后不保留手动选择。

按钮默认／中性样式和首页网格处理适配自 [ekmas/neobrutalism-components](https://github.com/ekmas/neobrutalism-components)，转换为官网现有的原生 React 控件与 CSS，不安装整套组件库或耦合客户端依赖。来源版本、适配范围和 MIT 许可证保存在 `apps/website/public/licenses/neobrutalism-components.txt`，随静态构建分发。主题变量在 `styles.css` 的 `:root` 和深色主题块集中维护。

产品体验区包含借鉴 Manim 表达方式的 Canvas 2D 数学小实验，并非调用 Manim、Three.js 或真实 AI 接口。动画使用固定示例数据与最小二乘直线，依次展示观察、拟合与预测，支持暂停、继续、重播和直接选择章节；播放一次后停止，系统启用减少动态效果时只显示静态结果并保留章节切换。官网只介绍产品，不实现语音教学、模型生成、在线编程、评估或学习记录。

页面内容与交互位于 `apps/website/src/App.tsx`，样式位于 `apps/website/src/styles.css`，数学动画位于 `apps/website/src/ClassroomScene.tsx`。真实素材和产品入口通过以下方式接入：

- 图片配置位于 `apps/website/src/website-content.ts`：`classroomImages` 对应四个课堂步骤，`stageImages` 对应四个学段，`modalityImages` 对应三项多模态能力。当前地址为空，显示有描边、无说明文字的图片留白；图片加载失败时也回退为留白。填写真实图片的 `src` 和准确的 `alt` 即可，图片保持比例且不裁切。
- 本地图片可放入 `apps/website/public/images/`。在配置中使用 `import.meta.env.BASE_URL + "images/文件名.png"` 作为地址，可同时适配根路径和 `/zhiya/` 部署；不要把 `/images/...` 写死为根路径。该图片目录按需创建，勿提交未授权素材。
- 产品入口读取构建时环境变量 `VITE_PRODUCT_URL`，地址须以 `https://` 或 `http://` 开头。未配置时，所有“进入知芽”按钮均禁用，不进行假跳转。本地可在 `apps/website/.env` 中设置，修改后重启开发服务器或重新构建；该文件已被忽略，不提交到 Git。正式部署需在构建环境中注入此变量，当前 Pages 工作流尚未配置真实产品地址。`VITE_` 变量会进入前端产物，不得包含密钥。

`.github/workflows/website-check.yml` 为官网相关 PR 检查类型、浏览器行为及两种部署路径。`.github/workflows/deploy-website.yml` 仅允许 `main` 构建通过测试后部署 GitHub Pages，包括手动触发时；Pages 写权限仅授予部署任务。首次上线须由维护者授权并选择 GitHub Actions 作为 Pages 来源。配置目标为 `https://lanterncx.github.io/zhiya/`，此地址不是已经上线的声明。

项目子路径构建命令为 `npm run build:pages --workspace @zhiya/website`；一般静态托管使用 `npm run build:website`。将对应的 `apps/website/dist` 目录作为发布内容即可，不需要后端服务。上线、修改仓库设置和合并 PR 仍须维护者授权。

## License

知芽采用 [GNU Affero General Public License v3.0](LICENSE) 开源。
