[README.md](https://github.com/user-attachments/files/32226955/README.md)
# 과제 도우미 챗봇 — 설치와 운영 안내

학생은 크롬북에서 **주소 하나만** 열면 됩니다. 로그인도, 계정도, 설치도 없습니다.
API 키와 안전 검사 규칙은 서버에만 있어서 학생이 개발자 도구를 열어도 보이지 않고, 검사를 건너뛸 수도 없습니다.

```
학생 크롬북  →  선생님이 만든 웹 주소  →  서버(키 보관, 안전 검사)  →  OpenAI
```

---

## 1. 준비물

- OpenAI 계정과 새 API 키 (기존에 채팅창에 붙여넣은 키는 폐기하고 새로 발급하세요)
- GitHub 계정, Vercel 계정 (둘 다 무료)
- 구글 계정 — 질문 기록을 스프레드시트로 받을 때 사용

---

## 2. 배포 (약 15분, 한 번만)

1. 이 폴더를 GitHub에 새 저장소로 올립니다. (GitHub 웹에서 `Add file → Upload files`로 폴더째 끌어다 놓아도 됩니다.)
2. [vercel.com](https://vercel.com)에 GitHub로 로그인 → `Add New → Project` → 방금 만든 저장소 선택 → `Deploy`.
3. 배포가 끝나면 `https://○○○.vercel.app` 주소가 생깁니다. 이 주소가 학생에게 줄 링크입니다.
4. Vercel의 `Settings → Environment Variables`에서 아래 값을 넣고, `Deployments` 탭에서 `Redeploy`를 누릅니다.

| 이름 | 넣을 값 | 필수 |
|---|---|---|
| `OPENAI_API_KEY` | 새로 발급한 API 키 | 필수 |
| `TASK_TITLE` | 과제 제목 | 필수 |
| `TASK_DETAIL` | 과제 설명. **여기에 적힌 범위 안에서만 답합니다** | 필수 |
| `TASK_KEYWORDS` | 관련 낱말, 쉼표로 구분 | 권장 |
| `ANSWER_MODE` | `hint`(단서만) 또는 `explain`(설명해 줌) | 권장 |
| `CLASS_CODE` | 수업 코드. 넣으면 학생이 첫 화면에서 입력해야 함 | 권장 |
| `TASK_STARTERS` | 예시 질문. `|`로 구분 | 선택 |
| `LOG_WEBHOOK_URL` | 아래 4번에서 만드는 주소 | 선택 |
| `GUARD_MODEL` / `ANSWER_MODEL` | 쓸 모델 이름 (기본값 `gpt-5.4-mini`) | 선택 |

> **차시마다 과제 바꾸기**: `TASK_TITLE`, `TASK_DETAIL`, `TASK_KEYWORDS`만 고치고 `Redeploy`를 누르면 1분 안에 반영됩니다. 학생 링크는 그대로입니다.
>
> **모델 이름**: OpenAI가 모델을 자주 교체하므로, 배포 전에 platform.openai.com의 모델 목록에서 현재 쓸 수 있는 이름인지 확인하세요.

---

## 3. 수업 중 동작

학생이 질문을 보내면 서버가 두 단계를 거칩니다.

1. **안전 검사** — 금지어 즉시 차단 후, 모델이 `ok / offtopic / unsafe / help` 중 하나로 판정합니다. 판정을 읽지 못하면 막는 쪽으로 처리합니다.
2. **답변 생성** — `ok`일 때만 답합니다. 쉬운 말, 5문장 이내, 완성된 결과물 대신 방법과 예시, 마지막에 생각해 볼 질문 한 개.

`help` 판정(괴롭힘·힘든 마음 신호)은 답변 대신 어른에게 이야기하라는 안내와 1388 번호를 보여 주고, 기록에 따로 남습니다. **수업 후 기록에서 `help` 행은 반드시 확인해 주세요.**

---

## 4. 질문 기록을 구글 스프레드시트로 받기 (선택)

1. 새 구글 스프레드시트를 만들고 `확장 프로그램 → Apps Script`를 엽니다.
2. 아래 코드를 붙여넣고 저장합니다.

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const d = JSON.parse(e.postData.contents);
  if (sheet.getLastRow() === 0) sheet.appendRow(["시각", "학생", "질문", "판정", "답변"]);
  sheet.appendRow([d.time, d.name, d.text, d.verdict, d.reply]);
  return ContentService.createTextOutput("ok");
}
```

3. `배포 → 새 배포 → 웹 앱`, 실행 계정은 **나**, 액세스 권한은 **모든 사용자**로 두고 배포합니다.
4. 나온 주소를 Vercel의 `LOG_WEBHOOK_URL`에 넣고 `Redeploy`.

이제 학생 질문, 판정, 답변이 실시간으로 시트에 쌓입니다. 사전·사후 비교나 프롬프트 채점 자료로 바로 내려받아 쓸 수 있습니다.

---

## 5. 비용과 안전 관리

- OpenAI 대시보드 `Settings → Limits`에서 **월 사용 한도**를 꼭 걸어 두세요. 주소가 공개된 상태라 한도가 유일한 상한선입니다.
- `CLASS_CODE`를 설정하면 코드를 모르는 외부인은 질문을 보낼 수 없습니다. 수업 끝나고 코드를 바꾸면 그 링크는 사실상 잠깁니다.
- 수업이 끝난 뒤 링크를 아예 닫으려면 Vercel에서 프로젝트를 `Pause` 하거나 `OPENAI_API_KEY`를 지우면 됩니다.
- 학생 화면은 500자 제한이 걸려 있고, 직전 3번의 대화만 기억합니다.
- 학생 이름은 서버에 저장되지 않고 기록 시트에만 남습니다. 연구용이라면 실명 대신 **번호(예: 3-12)**를 쓰는 편이 개인정보 측면에서 안전합니다.

---

## 6. 수업 전 점검

- [ ] 선생님 크롬북에서 링크를 열고, 과제와 무관한 질문("좋아하는 아이돌 알려 줘")이 막히는지 확인
- [ ] 부적절한 질문이 막히는지 확인
- [ ] 정상 질문에 답이 잘 나오는지, 힌트 모드가 의도대로인지 확인
- [ ] 기록 시트에 행이 쌓이는지 확인
- [ ] 학생용 안내: 링크, 수업 코드, 이름 적는 방식(번호 권장)
