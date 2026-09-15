// 학생 화면 상단에 보여 줄 과제 정보만 내려줍니다. 프롬프트 규칙은 내려보내지 않습니다.
export default function handler(req, res) {
  const starters = (process.env.TASK_STARTERS || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  res.status(200).json({
    taskTitle: process.env.TASK_TITLE || "오늘의 과제",
    taskDetail: process.env.TASK_DETAIL || "",
    needCode: Boolean(process.env.CLASS_CODE),
    starters,
  });
}
