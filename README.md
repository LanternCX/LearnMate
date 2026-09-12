# 知芽 Zhiya

面向小学至高中学生的个性化 AI 学习搭子，帮助学生学习编程与人工智能通识知识。

知芽 希望通过持续了解学生的知识基础、兴趣与学习表现，调整教学内容、讲解方式和学习路径，让每一次提问、练习与实践都能帮助安排下一步学习。

## 产品方向

产品围绕三个学习场景展开：

- **课程学习**：根据学生当前提供的学习目标与资料组织课程，通过图文课件、语音讲解和互动练习理解知识，并随学习反馈调整后续内容。
- **自由知识探索**：从学生感兴趣的问题出发，提供简短答疑或可回看、可追问的微课程。
- **AI 实验室**：通过可视化操作、参数实验和编程实践，将课堂知识应用到具体任务中。

三个场景共享学生画像与学习状态，形成“了解学生 → 教学与实践 → 评估掌握情况 → 调整后续学习”的闭环。核心教学内容以教材和知识库为依据，AI 根据学生情况组织表达与交互。

## 项目状态

账号功能包括邮箱验证注册、登录、昵称与头像编辑、密码找回、更换邮箱、多设备退出和永久注销，功能范围见 [用户系统 #16](https://github.com/LanternCX/zhiya/issues/16)。学生完成初次建档后，可以通过文字对话开始学习；教学 Agent 在继续交流的同时调度课件 Agent 逐页生成并展示课件。完整学习业务需求见 [总需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)，当前课堂范围见 [分页课堂 #10](https://github.com/LanternCX/zhiya/issues/10)。

## 本地开发

代码按客户端与服务端组织：

- `apps/client/src/App.tsx`：页面布局、导航与连接状态。
- `apps/client/src/account/`：账号状态、注册登录、个人资料和安全设置。
- `apps/client/src/components/`：品牌、主题、背景和确认弹窗等公共控件。
- `apps/client/src/api.ts` 与 `apps/client/src-tauri/src/account.rs`：浏览器及桌面请求、会话隔离与系统凭证存储。
- `apps/server/cmd/api/`：服务启动、路由、中间件和账户请求处理，以及 HTTP 行为测试。
- `apps/server/internal/data/`：用户、会话与验证码的数据操作，管理数据库结构和事务。
- `apps/server/internal/mailer/`：邮件投递。
- `apps/client/config.json`：客户端开发／构建配置。
- `apps/server/config.yaml`：后端部署配置，由 Go 的 `internal/config` 加载和校验。
- `dev-services.env`：本地 Docker 基础设施配置。

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

Docker 的账号与映射端口以 `dev-services.env` 为准，后端连接以 `apps/server/config.yaml` 为准；其中的凭据仅用于本机开发。`npm run stop:services` 停止服务并保留数据。数据库卷初始化后，修改配置中的用户名或密码不会自动修改已有数据库账号。

```sh
npm run check          # TypeScript 检查
npm run check:client-config # 校验客户端构建配置
npm run check:server-config # 校验部署配置，不连接数据库或发送邮件
npm test               # Go 行为测试与已有 PR 模板检查测试
npm run test:accounts  # 使用 Docker PostgreSQL 运行账号行为与并发测试
npm run test:e2e       # 使用本地数据库和 Mailpit 运行浏览器行为测试
npm run test:desktop   # 桌面请求行为测试，构建参数来自客户端配置
npm run build          # 前端构建
npm run build:server   # 后端构建，输出到 dist/server
npm run build:desktop  # 桌面可执行文件构建，不制作安装包
```

浏览器测试首次运行前执行 `npx --workspace @zhiya/client playwright install chromium`。账号数据库测试在独立临时 schema 中运行并自行清理；`npm test` 默认跳过数据库测试，不能代替 `test:accounts`。浏览器测试需提前启动 Docker 服务，并自行启动一组前后端，不复用已有进程。账户数据库测试与浏览器测试顺序运行，避免共用数据库的身份变更锁互相等待。已有开发服务占用端口时，可用环境变量为测试选择其他端口：

```sh
ZHIYA_CLIENT_API_ORIGIN=http://127.0.0.1:18080 \
ZHIYA_CLIENT_DEV_ORIGIN=http://127.0.0.1:11420 \
ZHIYA_SERVER_HTTP_LISTEN=127.0.0.1:18080 \
ZHIYA_SERVER_HTTP_ORIGIN=http://127.0.0.1:11420 npm run test:e2e
```

Tauri 开发构建连接本地后端，登录凭证通过原生层保存在系统安全存储中。macOS 使用钥匙串；Windows 使用系统凭据存储；Linux 需要可用且已解锁的 Secret Service。具体平台须在发布前实测。Android 的安全存储、移动端平台工程、签名与发行配置需在确定支持平台后接入；不将内存存储作为保持登录的替代品。

## 产品官网

首屏两侧采用反向纵向循环组件带，学习理念采用文字与图形横向无缝循环横带，参考 Neobrutalism 官网。横带右侧按钮可统一暂停／继续装饰滚动，鼠标悬停可暂停对应区域。小屏隐藏侧边组件带，保留横带；减少动态效果模式使用静态展示。循环副本不重复进入无障碍阅读顺序。

官网动效由 `apps/website/src/WebsiteMotion.tsx` 与 `motion.css` 管理：约 3.4 秒的小芽生长成树开屏（按钮、Esc 或 Tab 可跳过），以及标题入场、贴纸入场、滚动展开、课堂／学段切换四组动画。标题、贴纸、背景网格和数学面板以不同幅度响应滚动视差；使用被动滚动监听与 requestAnimationFrame 合并更新，移动端降低幅度。系统启用减少动态效果时跳过开屏并关闭这些动画和视差，保留内容及交互。

产品官网位于 `apps/website`，是独立的 React + Vite 静态站点，不调用账号或教学接口。单独开发官网只需 Node.js 22.12+ 和 npm，不需要 Go、Rust、Docker 或模型密钥。在仓库根目录执行 `npm ci` 安装锁定依赖，然后运行：

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

## 配置与部署

### 首次认识学生、文字课堂与模型连接

学生登录后进入逐题引导，模型根据回答决定下一题、自主维护 Markdown 记忆，并通过 `complete_onboarding` 结束引导。进入学习页后，学生提供任意程度的学习意图即可开始文字课堂，不要求先上传材料或确认大纲。教学 Agent 负责对话和节奏，课件 Agent 通过受约束的页面工具逐页发布内容；第一页可用后即可展示，后续页面可以继续生成。学生的新反馈可以替换尚未完成的课件任务，停止后迟到结果不会进入展示。课程列表、资源管理、语音和其他教学工具仍属后续范围。

Pi 在客户端运行。模型和工具请求均经过 Go 后端；模型密钥只放在后端部署配置中。当前适配 OpenAI-compatible Chat Completions 流式接口，在服务端配置以下字段：

| 字段／环境变量 | 用途 |
| --- | --- |
| `model.endpoint` / `ZHIYA_SERVER_MODEL_ENDPOINT` | 完整接口地址，包含 `/v1/chat/completions`；生产环境要求 HTTPS。 |
| `model.id` / `ZHIYA_SERVER_MODEL_ID` | 服务支持的模型 ID。本次真实模型验证仅允许 `gpt-5.6-luna`，不自动替换模型。 |
| `model.api_key` / `ZHIYA_SERVER_MODEL_API_KEY` | 服务端凭据，勿提交版本库。 |

未配置模型时，账号服务照常运行，学习页显示暂时无法交流。模型请求最长 120 秒，输出上限为 8192 tokens；应用普通请求超时与之独立。自动化测试使用 mock 模型响应，不消耗真实模型额度，也不能代表真实模型的教学质量。

建档会话使用 UUID 与 `purpose: onboarding` 标记。消息、工具结果、等待回答的问题和引导状态保存至 PostgreSQL，学生记忆单独保存。在线设备通过 WebSocket 同步已保存状态；生成中的文字先在执行设备流式显示，完整回复保存后其他端可见。

当前课堂的教学与课件分别使用独立的模型流，因此可以并行运行。课程元数据、封面配置、对话与课件状态保存至 PostgreSQL，学生可以从课程列表恢复上一次课堂；当前一个课程对应一次对话，后续再扩展为一个课程包含多次对话。离开页面会停止正在运行的 Agent，尚未完成的生成内容不会在后台继续执行。

同一会话按轮串行执行。任一设备可回答当前问题，后端只接受一次；执行设备每 10 秒续约，通常 45 秒失联后可恢复，正在进行模型请求时最长等待其超时与执行租期。关闭客户端不会将 Agent 移到云端执行。恢复复用已完成工具结果，不额外提取画像。尚未同步的输入或生成片段可能丢失。

“知芽记得的我”显示当前长期记忆，完成引导后可通过交流修改或清除。删除记忆不会删除聊天记录；首版没有单独删除会话的入口。注销账号会通过数据库关联删除会话和记忆。桌面请求继续使用系统安全存储中的登录凭据；现有 Android 安全存储限制仍适用。

运行 `npm run test:accounts` 验证 HTTP 行为、隔离和恢复，运行 `npm run test:e2e -- onboarding.spec.ts` 验证真实客户端 Pi 配合 mock 模型的逐题、多端与记忆闭环。

客户端和服务端的配置各自独立，连接地址在部署时对应起来。客户端构建不读取后端文件，也不运行 Go 配置校验。

### 客户端：开发／构建时配置

[apps/client/config.json](apps/client/config.json) 只维护三项公开参数：

| 字段 | 用途 |
| --- | --- |
| `api_origin` | 桌面端 API 地址，以及 Vite 的开发代理目标。浏览器发布产物仍请求同源 `/api`。 |
| `request_timeout_seconds` | 浏览器和桌面请求超时，范围为 1–3600 秒。 |
| `dev_origin` | Vite 监听地址、Tauri 开发窗口与浏览器测试入口，仅供开发使用。 |

可复制为已忽略的 `apps/client/config.local.json`，通过 `ZHIYA_CLIENT_CONFIG` 选择；相对路径基于 `apps/client`。环境变量 `ZHIYA_CLIENT_API_ORIGIN`、`ZHIYA_CLIENT_REQUEST_TIMEOUT_SECONDS`、`ZHIYA_CLIENT_DEV_ORIGIN` 优先于文件。修改这些值后需重启开发工具或重新构建客户端，不能通过替换后端配置改变已发布客户端的请求超时。

```sh
ZHIYA_CLIENT_API_ORIGIN=https://learn.example.com npm run build:desktop
npm run build
```

桌面发布构建要求 HTTPS API 地址。桌面登录凭据由原生层保存在系统安全存储中，不向页面脚本暴露，也不写入浏览器本地存储。客户端配置中的所有内容都应视为公开信息，不放凭据。

### 服务端：部署时配置

[apps/server/config.yaml](apps/server/config.yaml) 提供带注释的开发配置。同一个 Go 可执行文件可以使用不同的部署 YAML，无需重新构建。

| 配置部分 | 维护内容 |
| --- | --- |
| `development` | 开发模式只允许本机 HTTP 来源和本机测试 SMTP；生产模式要求 HTTPS 来源和加密 SMTP。 |
| `http` | 监听地址、应用来源、静态文件路径、超时、清理间隔、请求体上限。 |
| `database` | PostgreSQL 连接 URL。 |
| `smtp` | 地址、发件人、认证和超时；支持 STARTTLS 或 465 端口 TLS。 |
| `account` | 会话有效期、验证码失败次数及限流等运行策略；限流次数针对 `rate_window_seconds` 窗口。 |

所有 `_seconds` 字段使用秒。环境变量按 `ZHIYA_SERVER_<SECTION>_<KEY>` 覆盖文件，例如 `ZHIYA_SERVER_HTTP_LISTEN`、`ZHIYA_SERVER_DATABASE_URL`、`ZHIYA_SERVER_SMTP_PASSWORD`；顶层开发标志为 `ZHIYA_SERVER_DEVELOPMENT`。空字符串也是覆盖值。

默认运行 `npm run dev:server` 时，先加载 `apps/server/config.yaml`，再逐项合并已忽略的 `apps/server/config.local.yaml`。本地文件可只填写需要覆盖的字段；文件不存在或字段缺失时沿用默认值，显式空字符串、`false` 和数值则是覆盖值。无效的本地配置会报错，不会静默退回默认配置。环境变量最后覆盖合并结果。

部署文件也可保存在仓库外。显式使用 `ZHIYA_SERVER_CONFIG` 或 `-config` 时，只加载指定文件，不合并默认或本地文件。npm 命令的相对配置路径基于 `apps/server`；可执行文件的 `-config` 优先于环境变量，直接运行时路径基于当前工作目录。未指定配置的可执行文件从当前工作目录加载上述两个文件。`http.web_dir` 相对于默认或显式指定的配置文件解析。

```sh
ZHIYA_SERVER_CONFIG=/absolute/path/config.yaml npm run check:server-config
npm run build:server
./dist/server -config /absolute/path/config.yaml
```

服务启动时加载和校验，修改后重启生效，不热重载。未知字段、同一命名空间内的未知环境变量、无效地址、非正数和冲突超时会被拒绝；错误不输出凭据。生产文件设置 `development: false` 和 HTTPS 的 `http.origin`，数据库与邮件认证通过部署环境注入。后端配置须放在静态文件目录之外。

客户端请求超时应大于后端请求超时；后端请求体上限需容纳业务允许的头像经过 base64 编码后的大小。两端独立部署时由部署者对应这些参数。应用不自动加载 `.env`。

### 业务规则：后端代码维护，客户端运行时读取

密码、昵称、头像、验证码位数和有效期只在后端业务代码中定义。相同常量用于实际校验、验证码存储、邮件文案及 `GET /api/account-rules` 响应；客户端不维护另一份规则数值。

公开接口只返回页面提示和辅助校验需要的规则，不返回默认昵称、客户端请求超时、数据库或 SMTP 等部署配置。前端每次加载账号时读取规则；读取失败显示连接错误和重试入口，不使用另一套默认规则。最终接受或拒绝输入始终由后端决定。

### 开发基础设施

`npm run dev:services` 和 `npm run stop:services` 将 [dev-services.env](dev-services.env) 交给 Docker Compose，不从前后端配置推导容器设置。用 `ZHIYA_SERVICES_ENV` 选择其他文件，相对路径基于仓库根目录；Docker Compose 支持环境变量覆盖。修改数据库或 Mailpit 端口时，同步调整后端连接；Mailpit 的网页端口供本地查看邮件和浏览器测试使用。

基础设施配置与应用连接配置是两份部署契约：例如 Docker 暴露数据库端口，后端配置指定连接到这个端口。修改已有数据库卷的账号不能仅修改文件。Mailpit 只捕获本地测试邮件，不验证外部投递。

后端文件与环境变量优先级参考 [Authelia](https://www.authelia.com/configuration/methods/environment/) 的处理；规则接口参考其[密码策略接口](https://github.com/authelia/authelia/blob/master/internal/handlers/handler_configuration_password_policy.go)，仅公开客户端需要的数据。

账号接口包含登录尝试与验证邮件的防滥用限制，与 AI 使用额度无关。反向代理部署时，应用默认按直连来源计算 IP 限制；应在可信入口落实真实客户端的限制，不能直接信任用户提交的转发地址。

注销会删除账号、头像和现有账号关联数据。接入学习业务时，相关数据必须关联账号并纳入同一注销流程。若部署引入备份、邮件留存或外部存储，须在上线前落实相应清理和恢复规则，避免从备份重新启用已注销账号。

## 文档与协作

- [总需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)：维护本轮开发的产品目标、学习场景、设计约束与验收场景；完成验收后关闭归档。
- [技术选型 Issue #2](https://github.com/LanternCX/zhiya/issues/2)：查阅已确认的技术栈、职责边界与待定项。
- [开发约定](AGENTS.md)：参与开发前阅读的项目规则。
- [Reference Sync](.agents/skills/reference-sync/SKILL.md)：用于查阅、核对和更新项目需求文档的技能说明。
