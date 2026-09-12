<div align="center">

<img src="apps/client/src-tauri/icons/icon.svg" alt="知芽图标" width="128" height="128">

# 知芽 Zhiya

面向小学至高中学生的个性化 AI 学习搭子

让 AI 先认识学生，再用适合他的方式讲解编程与人工智能。

[![License](https://img.shields.io/badge/License-AGPL--3.0-22c55e?style=flat-square)](LICENSE)

[产品需求](https://github.com/LanternCX/zhiya/issues/3) · [参与贡献](CONTRIBUTING.md) · [本地开发](docs/development.md)

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

## 当前进展

当前已经可以完成：

- 邮箱注册、登录、个人资料与账号安全管理；
- 通过自然对话建立和维护学生档案；
- 创建、恢复并继续文字课堂；
- 在对话过程中动态生成和展示分页课件；
- 在多个在线设备之间同步已经保存的会话状态。

自由知识探索、互动练习、语音交互、AI 实验室和完整的自适应学习路径仍在规划或开发中。产品目标、范围和验收场景以[产品需求 Issue #3](https://github.com/LanternCX/zhiya/issues/3)为准。

## 系统架构

![知芽当前架构](docs/assets/zhiya-architecture.svg)

教学 Agent 运行在客户端，负责建档、课堂对话与课件编排；Go 服务负责身份、会话同步、数据持久化和模型代理，模型密钥不会进入客户端。图中只展示当前已经接入的主要组件，规划中的实验室、在线评测和对象存储暂未列入。

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

欢迎通过 Issue 和 Pull Request 一起完善知芽。开始前请阅读[贡献指南](CONTRIBUTING.md)，了解项目的协作方式、人工审核要求和提交流程。

本项目参加第二届浙江省大学生人工智能竞赛揭榜挂帅赛题 `JBGS-2026-02`，赛题原文与交付要求见[赛事说明](docs/competition.md)。

## License

知芽采用 [GNU Affero General Public License v3.0](LICENSE) 开源。
