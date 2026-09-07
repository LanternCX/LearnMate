# Zhiya Design Guidelines

## Sources and scope

Design a calm, trustworthy learning space where K12 students can ask questions at any time. Every screen should make clear what the student is learning, what they can do, and how to continue.

- The body of [PRD #3](https://github.com/LanternCX/zhiya/issues/3) owns product requirements. [Technology selection #2](https://github.com/LanternCX/zhiya/issues/2) owns technical constraints. This document defines visual and interaction guidelines; it does not duplicate requirements or determine implementation scope.
- The [UI references in the PRD discussion](https://github.com/LanternCX/zhiya/issues/3#issuecomment-5555035574) inform sage light and graphite dark palettes, Chinese serif headings, an open teaching canvas, and question states that preserve the lesson position. The visual direction defined here uses stronger depth and frosted-glass navigation and controls; the references are not a pixel-for-pixel template.
- Use [Vercel design.md](https://vercel.com/design.md) only as a reference for organizing a usable design guide. Its aesthetic restrictions, including its rejection of glass effects, are not Zhiya requirements. Derive visual rules from the learning experience and the user's design direction.
- Apply `frontend-design` to strengthen composition and craft. Product constraints and the supplied references take priority over generic stylistic suggestions.
- Colors, type sizes, and layout dimensions below are design choices informed by the references, not claimed source values extracted from the images. Example lessons, students, and learning records illustrate the interface; they do not confirm launch content or assessment algorithms.

## Resolve competing requirements in this order

1. Knowledge accuracy, student safety, truthful states, and explicit product constraints.
2. Clear teaching content, reading order, and understandable actions.
3. Continuity of lesson position, student input, and learning tasks.
4. Usability across keyboard, touch, voice, captions, and screen sizes.
5. Brand consistency, composition, and visual detail.

Do not hide necessary feedback for simplicity or add irrelevant decoration to appear playful.

## Visual direction: a layered learning workspace

Build a quiet workspace with visible depth: a softly tinted background, a clear teaching surface, and frosted-glass controls floating above it. Use deep green text, predominantly sans-serif typography, and restrained sage accents. The student should immediately distinguish the material they are studying from the controls that help them navigate, listen, and ask questions.

Use broad, connected content regions. Establish the page's composition before styling individual controls: give the lesson or current task the strongest visual presence, keep supporting context quieter, and separate persistent controls through material and placement. Spacing and typography organize content within each region; surface contrast, translucency, edges, and shadows distinguish regions at different depths.

Avoid a Material-inspired component composition dominated by rounded cards, capsule inputs, filled selection tiles, and repeated elevated containers. This is a constraint on the resulting appearance, not on the name of a component library. Replacing one library with another while preserving the same card-heavy composition does not satisfy it. Depth should come from a few meaningful layers, not from making every object a floating card.

### Give each layer a job

| Layer | Treatment | What belongs here |
| --- | --- | --- |
| Background | A visibly tinted sage or deep graphite field; an optional broad, low-contrast tonal gradient | The environment surrounding the work, with little visual detail |
| Teaching surface | A stable, opaque or nearly opaque light or dark surface, clearly separated from the background | Lesson text, images, diagrams, answers, and experiment results |
| Floating controls | Frosted translucency, a fine edge highlight, and a soft separation shadow | Navigation, playback, the question composer, and temporary contextual panels |

Related content can share a teaching surface. Do not wrap every section in a new surface. Make the current task identifiable even in grayscale: color accents and blur must not carry the hierarchy alone.

### Use frosted glass deliberately

Frosted glass is a recurring material for the app's navigation and interaction layer. Use it where content or a tonal background can visibly continue underneath. A pale rectangle over an identical flat background does not establish a glass effect.

- Start with a tinted fill at roughly 72–88% opacity and a backdrop blur of 16–24 pixels. These are tuning ranges, not fixed acceptance values. Adjust them against the actual content underneath.
- Combine translucency with a subtle 1-pixel edge highlight and a broad, low-opacity shadow. The panel should feel separated without appearing glossy, metallic, or heavily raised.
- Keep text, icons, and focus indicators fully opaque. Apply transparency to the panel background, not to the entire container.
- Keep reading areas and teaching images sharp. Glass belongs around the lesson, not over the words or diagrams the student needs to understand. An expanded answer area may use a solid inner reading region within a glass shell.
- Use one shared glass treatment for related controls. Avoid overlapping blur panels, nested glass cards, bright reflective streaks, and excessive saturation.
- Check the darkest, lightest, and busiest content that can pass underneath. Increase the tint opacity when necessary; blur alone does not guarantee readable contrast.
- Provide a solid surface fallback when backdrop blur is unavailable, reduced transparency is requested, or rendering cost compromises smoothness. The same layout, boundaries, and hierarchy must remain clear.

For younger students, use more images, concrete examples, and conversational guidance. For older students, increase the depth of explanations, parameters, and code. Preserve one visual language across age groups. Avoid infantilizing mascots, leaderboards, and language that shames mistakes.

## Color and surfaces

两套配色共用语义色彩。主题切换参考 [Cao Xin 的博客](https://www.caoxin.xyz/)，提供“自动 → 浅色 → 深色”的循环选择，而非三套独立配色。默认跟随系统，手动选择应在刷新后保留；只有自动模式响应系统外观变化。顶栏右侧使用轻量图标按钮，以半圆、太阳和月亮区分状态，并通过可访问名称说明当前状态与下一次点击的结果。

| Token | Sage light | Graphite dark | Purpose |
| --- | --- | --- | --- |
| `canvas` | `#E6EDE8` | `#17211F` | Background field surrounding the teaching surface |
| `surface` | `#FFFFFF` | `#283330` | Stable teaching and reading surfaces |
| `subtle` | `#F2F5EF` | `#34423D` | Supporting regions within a surface; use sparingly |
| `glass-tint` | `#F7FAF6` | `#253630` | Base tint for translucent floating controls; apply background opacity separately |
| `glass-edge` | `#FFFFFF` | `#C6D8CB` | Fine translucent highlight on glass boundaries |
| `text` | `#142D2A` | `#F3F6EE` | Body text and headings |
| `muted` | `#3F5348` | `#B7C6BC` | Supporting text, including text on the tinted background |
| `line` | `#CCD6CB` | `#50635B` | Noninteractive dividers |
| `accent` | `#284F3F` | `#B8D3A8` | Primary actions, focus, and companion labels |
| `on-accent` | `#FFFFFF` | `#202928` | Text on primary buttons |
| `warning` | `#805C2D` | `#E3C38C` | Attention and student role labels |
| `error` | `#A23F38` | `#F2AAA0` | Submission errors and unrecoverable failures |

Pair state colors with text or a graphical cue. Dividers must not be the only means of identifying controls; inputs and selection controls need sufficiently clear boundaries. Body text requires at least 4.5:1 contrast against its background; large text and essential non-text control boundaries require at least 3:1. Do not dim an entire page to communicate a disabled state.

Measure contrast on the composited result for translucent surfaces, not against the tint's opaque hex value. Tune glass-edge opacity and shadow strength separately for light and dark themes. Dark mode must retain a distinct background, readable teaching surface, and visible floating controls rather than flattening everything into one gray.

## Typography and reading rhythm

Use Noto Sans SC throughout the functional interface, including page and lesson headings, section titles, feedback, body text, controls, and experiment parameters. Reserve Noto Serif SC for the main welcome heading on the first-visit screen. Establish hierarchy through size, weight, and spacing rather than frequent changes of typeface. Use JetBrains Mono for code. Verify licensing and target-environment support before shipping. Provide local fallbacks in the same type category so font-loading failures do not prevent reading. Keep the brand name a simple sans-serif wordmark.

| Role | Desktop size / line height | Mobile size / line height | Weight |
| --- | --- | --- | --- |
| Page heading | 40 / 56 | 30 / 44 | 600 |
| Lesson heading | 32 / 48 | 28 / 42 | 600 |
| Section heading | 24 / 36 | 22 / 34 | 600 |
| Teaching body | 20 / 32 | 18 / 30 | 400 |
| Interface body and controls | 16 / 26 | 16 / 26 | 400–500 |
| Supporting text | 14 / 22 | 14 / 22 | 400 |
| Code | 15 / 24 | 14 / 22 | 400 |

Do not shrink an individual heading to preserve a layout. Adjust the copy, measure, or arrangement first. Allow natural Chinese wrapping without inserting spaces to simulate tracking. Left-align body text, favor clear short sentences, and generally keep reading measures around 28–36 Chinese characters.

Prioritize function and brevity in interface copy. State the task, result, or next action directly. Omit motivational slogans, repeated explanations, and routine reassurance. Keep teaching explanations and questions when they support understanding; do not repeat the heading in supporting text. Use short, specific button labels. Reserve companion labels for actual dialogue, and report learning evidence without claiming mastery from a single answer. Error messages should state the problem and available recovery action.

## Spacing and responsive composition

- Use the spacing scale 4, 8, 12, 16, 24, 32, 48, and 64. Keep explanations close to their objects and separate unrelated tasks.
- Inspect desktop designs at 1440 × 1000 and mobile designs at 390 × 844, with an additional check at 320 wide. These are design samples, not commitments to particular operating systems.
- Use a desktop content width of at most 1200 with side margins of at least 32. Use 20 on mobile, reducing to 16 on narrow screens.
- Wide workspaces may use a 208-wide sidebar. Narrow screens use a top bar and bottom navigation. Focused lessons hide the persistent sidebar while retaining back navigation, the lesson title, contents, and practice access.
- Integrate the sidebar into the workspace canvas. Do not enclose it in a card, glass panel, rounded container, border, or shadow. Rounded highlighting belongs to the selected navigation item.
- Recompose to one column when the content area falls below 720 wide. Never proportionally shrink the desktop artboard. Teaching examples may wrap; code and necessary data tables may scroll within their own regions.
- Desktop lesson controls combine playback, speed, captions, pagination, and questions. Mobile separates playback and progress from the question input, accounting for safe areas and the software keyboard.
- Use a consistent radius scale across desktop and mobile: 8 pixels for selected navigation items and small image frames, 12 for primary buttons and teaching surfaces, and 16 for floating panels and composers. Keep ordinary rectangular controls and full-width composers softly rounded rather than capsule-shaped; circles are appropriate for compact icon controls. The sidebar itself has no rounded container.
- Separate the teaching surface from the background through a visible tonal difference and, where useful, one soft shadow. Floating glass controls receive their own fine edge and separation shadow. Do not repeat elevation on every exercise option, paragraph, or piece of metadata.
- Floating controls may overlap unused margins, but must not cover reading content or answers. Reserve space for their full height, including the mobile safe area and keyboard state.

## Key screens and interactions

These rules govern presentation and reference the corresponding PRD sections without expanding feature scope.

| Screen | Visual focus and interaction | Requirement source |
| --- | --- | --- |
| Initial profile | Ask one question at a time, alternating companion guidance and student replies. A few choices may support grade and interest questions while retaining text input. Give diagnostic tasks their own focus. | #3 §4 |
| Learning home and course map | Make continuing the lesson the strongest action. Present knowledge nodes in sequence. Explain supplementary, review, and completed states in words. Exploration and the lab remain secondary destinations. | #3 §5, §6 |
| Paginated classroom | Explain one central concept on a clear teaching surface. Keep the heading, explanation, example, and takeaway together, with playback and questions in a distinct glass control dock. Contents and pagination communicate position. | #3 §5.1 |
| Questions and resumption | Pause narration when a question interrupts. Preserve the current page above the conversation. Use a glass composer and a stable reading region for the answer. Show the paused position and a clear resume action; do not replace the lesson with full-screen chat. | #3 §5.1 |
| Practice and feedback | Focus on one question. Make the entire option area actionable. Explain the result and provide a next step after submission. Offer selection, move actions, or buttons as alternatives to dragging. | #3 §5.1, §6 |
| Free exploration | Present short answers directly. Use a scrolling handout for micro-courses, with section navigation, revisiting, and follow-up questions. Keep the composer clear of the final content. | #3 §5.2 |
| AI lab | Keep the task, adjustable variables, and observations together. They may sit side by side on desktop; mobile orders them as task, controls, and results. Show execution state and the conditions behind each result. | #3 §5.3 |
| Learning review | Explain the next recommendation with concrete evidence from questions or experiments. Do not manufacture precision through an undefined AI mastery score. | #3 §6 |

### Make classroom states distinguishable

- Narrating: playback can pause, captions are available, and the visible page remains synchronized with audio.
- Asking: retain pagination and teaching content; switching between text and voice does not discard input.
- Answer complete: resume from the interrupted position rather than silently advancing a page.
- Question about later material: give a brief response and explain that the course covers it later.
- Off-topic question: clearly confirm when a topic is saved for exploration, then return to the lesson.
- Preparing content: preserve readable material and state which part is being prepared.
- Network or generation failure: preserve input and position, offer retry, and distinguish a system failure from an incorrect student answer.

### Practice and experiment feedback

Selected, correct, and try-again states need both words and visual cues. Do not clear an answer after an incorrect submission. Offer an actionable hint and another attempt; the timing of answer disclosure follows teaching requirements.

Experiment data counts, parameters, outputs, and execution states must correspond. Label illustrative results as examples and do not generalize from a single run. Parameters need visible labels, ranges, and current values. Do not present unresolved programming languages or debugging capabilities as supported product commitments.

## Controls, media, and motion

Name the action in every button, such as resuming a lesson, checking an answer, or running an experiment. Emphasize one primary action per local task. Inputs need visible labels rather than placeholders alone. Icon buttons need accessible names.

**Never use text characters, Unicode symbols, or emoji as substitutes for SVG icons.** Arrows, back and next controls, play and pause controls, checkmarks, and question or status icons must use SVG from a consistent icon set. Keep actual text labels as text.

Default to either text or an icon when one communicates the meaning clearly. Do not pair them merely to repeat the same action or state. Prefer text for specific actions and familiar standalone icons for compact controls such as pause, back, and send; give icon-only controls an accessible name. Combine text and an icon only when each adds distinct information, such as an option label and its selection indicator. Reserve northeast arrows for external destinations. Indicate the current navigation item with a solid background, rounded corners, and stronger text weight.

Touch targets are at least 44 × 44. Keyboard focus uses a high-contrast 2-pixel outline with a 2-pixel offset. Move focus into an opened dialog and return it to the trigger on close. Do not trap keyboard users in nonmodal regions. Voice interaction requires a text alternative, recording status, and a stop action; denying microphone access must still allow task completion.

Make the question input the primary entry point in the classroom controls. Place a lightweight playback and pagination group on the left and a wider, standalone frosted-glass input on the right, with history outside the input. Do not enclose both groups in a shared panel. Use a short input hint and an icon-only send control. On mobile, place the tools above a full-width input.

Images serve learning. Keep aspect ratios and label positions consistent within a set. Classification labels must unambiguously correspond to their images. Missing images need an explanation and recovery state rather than an empty box. Use supplied assets or materials with clear provenance and usage conditions. Never substitute an image of the reference screen for editable interface content.

### 账号入口的构图与动效

登录、注册和找回密码页采用同一套入口视觉。顶栏的叶芽图标、知芽字标和主题按钮直接融入背景，不使用卡片背景、边框或阴影，也不附加宣传短句或背景播放按钮。桌面端将欢迎区与表单整体放在顶栏和页脚之间，使上下留白均衡；页脚位于短页面底部，长页面则随内容自然向下排列。手机端使用单列，优先保证表单完整可用。

入口应有适中的信息密度：欢迎文字靠近表单，避免窄小控件被大片留白包围。优先放大表单文字、输入框和主按钮，并收紧栏间距、表单内边距与字段间距；不通过整体缩放页面或压缩触控区域实现紧凑。较窄窗口允许文字自然换行，同时保留清晰的标签与完整操作区。

入口背景由大小、轮廓和明暗不同的柔边色块组成，以鼠尾草色为主，辅以少量暖色与亮部。色块独立漂移、缓慢变形并自然交叠，应能辨认出不规则的明暗区域，避免整张渐变图旋转、平行光带或规则圆球。动态氛围参考用户指定的 [Codex 页面](https://openai.com/zh-Hans-CN/codex/)，不要求复制其素材或实现。用户停留数秒便应能看出色块位置与轮廓的变化。变化应连续平滑，不出现闪烁、明显循环接缝、裸露的图层边缘或抢夺注意力的高亮。

- 不同色块采用不同的漂移速度、起始位置和变化阶段，避免同步往返；以十几秒至二十几秒的缓慢变化为调校起点，兼顾可感知的移动与平静的氛围。
- 鼠标移动带动背景产生柔和、有边界的偏移，表单和文字保持稳定。触屏无需模拟鼠标跟随，也不阻拦滚动或输入。
- 页面进入和账号视图切换使用约 240–480ms 的淡入与小幅上移；避免整页缩放、弹跳和逐字出现。验证码等步骤的内容切换也应有连贯反馈，不清空已有输入来制造动画。
- 按钮悬停轻微上移，按下轻微收缩；输入框聚焦时平滑突出边界。交互反馈以约 150–220ms 为起点，不延迟操作执行。
- 提交中的动作保留明确文字和禁用状态，可辅以小型进度动画；结果提示与确认弹窗轻柔出现。动效不能代替成功、失败或等待状态的文字说明。
- 开启系统“减少动态效果”时，关闭背景循环、鼠标跟随、位移动画和进度旋转，保留静态背景、焦点指示与状态文字。动画不可承担唯一的信息表达。

连续氛围动画仅用于账号入口，不扩展到需要持续阅读的课堂。教学动画应服务于概念解释，并提供暂停和文字说明；避免强制音频。深浅色均须检查动画完整过程中的对比度，正文和输入区域保持清晰、稳定。

## Language and student data

Invite students to look again at an image's features rather than merely declaring an answer wrong. Describe a need for a hint in this attempt rather than labeling the student as incapable. Tie encouragement to specific actions; avoid empty praise and streak pressure. Distinguish the companion and student with explicit role labels, using color only as a supporting cue.

Do not expose age, full identity, or internal profile fields on ordinary learning screens. Show only the information needed for the current profile step. Data collection, guardian flows, and content-safety policies remain subject to the PRD's open questions; do not settle them implicitly in mockups.

## Reject these defaults

- A flat page where background, teaching content, and controls share nearly identical tone and visual weight.
- Repeated rounded cards, capsule composers, filled navigation tiles, and shadows on every component.
- Glass on every surface, nested blur layers, or translucent body text and teaching diagrams.
- High-contrast decorative gradients, neon glows, and reflections that compete with the lesson. A quiet background gradient that makes translucent controls legible is appropriate.
- A marketing headline followed by a generic feature-card grid.
- A card for every paragraph, nested cards, and colorful badges for ordinary metadata.
- Chat bubbles, companion avatars, or decorative illustrations that overpower teaching content.
- Invented percentages, rankings, or automatically increasing numbers presented as learning evidence.
- Interaction available only through dragging, voice, hover, or color.
- Desktop columns copied to mobile, reduced text sizes, obscured content, or hidden overflow used to conceal layout defects.

## Inspect and deliver

Check task clarity first, then hierarchy, reading measure, state feedback, and detail. Inspect desktop and mobile with realistic Chinese copy lengths. Check light and dark themes, long headings, empty states, preparation, failure, and recovery.

动效验收不能只依赖静态截图：连续观察背景至少一次方向变化，实际操作主题切换、注册步骤、表单聚焦、提交与确认弹窗。检查鼠标响应、触屏滚动和减少动态效果模式；刷新后确认主题选择保留。不同高度的窗口都应保持合理留白，动画不得引入页面溢出、遮挡或输入丢失。

Inspect both the complete composition and individual controls. The background, teaching surface, and floating controls must remain distinguishable at a glance and in grayscale. Check glass over different underlying content, with blur disabled, and with opaque fallback surfaces. Verify that its text stays sharp and readable, and that floating panels do not obscure content at narrow widths or with the keyboard open. If the page still reads as a grid of similarly rounded cards, revise the composition rather than adding more blur or stronger shadows.

Design artifacts use editable text and layouts, semantic colors, consistent typography, and reusable visual patterns. Keep states of the same action consistent. Screenshots do not replace structural inspection: verify fonts, boundaries, and text overflow as well. A static prototype must not claim to implement voice, generation, evaluation, or synchronization. When delivering in Figma, use variables, text styles, and component instances; when delivering a frontend design gallery, use semantic HTML and shared CSS.

Frontend implementation follows the project's React, TypeScript, Vite, and Tauri boundaries. These guidelines do not require another UI framework; use native semantics and existing components for behavior. Validate keyboard access, screen readers, zoom, and real devices during implementation. Figma inspection cannot substitute for runtime acceptance.

## View the static design gallery

Open [demo.html](demo.html) in a browser, or serve the repository with `uv run --no-project python -m http.server 4173 --bind 127.0.0.1` and visit `http://127.0.0.1:4173/docs/design/demo.html`. Gallery links navigate between screen examples. Product controls illustrate appearance only; they do not submit answers, record audio, run experiments, or store student data.

The gallery covers onboarding, the course map, narration, interrupted lessons, practice feedback, exploration, the lab, learning review, a graphite classroom, and recovery states. Resize the browser to inspect mobile layouts. Exported design images live in [screenshots/](screenshots/).

The cat examples load imagery from the GitHub issue attachment and require a network connection. Exported screenshots and PDFs are excluded from version control. Verify imagery rights before release. Google Fonts supplies the declared Noto families; local serif and sans-serif fallbacks remain available when offline.
