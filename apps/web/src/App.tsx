import { FormEvent, ReactNode, useEffect, useState } from "react";

type IconName = "home" | "course" | "explore" | "lab" | "map" | "bell" | "send" | "play" | "spark";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></>,
    course: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></>,
    explore: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="m9 13 1.4-4.1L14.5 7.5l-1.4 4.1z"/></>,
    lab: <><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M8 15h8"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    send: <><path d="m4 4 17 8-17 8 3-8z"/><path d="M7 12h14"/></>,
    play: <path d="m9 7 8 5-8 5z"/>,
    spark: <><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3z"/><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6z"/></>,
  };

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navigation = [
  { label: "今天", icon: "home" as const, href: "#today" },
  { label: "课程", icon: "course" as const, href: "#course" },
  { label: "探索", icon: "explore" as const, href: "#explore" },
  { label: "实验室", icon: "lab" as const, href: "#lab" },
  { label: "学习地图", icon: "map" as const, href: "#path" },
];

const spaces = [
  { id: "course", title: "课程学习", text: "跟着清晰的路线，一步步学会新知识。", icon: "course" as const, accent: "blue", action: "查看课程" },
  { id: "explore", title: "自由探索", text: "从一个好奇的问题，展开一段微课程。", icon: "explore" as const, accent: "violet", action: "去探索" },
  { id: "lab", title: "AI 实验室", text: "调参数、跑代码，亲手看看 AI 怎么工作。", icon: "lab" as const, accent: "green", action: "开始实验" },
];

export function App() {
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState("today");

  useEffect(() => {
    const syncSection = () => setActiveSection(window.location.hash.slice(1) || "today");
    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value) {
      setMessage("先写下一个你想知道的问题。");
      return;
    }
    setMessage(`已为你准备“${value}”的探索路线。`);
    setQuestion("");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">跳到主要内容</a>

      <aside className="sidebar" aria-label="主导航">
        <a className="brand" href="#today" aria-label="LearnMate 首页">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span translate="no">LearnMate</span>
        </a>
        <nav className="side-nav">
          {navigation.map((item) => (
            <a className={activeSection === item.href.slice(1) ? "nav-link active" : "nav-link"} href={item.href} key={item.label} aria-current={activeSection === item.href.slice(1) ? "page" : undefined}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar" aria-hidden="true">航</div>
          <div className="profile-copy">
            <strong>小航</strong>
            <span>小学高年级</span>
          </div>
        </div>
      </aside>

      <header className="mobile-header">
        <a className="brand" href="#today" aria-label="LearnMate 首页">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span translate="no">LearnMate</span>
        </a>
        <button className="icon-button" type="button" aria-label="查看通知"><Icon name="bell" /></button>
      </header>

      <main id="main" className="main-content">
        <section id="today" className="intro" aria-labelledby="greeting">
          <div>
            <h1 id="greeting">早上好，小航</h1>
            <p>准备好继续发现 AI 的小秘密了吗？</p>
          </div>
          <div className="streak" aria-label="连续学习 5 天">
            <span className="streak-dot" aria-hidden="true" />
            <strong>5 天</strong>
            <span>连续学习</span>
          </div>
        </section>

        <div className="dashboard-grid">
          <div className="primary-column">
            <section id="classroom" className="lesson-card" aria-labelledby="lesson-title">
              <div className="lesson-main">
                <div className="lesson-meta"><span className="subject-dot" />人工智能启蒙 · 第 4 课</div>
                <h2 id="lesson-title">让机器学会分类</h2>
                <p>接下来，你会亲手训练一个能分辨猫和狗的小模型。</p>
                <a className="primary-button" href="#classroom"><Icon name="play" size={18} />继续学习</a>
              </div>
              <div className="lesson-visual" aria-label="课程进度 62%">
                <div className="orbital-diagram" aria-hidden="true">
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                  <span className="data-node cat">猫</span>
                  <span className="data-node dog">狗</span>
                  <span className="model-node"><Icon name="spark" size={24} /></span>
                </div>
                <div className="progress-copy"><strong>62%</strong><span>本课进度</span></div>
              </div>
            </section>

            <section className="ask-panel" aria-labelledby="ask-title">
              <div className="ask-heading">
                <span className="mate-face" aria-hidden="true">●</span>
                <div><h2 id="ask-title">今天想知道什么？</h2><p>一句话、小问题、奇怪想法，都可以。</p></div>
              </div>
              <form onSubmit={submitQuestion}>
                <label className="sr-only" htmlFor="question">向 LearnMate 提问</label>
                <div className="question-box">
                  <input id="question" name="question" autoComplete="off" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="比如：机器人怎么认出我的脸？…" />
                  <button type="submit"><span>开始探索</span><Icon name="send" size={18} /></button>
                </div>
              </form>
              <div className="suggestions" aria-label="问题示例">
                {[
                  "AI 为什么会犯错？",
                  "用动画讲讲冒泡排序",
                  "我想做一个猜数字游戏",
                ].map((item) => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}</button>)}
              </div>
              <p className="feedback" role="status" aria-live="polite">{message}</p>
            </section>

            <section aria-labelledby="spaces-title">
              <div className="section-heading"><h2 id="spaces-title">选择学习方式</h2><p>你可以随时换一种方式。</p></div>
              <div className="space-grid">
                {spaces.map((space) => (
                  <a className={`space-card ${space.accent}`} href={`#${space.id}`} id={space.id} key={space.title}>
                    <span className="space-icon"><Icon name={space.icon} size={24} /></span>
                    <h3>{space.title}</h3>
                    <p>{space.text}</p>
                    <span className="space-action">{space.action}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <aside className="progress-column" aria-label="学习进度">
            <section className="week-card">
              <div className="section-heading compact"><h2>这周的脚印</h2><span>3 / 5</span></div>
              <div className="week-bars" aria-label="本周学习 3 天">
                {["一", "二", "三", "四", "五", "六", "日"].map((day, index) => (
                  <div key={day} className={index < 3 ? "day complete" : "day"}><span>{index < 3 ? "✓" : ""}</span><small>{day}</small></div>
                ))}
              </div>
              <p>再学 2 天，就能点亮本周徽章。</p>
            </section>

            <section id="path" className="path-card">
              <div className="section-heading compact"><h2>正在走的路</h2><a href="#path">查看地图</a></div>
              <ol className="path-list">
                <li className="done"><span>1</span><div><strong>认识数据</strong><small>已经掌握</small></div></li>
                <li className="current"><span>2</span><div><strong>学会分类</strong><small>正在学习</small></div></li>
                <li><span>3</span><div><strong>训练小模型</strong><small>下一站</small></div></li>
                <li><span>4</span><div><strong>挑战分类任务</strong><small>还未开始</small></div></li>
              </ol>
            </section>

            <section className="insight-card">
              <span className="insight-icon"><Icon name="spark" size={18} /></span>
              <div><strong>LearnMate 发现</strong><p>你用图片理解“分类”最快，下一课会多放一些图示。</p></div>
            </section>
          </aside>
        </div>
      </main>

      <nav className="bottom-nav" aria-label="移动端主导航">
        {navigation.slice(0, 4).map((item) => (
          <a className={activeSection === item.href.slice(1) ? "active" : ""} href={item.href} key={item.label} aria-current={activeSection === item.href.slice(1) ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></a>
        ))}
      </nav>
    </div>
  );
}
