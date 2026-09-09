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

账号功能包括邮箱验证注册、登录、昵称与头像编辑、密码找回、更换邮箱、多设备退出和永久注销，功能范围见 [用户系统 #16](https://github.com/LanternCX/zhiya/issues/16)。学习业务需求见 [总需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)；账号页不提供教学、画像或学习进度同步。

## 本地开发

需要 Node.js 22.12+、npm、Go 1.26+；桌面开发还需要 Rust 和对应系统的 [Tauri 开发环境](https://v2.tauri.app/start/prerequisites/)。在仓库根目录安装依赖：

```sh
npm install
```

先启动 Docker，再运行 `npm run dev:services`。PostgreSQL 只监听 `127.0.0.1:54329`，开发数据保存在 Docker 卷中；Mailpit 提供本地测试收件箱，不向真实邮箱发送邮件。然后在独立终端运行：

```sh
npm run dev          # 浏览器：http://127.0.0.1:1420
npm run dev:desktop  # Tauri 桌面窗口，自行启动前端；与 dev 二选一
npm run dev:server   # Go：http://127.0.0.1:8080/health
```

前端和后端需要同时运行。浏览器从 `http://127.0.0.1:1420` 使用账号功能；在 `http://127.0.0.1:8025` 查看注册、找回密码和更换邮箱的验证邮件。可使用任意测试邮箱完成本地流程。健康检查返回 `ok`。

默认开发连接为 `postgres://zhiya:zhiya-local@127.0.0.1:54329/zhiya?sslmode=disable`。这些凭据仅用于绑定本机端口的开发数据库。`docker compose stop` 停止服务并保留数据；不要为了重启服务删除数据卷。

```sh
npm run check          # TypeScript 检查
npm test               # Go 行为测试与已有 PR 模板检查测试
npm run test:accounts  # 使用 Docker PostgreSQL 运行账号行为与并发测试
npm run test:e2e       # 使用本地数据库和 Mailpit 运行浏览器行为测试
npm run build          # 前端构建
npm run build:server   # 后端构建，输出到 dist/server
npm run build:desktop  # 桌面可执行文件构建，不制作安装包
```

浏览器测试首次运行前执行 `npx --workspace @zhiya/client playwright install chromium`。账号数据库测试在独立临时 schema 中运行并自行清理；未设置 `TEST_DATABASE_URL` 时，`npm test` 会跳过数据库测试，不能代替 `test:accounts`。浏览器测试需提前启动 Docker 服务，前后端可由测试工具自动启动。

Tauri 开发构建连接本地后端，登录凭证通过原生层保存在系统安全存储中。macOS 使用钥匙串；Windows 使用系统凭据存储；Linux 需要可用且已解锁的 Secret Service。具体平台须在发布前实测。Android 的安全存储、移动端平台工程、签名与发行配置需在确定支持平台后接入；不将内存存储作为保持登录的替代品。

## 产品官网

产品官网位于 `apps/website`，是独立的 React + Vite 静态站点，不调用账号或教学接口。单独开发官网只需 Node.js 22.12+ 和 npm，不需要 Go、Rust、Docker 或模型密钥。在仓库根目录执行 `npm ci` 安装锁定依赖，然后运行：

```sh
npm run dev:website         # 本机预览：http://127.0.0.1:4174
npm run check:website       # TypeScript 检查
npm run test:website        # 开发服务器上的浏览器行为测试
npm run build:website       # 根路径静态构建，输出到 apps/website/dist
npm run test:website:pages  # 构建 /zhiya/ 版本并运行同一套浏览器测试
```

Windows 测试使用已安装的 Microsoft Edge；其他系统首次测试前运行 `npx playwright install --with-deps chromium`。测试自行启动和关闭所需服务器。端口 4174（开发）和 4175（生产预览）应空闲。测试截图保存在 `apps/website/test-results`，不纳入版本控制。

官网包含课程学习、自由知识探索、AI 实验室、课堂步骤、四学段适配、多模态教学和关于知芽。页面采用无卡片边框的开放排版与整页纵向绿色渐变，浅色主题使用黑色文字；不展示项目进展或常见问题栏目。字体通过 Google Fonts 加载，网络不可用时使用本机字体回退。主题支持自动、浅色和深色；浏览器拒绝本地存储时仍可使用，但刷新后不保留手动选择。

首屏为借鉴 Manim 表达方式的 Canvas 2D 数学动画，并非调用 Manim、Three.js 或真实 AI 接口。动画使用固定示例数据与最小二乘直线，依次展示观察、拟合与预测，支持暂停、继续、重播和直接选择章节；播放一次后停止，系统启用减少动态效果时只显示静态结果并保留章节切换。官网只介绍产品，不实现语音教学、模型生成、在线编程、评估或学习记录。

页面内容与交互位于 `apps/website/src/App.tsx`，样式位于 `apps/website/src/styles.css`，首屏动画位于 `apps/website/src/ClassroomScene.tsx`。真实素材和产品入口通过以下方式接入：

- 图片配置位于 `apps/website/src/website-content.ts`：`classroomImages` 对应四个课堂步骤，`stageImages` 对应四个学段，`modalityImages` 对应三项多模态能力。当前地址为空，显示无边框、无说明文字的图片留白；图片加载失败时也回退为留白。填写真实图片的 `src` 和准确的 `alt` 即可，图片保持比例且不裁切。
- 本地图片可放入 `apps/website/public/images/`。在配置中使用 `import.meta.env.BASE_URL + "images/文件名.png"` 作为地址，可同时适配根路径和 `/zhiya/` 部署；不要把 `/images/...` 写死为根路径。该图片目录按需创建，勿提交未授权素材。
- 产品入口读取构建时环境变量 `VITE_PRODUCT_URL`，地址须以 `https://` 或 `http://` 开头。未配置时，所有“进入知芽”按钮均禁用，不进行假跳转。本地可在 `apps/website/.env` 中设置，修改后重启开发服务器或重新构建；该文件已被忽略，不提交到 Git。正式部署需在构建环境中注入此变量，当前 Pages 工作流尚未配置真实产品地址。`VITE_` 变量会进入前端产物，不得包含密钥。

`.github/workflows/website-check.yml` 为官网相关 PR 检查类型、浏览器行为及两种部署路径。`.github/workflows/deploy-website.yml` 仅允许 `main` 构建通过测试后部署 GitHub Pages，包括手动触发时；Pages 写权限仅授予部署任务。首次上线须由维护者授权并选择 GitHub Actions 作为 Pages 来源。配置目标为 `https://lanterncx.github.io/zhiya/`，此地址不是已经上线的声明。

项目子路径构建命令为 `npm run build:pages --workspace @zhiya/website`；一般静态托管使用 `npm run build:website`。将对应的 `apps/website/dist` 目录作为发布内容即可，不需要后端服务。上线、修改仓库设置和合并 PR 仍须维护者授权。

## 配置真实邮件与部署

通过环境变量配置后端，应用不自动加载 `.env` 文件：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接地址。 |
| `APP_ORIGIN` | 浏览器访问应用的完整来源，例如 `https://learn.example.com`，不含路径或末尾斜杠。 |
| `SMTP_ADDR` | 邮件服务器地址及端口，例如 `smtp.example.com:587`；支持 STARTTLS 或 465 端口的 TLS。 |
| `SMTP_FROM` | 经过邮件服务允许的发件人地址。 |
| `SMTP_USER` / `SMTP_PASSWORD` | 邮件服务的认证信息。 |
| `LISTEN_ADDR` | 后端监听地址，默认 `127.0.0.1:8080`。 |

正式环境运行后端时不加 `-dev`，通过 HTTPS 反向代理提供前端和 `/api` 的同源访问。执行 `npm run build`、`npm run build:server` 后，从仓库根目录运行 `./dist/server -web apps/client/dist`。后端启动时初始化账号表；生产数据库与邮件凭据通过环境注入，不写入仓库。注册验证和找回账号依赖可正常投递的真实邮件服务，Mailpit 不验证外部收件箱投递。

Tauri 发布构建需提供编译时环境变量：`ZHIYA_API_URL=https://learn.example.com npm run build:desktop`。发布构建只连接配置的 HTTPS 后端，开发环境地址不能用于正式发行。客户端不向页面脚本暴露登录凭证，也不将凭证写入浏览器本地存储。

账号接口包含登录尝试与验证邮件的防滥用限制，与 AI 使用额度无关。反向代理部署时，应用默认按直连来源计算 IP 限制；应在可信入口落实真实客户端的限制，不能直接信任用户提交的转发地址。

注销会删除账号、头像和现有账号关联数据。接入学习业务时，相关数据必须关联账号并纳入同一注销流程。若部署引入备份、邮件留存或外部存储，须在上线前落实相应清理和恢复规则，避免从备份重新启用已注销账号。

## 文档与协作

- [总需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)：维护本轮开发的产品目标、学习场景、设计约束与验收场景；完成验收后关闭归档。
- [技术选型 Issue #2](https://github.com/LanternCX/zhiya/issues/2)：查阅已确认的技术栈、职责边界与待定项。
- [开发约定](AGENTS.md)：参与开发前阅读的项目规则。
- [Reference Sync](.agents/skills/reference-sync/SKILL.md)：用于查阅、核对和更新项目需求文档的技能说明。
