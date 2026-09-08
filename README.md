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

代码按客户端与服务端组织：

- `apps/client/src/App.tsx`：页面布局、导航与连接状态。
- `apps/client/src/account/`：账号状态、注册登录、个人资料和安全设置。
- `apps/client/src/components/`：品牌、主题、背景和确认弹窗等公共控件。
- `apps/client/src/api.ts` 与 `apps/client/src-tauri/src/account.rs`：浏览器及桌面请求、会话隔离与系统凭证存储。
- `apps/server/cmd/api/`：服务启动、路由、中间件和账户请求处理，以及 HTTP 行为测试。
- `apps/server/internal/data/`：用户、会话与验证码的数据操作，管理数据库结构和事务。
- `apps/server/internal/mailer/`：邮件投递。

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
