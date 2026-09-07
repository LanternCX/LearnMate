# 贡献指南

## 核心原则

**你必须理解自己提交的代码。** 你需要说清楚改了什么、代码是怎么工作的，以及这些改动会如何影响项目的其他部分。如果说不清楚，我们会关闭你的 PR。

可以让 AI 帮你写代码，但不能把自己都没看懂的生成结果直接交上来。

使用编码 Agent 时，请在 知芽 根目录下启动，并确保它读取并遵守 `AGENTS.md` 中的项目约定。

## 通过编码 Agent 协作

知芽 使用面向 AI 的协作环境（Harness）。[AGENTS.md](AGENTS.md) 和 [.agents/](.agents/) 为编码 Agent 提供项目规则、技能和上下文入口。

建议以项目根目录作为工作目录，在 Codex 等编码 Agent 中打开项目，通过 Agent 讨论需求、完成实现和验证。开始前，让 Agent 阅读并遵守 `AGENTS.md`。

**参与开发必须安装并使用 [mattpocock/skills](https://github.com/mattpocock/skills)。** 请按照其 [安装说明](https://github.com/mattpocock/skills#installation-30-second-setup) 为所用的编码 Agent 安装技能，并确认当前会话能够使用。项目内的 `.agents/` 不能替代这套技能的安装；项目的技能协作约定见 `AGENTS.md`。

## 理解改动，并由人类授权

**人类授权之前，Agent 禁止对本地仓库或 GitHub 仓库进行任何写操作。** 这包括修改文件、暂存、提交、推送，以及创建或修改 Issue、PR、评论、标签和仓库设置等操作。

授权前，Agent 应说明准备执行哪些操作、影响哪些范围，以及大致如何实现。贡献者需要先理解这些内容，再允许 Agent 动手。只读调查可以先进行；讨论想法不代表允许写入，允许修改文件也不代表允许提交、推送或操作 GitHub。授权在约定范围内有效，超出范围时必须重新确认，技能或自动化流程不能代替人类授权。

## 通过 Issue 或 PR 跟踪贡献

所有贡献都应通过 Issue 或 PR 留下可追踪的讨论、改动范围和进度。有相关 Issue 时关联已有 Issue；也可以直接提交 PR，说明改动的目的与内容。无需为每一次改动单独创建 Issue。

需要先讨论的功能或问题，可以使用 [Issue 模板](https://github.com/LanternCX/zhiya/issues/new/choose) 发起讨论，再根据确认的范围实现。模板提供简短的用途说明，内容以把事情说清楚为准。由 Agent 发布或更新这些内容时，同样必须先获得人类授权。

使用对应模板的标题前缀和类型标签。需求与技术依据、开发和提交约定统一见 [AGENTS.md](AGENTS.md)。

## 完成实现后提交 PR

完成约定范围的实现和验证后，按 [PR 模板](.github/pull_request_template.md) 提交 PR；有相关 Issue 时附上关联链接。

PR 标题使用 Conventional Commits 格式，例如 `feat: add student onboarding` 或 `fix(classroom): restore lesson position`。

- **说明**由人类撰写。
- **概要**可以由 AI 生成，但必须由人类核对。
- 提交者需要人工审核 PR 涉及的所有变更文件，并同步更新受影响的文档。
- 根据实际完成情况勾选检查清单，再交由维护者审核。

`PR template check` 会检查标题格式、模板必需章节、说明和概要是否填写，以及三个必选项是否全部勾选。自动检查只能确认填写情况，不能代替人工审核。

编码 Agent 可以协助完成贡献，提交者仍需理解并对提交内容负责。
