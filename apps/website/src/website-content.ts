// Set VITE_PRODUCT_URL to the deployed learning app URL when it is available.
const configuredUrl = import.meta.env.VITE_PRODUCT_URL?.trim();
export const productUrl = configuredUrl && /^https?:\/\//i.test(configuredUrl) ? configuredUrl : null;

// Add real screenshots under public/images and set their URLs here.
// Empty entries intentionally render blank; no stock or mock classroom imagery.
export const classroomImages = [
  { src: "", alt: "知芽 AI 课堂：学生提问" },
  { src: "", alt: "知芽 AI 课堂：多模态讲解" },
  { src: "", alt: "知芽 AI 课堂：编程与实践" },
  { src: "", alt: "知芽 AI 课堂：学习反馈" },
];

export const stageImages = [
  { src: "", alt: "知芽 小学低年级教学实景" },
  { src: "", alt: "知芽 小学高年级教学实景" },
  { src: "", alt: "知芽 初中教学实景" },
  { src: "", alt: "知芽 高中教学实景" },
];

export const modalityImages = [
  { src: "", alt: "知芽 对话与语音教学实景" },
  { src: "", alt: "知芽 动画与绘本教学实景" },
  { src: "", alt: "知芽 编程与练习教学实景" },
];
