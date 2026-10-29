---
title: Cursor Agent SDK 공개와 에이전트 하네스 경쟁
description: 지침·도구·평가를 하나의 코드 프로젝트로 묶어 배포하는 Cursor Agent SDK의 구조와 오픈소스 하네스·모델 구독·워크로드 호스팅을 둘러싼 개발자 커뮤니티의 논쟁을 살펴본다.
category: 개발
tags:
  - AI tooling
  - 코드 리뷰
reading_time: 8분
image: /assets/images/cursor-agent-sdk-cover.svg
---

팀의 코드 리뷰나 장애 대응을 AI 에이전트에 맡기려고 웹 대시보드에 긴 프롬프트와 웹훅(이벤트가 생겼을 때 외부 주소로 알림을 보내는 방식)을 설정해 둔다. 처음 몇 번은 잘 돌아가지만 예외가 생길 때마다 프롬프트가 길어지고 누가 언제 어떤 조건을 바꿨는지 추적하기 어려워진다.

더 큰 문제는 권한과 검증이다. 프롬프트 한 줄을 고쳤더니 어제까지 잘 막던 위험한 변경을 승인해 버리거나 풀 리퀘스트 작성자가 승인 규칙 파일까지 함께 고쳐서 검사를 빠져나간다. 대화창에서 달래는 방식만으로는 회사의 보안과 감사 기준을 통과할 수 없다.

