// 학생 브라우저는 이 함수에만 요청을 보냅니다.
// API 키, 과제 설정, 안전 검사 규칙은 모두 서버에만 있어 학생에게 노출되지 않습니다.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const CFG = () => ({
  taskTitle: process.env.TASK_TITLE || "오늘의 과제",
  taskDetail: process.env.TASK_DETAIL || "선생님이 안내한 과제를 해결한다.",
  keywords: process.env.TASK_KEYWORDS || "",
  hintOnly: (process.env.ANSWER_MODE || "hint") === "hint",
  classCode: process.env.CLASS_CODE || "",
  guardModel: process.env.GUARD_MODEL || "gpt-5.4-mini",
  answerModel: process.env.ANSWER_MODEL || "gpt-5.4-mini",
  logUrl: process.env.LOG_WEBHOOK_URL || "",
});

// 1차 차단: 모델 호출 전에 즉시 거르는 표현
const HELP_WORDS = ["자살", "죽고 싶", "자해", "괴롭힘", "왕따", "때렸", "맞았어"];
const BLOCK_WORDS = ["야한", "음란", "성인물", "포르노", "마약", "폭탄 만드", "총 만드", "칼로 찌", "담배 사", "술 사"];

const MSG = {
  offtopic: "이건 이번 과제와 관련이 없는 질문 같아요. 과제에 대해 궁금한 점을 다시 물어봐 주세요.",
  unsafe: "이 질문에는 답할 수 없어요. 과제에 대한 질문으로 바꿔서 물어봐 주세요.",
  help:
    "지금 마음이 힘들거나 곤란한 일이 있다면 혼자 참지 말고 선생님이나 집에 계신 어른께 바로 이야기해 주세요. 전화로 이야기하고 싶다면 청소년 상담 1388로 걸 수 있어요.",
};

async function openai(model, messages, maxTokens) {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_completion_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function screen(text, cfg) {
  if (HELP_WORDS.some((w) => text.includes(w))) return "help";
  if (BLOCK_WORDS.some((w) => text.includes(w))) return "unsafe";

  const system = `너는 초등학교 5학년(만 11세) 학생용 학습 챗봇의 안전 검사기다.
학생의 질문을 읽고 ok, offtopic, unsafe, help 중 한 단어만 출력한다. 다른 말은 절대 쓰지 않는다.

판정 기준(위에서부터 우선 적용):
- help: 학생이 괴롭힘, 학대, 폭력 피해, 깊은 우울, 스스로를 해치고 싶은 마음을 내비칠 때
- unsafe: 폭력, 무기, 성적이거나 음란한 내용, 혐오 표현, 욕설, 술, 담배, 마약, 범죄 방법, 위험한 실험, 개인정보 요구 등 만 11세에게 부적절하거나 위험한 내용
- offtopic: 안전하지만 아래 과제와 관련이 없을 때(연예인, 게임, 잡담 등)
- ok: 안전하고 과제와 관련될 때. 과제에 필요한 낱말 뜻, 배경지식, 방법을 묻는 질문도 ok로 본다.

[이번 과제] ${cfg.taskTitle}
[과제 설명] ${cfg.taskDetail}
[관련 키워드] ${cfg.keywords}`;

  const out = await openai(cfg.guardModel, [
    { role: "system", content: system },
    { role: "user", content: text },
  ], 200);

  const m = out.toLowerCase().match(/ok|offtopic|unsafe|help/);
  return m ? m[0] : "unsafe"; // 판독 실패 시 막는 쪽으로
}

async function answer(text, history, cfg) {
  const system = `너는 초등학교 5학년 학생의 과제를 돕는 학습 도우미다.

[이번 과제] ${cfg.taskTitle}
[과제 설명] ${cfg.taskDetail}

지켜야 할 규칙
- 쉬운 우리말과 존댓말로, 5문장 이내로 짧게 답한다. 어려운 낱말은 바로 뜻을 붙인다.
- 이번 과제와 관련된 내용만 다룬다. 다른 화제로 넘어가지 않는다.
- 폭력, 무기, 성적이거나 음란한 내용, 혐오, 욕설, 술과 담배와 마약, 위험한 실험 방법은 어떤 방식으로도 쓰지 않는다.
- 학생이 그대로 제출할 수 있는 완성된 결과물(글 전체, 보고서, 감상문)은 대신 써 주지 않는다. 대신 쓰는 방법과 짧은 예시를 보여 준다.
- 학생의 이름, 주소, 연락처 등 개인정보를 묻지 않는다.
- 마지막 줄에 학생이 스스로 생각해 볼 질문을 하나 덧붙인다.
${cfg.hintOnly
      ? "- 힌트 모드: 정답을 바로 알려 주지 말고, 단서와 되묻는 질문으로 학생이 직접 찾아내도록 이끈다."
      : "- 설명 모드: 필요한 내용을 예시와 함께 차근차근 설명해 준다."}`;

  return await openai(cfg.answerModel, [
    { role: "system", content: system },
    ...history,
    { role: "user", content: text },
  ], 700);
}

async function writeLog(cfg, row) {
  if (!cfg.logUrl) return;
  try {
    await fetch(cfg.logUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
  } catch (e) {
    console.error("log failed", e.message); // 기록 실패가 수업을 막지 않도록 함
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const cfg = CFG();
  const { name = "", text = "", history = [], code = "" } = req.body || {};

  if (cfg.classCode && code !== cfg.classCode) {
    return res.status(200).json({ verdict: "code", reply: "수업 코드가 맞지 않아요. 선생님께 코드를 다시 확인해 주세요." });
  }
  const q = String(text).trim();
  if (!q) return res.status(400).json({ error: "empty" });
  if (q.length > 500) {
    return res.status(200).json({ verdict: "long", reply: "질문이 너무 길어요. 500자 안으로 줄여서 다시 보내 주세요." });
  }

  const stamp = new Date().toISOString();
  try {
    const verdict = await screen(q, cfg);
    if (verdict !== "ok") {
      await writeLog(cfg, { time: stamp, name, text: q, verdict, reply: MSG[verdict] });
      return res.status(200).json({ verdict, reply: MSG[verdict] });
    }

    const safeHistory = (Array.isArray(history) ? history : [])
      .slice(-6)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

    const reply = await answer(q, safeHistory, cfg);
    await writeLog(cfg, { time: stamp, name, text: q, verdict: "ok", reply });
    return res.status(200).json({ verdict: "ok", reply });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ verdict: "error", reply: "연결이 잠시 끊겼어요. 잠깐 기다렸다가 다시 보내 주세요." });
  }
}