Cursor가 공개한 [Agent SDK](https://cursor.com/blog/agent-sdk)와 이를 다룬 [GeekNews](https://news.hada.io/topic?id=36138)·[Hacker News](https://news.ycombinator.com/item?id=50273731)의 토론은 이 한계를 어디서 풀어야 하는지 보여 준다. 에이전트를 대시보드 설정값이 아니라 버전 관리와 테스트가 가능한 코드 프로젝트로 다루려는 시도와 쏟아지는 에이전트 프레임워크를 바라보는 개발자들의 시선을 짚어 본다.

<!--more-->

## 프롬프트 설정창에서 Markdown과 TypeScript 프로젝트로

<figure>
  <img src="/assets/images/cursor-agent-sdk-project-structure.svg" alt="에이전트 프로젝트를 bot 폴더의 지침·도구·채널·하위 에이전트와 evals 폴더의 평가 코드로 나누고 모델의 판단과 결정론적 코드 처리를 결합하는 구조를 보여주는 그림">
  <figcaption>해석과 위험도 판단은 모델에 맡기고 외부 API 호출과 정책 검증은 코드로 고정한다.</figcaption>
</figure>

Agent SDK는 Cursor가 자체 코드 검토 서비스 Bugbot과 보안 검토 에이전트 Security Reviewer, Rollouts를 만들 때 쓰는 프레임워크다. 일정과 이벤트에 프롬프트만 연결하던 기존 Cursor Automations에서 나아가 AI의 판단 전후에 코드로 처리 절차를 심고 반복 검증할 때 쓰도록 설계됐다.

프로젝트 구조는 일반 저장소와 같다. `bot/` 폴더 아래에 모델과 실행 환경을 적는 `agent.ts`와 상시 지침인 `instructions.md`를 두고 도구는 `tools/`에 TypeScript 함수로 작성한다. 필요할 때 불러오는 절차는 `skills/`에 두고 MCP(외부 도구와 데이터를 연결하는 규격) 연결은 `mcp-connections/`에 넣으며 Slack이나 GitHub·GitLab·Bitbucket 이벤트를 받는 진입점은 `channels/`에 둔다. 복잡한 일은 `subagents/`의 하위 에이전트로 병렬 처리하거나 다른 에이전트에 넘긴다.

핵심은 **모델에 맡길 판단과 코드로 확정할 처리를 한 저장소에서 분리하는 데 있다.** Cursor 내부 팀은 과거의 교훈과 결정을 모든 PR에 대조하는 `kb-reviewer`를 약 하루 만에 구축해 주요 코드베이스에 적용했다. 기록된 교훈과 충돌하는 변경을 찾아 근거 노트를 인용하는 일은 모델이 맡고 이벤트를 받아 결과를 남기는 흐름은 코드가 제어한다.

이 분리는 담당자 정책 기반 승인 템플릿(`agentic-owners`)에서 더 분명해진다. 모델은 변경 위험도를 `very_low`부터 `high`까지 채점해 `record_review` 도구를 호출할 뿐 GitHub에 직접 승인하지 않는다. 실제 승인 여부는 호스트 코드가 PR의 기준 브랜치에서 `.agentic-owners/policy.yml`을 읽어 계산하므로 작성자가 PR 안에서 규칙을 고쳐 우회할 수 없다. `mode: hard` 경로는 반드시 사람이 승인해야 하고 정책 파일이 깨지면 승인을 보류한다.

## 답변 문장이 아니라 도구 호출과 행동을 잠그는 자동 평가

<figure>
  <img src="/assets/images/cursor-agent-sdk-hillclimbing-loop.svg" alt="고정된 PR 이벤트 픽스처로 에이전트를 실행하고 도구 호출과 부작용 차단 여부를 검사한 뒤 한 가지 레버만 수정해 성능을 끌어올리는 힐클라이밍 평가 루프를 보여주는 그림">
  <figcaption>실제 이벤트를 고정된 입력으로 재생하고 도구의 외부 쓰기를 막은 채 행동 계약을 검증한다.</figcaption>
</figure>

지침과 도구를 코드로 묶으면 에이전트를 감으로 고치는 대신 테스트로 검증할 수 있다. `evals/` 폴더에는 고정된 입력을 에이전트에 보내 호출한 도구와 응답을 검사하는 평가 코드(`*.eval.ts`)가 들어간다. 플레이그라운드에서 대화하며 확인하거나 `agent-sdk github replay`로 실제 PR 이벤트를 저장해 재생할 수도 있다.

평가가 먼저 보는 것은 말솜씨가 아니라 행동이다. PR 승인 테스트에서는 변경을 살피는 `inspect_pr`을 호출했는지(`t.calledTool`)와 함부로 승인하는 `approve_pr`을 호출하지 않았는지(`t.notCalledTool`)를 검사한다. 응답이 정해진 JSON 구조와 맞는지 확인하고 의미에 따른 품질은 별도 평가 모델(`t.judge.factuality`)로 채점한다.

평가 중에는 실제 도구가 실행되므로 외부에 댓글이 달리는 부작용을 막아야 한다. 평가 세션의 `ctx.session.purpose === "eval"` 값을 도구 안에서 확인해 외부 쓰기만 건너뛰고 결과만 반환하게 짜면 호출 기록은 남기면서 CI(코드 병합 때마다 테스트를 돌리는 환경)에서 안전하게 검증할 수 있다.

Cursor는 이 평가 위에서 한 번에 한 요소만 바꿔 성능이 올랐을 때만 유지하는 방식을 '힐클라이밍(Hillclimbing)'이라 부른다. 입력을 고정한 채 실패 원인을 한 문장으로 적고 호스트가 준비할 증거 데이터부터 지침이나 스킬, 도구 제한 순으로 작은 지렛대 하나만 고친다. 모델이 호스트에 있는 정보를 찾느라 헤매던 작업을 호스트 사전 준비로 옮기자 도구 호출은 14회에서 5회로 줄고 실행 시간은 92초에서 31초로 단축됐으며 반복 읽기는 6회에서 0회가 됐다.

> The Agent SDK has enabled PGA to build every component of our software factory on Cursor's infrastructure. It provides the flexibility we need to build agents that drive our development process. And built-in support for evals allows us to quickly iterate on new ideas and optimize existing capabilities reliably.

PGA Tour의 마이클 기어마시(Michael Gyarmathy)가 내장 평가로 새 아이디어를 검증하고 기존 기능을 개선했다고 밝힌 이유도 여기에 있다. **개선한 동작마다 그전에는 실패했을 평가 케이스를 추가해 잠가 두어야 다음 수정이 기존 동작을 깨뜨리지 않는다.**

## 왜 다들 에이전트 하네스를 다시 만들까: 구독 요금과 제어권

<figure>
  <img src="/assets/images/cursor-agent-sdk-harness-tradeoff.svg" alt="모델 제작사 공식 하네스, 오픈소스 하네스, 기업용 에이전트 SDK가 각각 구독 가성비와 모델 최적화, 모델 전환 자유도, 웹훅·보안·호스팅 제어권 중 무엇을 우선하는지 비교한 그림">
  <figcaption>개인의 대화형 코딩에서는 구독 가성비가, 기업의 백그라운드 자동화에서는 권한과 호스팅 제어권이 선택을 가른다.</figcaption>
</figure>

공개 직후 Hacker News와 GeekNews에서는 에이전트 하네스(모델 바깥에서 입력 전달과 도구 호출, 상태 관리를 맡는 실행 틀)를 둘러싼 논쟁이 벌어졌다. OpenAI와 Anthropic에 이미 Agent SDK가 있고 Vercel의 AI SDK나 Google의 ADK까지 있는데 같은 이름의 도구가 또 나왔다며 AI 생태계가 매주 새 프레임워크가 쏟아지던 JavaScript 생태계를 닮아 간다는 지적이었다. 스킬과 에이전트 흐름을 다듬는 일이 과거 UML 다이어그램에 매달리거나 Neovim 설정을 고치며 생산적이라 믿던 모습과 같다는 비판도 뒤따랐다.

왜 Pi나 OpenCode, Juggler 같은 오픈소스 하네스를 쓰지 않느냐는 질문에는 비용과 품질 이야기가 돌아왔다. 많은 개발자가 Opus 5.5나 Fable 5.1 같은 최상위 모델을 쓰는데 API 종량제보다 월 100~200달러짜리 Claude Code Max 구독으로 쓰는 편이 훨씬 저렴하기 때문이다. 오픈소스 하네스에서 `claude` CLI를 거쳐 구독 할당량을 쓰는 방법도 있지만 전환 비용을 감수할 이점이 불분명하고 모델 제작사가 자기 모델에 맞춰 하네스를 가장 잘 조율한다는 신뢰가 작용했다.

그렇다면 단순한 `PROMPT.md`와 기본 실행기만으로 충분하지 왜 별도 SDK가 필요할까. 기업 환경을 다루는 엔지니어들이 꼽은 답은 결정론적 경계와 통제력이다. 개인 작업은 터미널에서 범용 하네스를 띄워 두면 되지만 웹훅으로 돌아가는 사내 에이전트에는 대화형 UI나 로컬 상태 저장이 불필요하다. 대신 단계마다 다른 모델과 도구를 붙이고 권한을 사용자 범위에 맞게 코드로 좁히며 보안팀과 법무팀에 데이터 처리와 로그를 증명해야 한다. `agent-sdk deploy`가 푸시된 버전만 빌드하며 허용된 도메인(`egressDomains`)과 시크릿만 열거나 Node.js 22.13 이상의 자체 컨테이너 운영을 지원하는 이유다.

## 사람이 코드를 밀어 넣던 자리에서 에이전트 워크로드가 돌아갈 때

토론에서 가장 눈에 띄는 대목은 경쟁 축이 이동했다는 분석이었다. 10개월 전만 해도 새 SDK 발표는 프레임워크 유행으로 보였겠지만 지금 에이전트는 서버에서 돌아가는 '실행 워크로드(컴퓨터 자원을 쓰며 처리되는 작업 단위)'를 뜻한다. 누가 더 많은 워크로드를 호스팅하고 그 환경에서 다른 상품이나 상위 요금제를 추가로 판매하느냐의 싸움으로 넘어간 것이다.

Cursor의 제품 경험을 두고도 반응이 갈렸다. 탭 자동완성과 `cmd+k`로 맥락을 유지하며 빠르게 고치던 시절을 그리워하는 이들은 지금의 에이전트 중심 흐름이 슬롯머신을 돌리는 것 같다고 아쉬워했다. 반면 구독을 유지하는 팀들은 이미 사내 사용 승인을 받았고 자리를 비웠을 때도 클라우드 에이전트로 PR을 올리며 맞춤 에이전트를 배포할 수 있는 점에 매력을 느꼈다.

한 댓글은 이를 사람이 Git에 소프트웨어를 올리던 방식에서 에이전트가 배포하고 사람은 문제가 생길 때만 개입하는 방식으로 넘어가는 준비 과정이라고 짚었다. 사람이 직접 명령을 내리는 빈도가 줄고 에디터 사용량이 감소할 미래에 대비해 에디터 회사가 팀의 백그라운드 업무 공장을 선점하려 한다는 해석이다.

결국 **에이전트를 둘러싼 경쟁은 프롬프트 요령에서 벗어나 모델의 판단을 어떤 코드 울타리에 가두고 어디서 실행할 것인가의 문제로 모이고 있다.** 도구의 유행은 빠르게 바뀌어도 모델에게 어디까지 판단을 맡기고 무엇을 코드와 정책으로 잠글지 경계를 설계하는 일은 여전히 엔지니어의 몫이다.

출처: Cursor, [Agent SDK](https://cursor.com/blog/agent-sdk) · [GeekNews 토픽 #36138](https://news.hada.io/topic?id=36138) · [Hacker News 토론](https://news.ycombinator.com/item?id=50273731).
