---
title: 브라우저에서 사람을 빼면 무엇이 남을까, Cloudflare Kitesurf
description: 사람 대신 AI 에이전트를 위해 만든 경량 브라우저 Kitesurf의 구조와 성능, Hacker News의 기대와 의문을 정리했다.
category: 개발
tags:
  - AI tooling
reading_time: 8분
image: /assets/images/kitesurf-agent-browser-cover.svg
---

AI 에이전트에게 웹페이지 하나를 읽히려 하면 선택지가 금세 막힌다. HTML만 받아오면 자바스크립트로 뒤늦게 채워지는 내용이 빠진다. 그렇다고 크롬을 통째로 띄우면 메모리와 CPU를 많이 쓴다. 에이전트가 수백 개씩 동시에 움직일 때 이 차이는 곧 비용이 된다.

Cloudflare는 질문을 뒤집었다. 사람이 볼 브라우저를 에이전트도 쓰게 하지 말고, 처음부터 에이전트만을 위한 브라우저를 만들면 어떨까. 2026년 8월 공개한 **Kitesurf는 화면의 완벽함을 덜어내고 자동화에 필요한 부분만 남긴 브라우저 엔진**이다.

<!--more-->

## 사람용 브라우저에서 짐을 덜어냈다

크롬은 사람이 쓰는 도구다. 탭과 확장 프로그램, 기기 간 동기화가 필요하고 화면도 픽셀 단위로 정확해야 한다. 에이전트가 따지는 조건은 다르다. 메모리를 적게 쓰고, 많이 띄울 수 있고, 비용을 미리 가늠할 수 있어야 한다.

Kitesurf는 이 차이에서 출발했다. Cloudflare Workers의 V8 아이솔레이트에서 돌아간다. 아이솔레이트는 서로 격리된 작은 실행 공간이다. 페이지 하나가 문제를 일으켜도 다른 세션으로 번지지 않고, 작업이 끝나면 통째로 버릴 수 있다.

<figure>
  <img src="/assets/images/kitesurf-agent-browser-cut.svg" alt="사람용 브라우저의 기능 중 AI 에이전트에 필요한 기능만 Kitesurf에 남기는 비교 그림">
  <figcaption>Kitesurf는 브라우저를 축소한 것이 아니라 우선순위를 다시 정했다.</figcaption>
</figure>

덜어낸 만큼 못 하는 일도 있다. 동영상과 WebGL은 아직 처리하지 못한다. 실제 TLS 지문을 요구하는 봇 차단 절차도 통과하지 못하고, 10분짜리 로그인 세션처럼 상태를 오래 끄는 작업도 어렵다. 이럴 때는 기존 Chromium 기반 Browser Run을 쓰라고 Cloudflare도 안내한다.

지금 잘 맞는 일은 한 번 열고 끝내는 자동화다. 페이지에서 HTML을 꺼내거나 PDF와 스크린숏을 만드는 작업이다. React와 Vue, Angular로 만든 TodoMVC도, Wikipedia와 Hacker News도 렌더링한다. 다만 아직 베타라 특정 사이트가 열리는지는 직접 시험해 봐야 한다.

## 부품을 나눈 기준은 권한이다

Kitesurf는 Engine, PageScript, PageRenderer 세 부품과 외부 통로 SandboxOutbound로 나뉜다. 나눈 기준은 성능이 아니라 권한이다. 에이전트는 어떤 페이지든 열어야 하니 웹에서 들어오는 값은 전부 의심해야 한다.

Engine은 바깥 요청을 받고 세션 상태를 들고 있다. 크롬 자동화 규격인 CDP(Chrome DevTools Protocol)를 그대로 받는다. 덕분에 Puppeteer와 Playwright처럼 이미 쓰던 도구가 그대로 붙는다.

PageScript는 HTML과 CSS를 읽고 페이지의 자바스크립트를 실행한다. Rust로 만든 모듈형 엔진 Blitz와 Firefox 계열 CSS 파서 Stylo를 쓴다. Workers가 막아둔 `eval`은 Rust 자바스크립트 엔진 Boa를 WebAssembly로 올려 처리한다. 런타임 위에 런타임을 얹은 셈이라 효율은 떨어진다. 작동을 먼저 챙긴 임시 해법이다.

PageRenderer는 계산이 끝난 페이지를 PNG나 JPEG, PDF로 만든다. 상태를 갖지 않아서 멈추면 버리고 새로 띄우면 된다. 외부 이미지와 글꼴에 손댈 수 있는 건 SandboxOutbound뿐이다. CORS를 적용하고 응답을 거르며 페이지마다 쿠키 저장소를 나눈다.

<figure>
  <img src="/assets/images/kitesurf-agent-browser-components.svg" alt="요청이 Engine, PageScript, PageRenderer로 흐르고 SandboxOutbound만 외부 웹에 접근하는 구조도">
  <figcaption>페이지를 나누는 기준은 각 부품이 꼭 가져야 할 권한이다.</figcaption>
</figure>

실패를 다루는 방식도 같다. 잘못된 입력을 만나도 세션을 죽이지 않는다. 빈 프레임이나 빠진 요소로 처리하고 원인을 로그에 남긴다. 완벽하게 그리는 것보다 작업을 끝내는 쪽을 택했다.

그럼 제대로 그렸는지는 어떻게 확인할까. 브라우저를 새로 만드는 일은 HTML 몇 개를 그리는 일과 차원이 다르다. 웹에는 오래된 규칙과 예외가 겹겹이 쌓여 있다. 팀은 브라우저가 웹 표준을 지키는지 공동으로 확인하는 시험 모음 WPT(Web Platform Tests)를 기준으로 삼았다. 공개 시점에 약 21만 5천 개를 통과했고, CSS와 DOM, HTML, SVG처럼 에이전트에 중요한 영역은 이미 비교적 넓게 지원한다.

표준 시험을 통과했다고 실제 사이트까지 잘 열린다는 보장은 없다. Chromium과 Kitesurf에 같은 Puppeteer 동작을 시켜 결과를 비교하는 통합 시험을 따로 둔 이유다. 단계마다 화면을 저장해 차이를 찾는 시각 회귀 시험도 돌린다.

첫 시제품은 AI 에이전트가 기존 Rust 엔진을 Workers로 옮기며 만들었다. Cloudflare는 성공 조건과 질문할 지점을 미리 정해둔 뒤 반복 작업을 맡겼다고 설명한다. 에이전트가 구현 속도를 높였고 사람은 기능 순서와 구조를 정했다. **복잡한 코드를 AI에 맡긴 비결은 자유를 많이 준 게 아니라 채점할 시험을 많이 준 데 있었다.**

## 비용은 줄었고 대기는 늘었다

Cloudflare가 공개한 성능표에는 장점과 약점이 함께 담겼다. 14개 URL에서 짧은 작업을 다섯 번씩 실행한 중앙값이다. 비교 대상 Chromium은 미리 떠 있는 warm pool 상태라 시작 비용이 빠져 있다.

스크린숏 작업에서 Kitesurf는 CPU 380ms에 메모리 57.8MiB를 썼다. Chromium은 1,173ms에 271.0MiB였다. HTML 추출에서는 각각 229ms와 39.4MiB, 877ms와 273.7MiB를 썼다. Cloudflare의 표현대로 작업에 따라 CPU와 메모리를 3배에서 7배 적게 쓴다.

<figure>
  <img src="/assets/images/kitesurf-agent-browser-tradeoff.svg" alt="Kitesurf가 Chromium보다 CPU와 메모리를 적게 쓰지만 완료 시간은 더 긴 성능 비교 그림">
  <figcaption>한 작업은 늦게 끝나지만 같은 자원에 더 많은 작업을 올릴 수 있다.</figcaption>
</figure>

대신 끝나는 시간은 더 걸렸다. 스크린숏은 1,148ms로 Chromium의 637ms보다 1.8배, HTML 추출은 820ms로 472ms보다 1.7배 느렸다. 차가운 소프트웨어 렌더러가 래스터화와 이미지 인코딩까지 떠맡은 탓이다.

그래서 Kitesurf를 빠른 브라우저라고 부르면 어긋난다. 한 요청을 가장 빨리 끝내는 도구가 아니라 같은 자원으로 더 많은 요청을 받는 도구다. 짧은 작업이 한꺼번에 몰리는 에이전트 서비스라면 자원 절감이 중요하고, 사람이 결과 하나를 기다리는 자동화라면 Chromium이 낫다.

## Hacker News는 브라우저 밖을 물었다

Hacker News 토론에서는 제품보다 제품 밖의 문제가 오래 이어졌다. 첫 질문은 모순이었다. 한쪽에서 봇을 막는 회사가 다른 쪽에서 봇용 브라우저를 팔아도 되는가. Kitesurf가 Cloudflare의 봇 차단만은 특별히 통과하는 것 아니냐고 의심하는 댓글도 이어졌다.

Cloudflare의 답은 분명했다. Browser Run에서 나가는 요청은 Chromium이든 Kitesurf든 항상 봇으로 식별된다. 정해진 사용자 에이전트를 쓰고 Web Bot Auth로 요청에 서명하므로 사이트 운영자는 지금도 차단할 수 있다. 우회 의혹은 줄었지만, 차단과 실행을 한 회사가 함께 파는 구조에 대한 불신까지 사라지지는 않았다.

보안 쪽 지적은 더 근본적이었다. 아이솔레이트는 악성 페이지가 실행 환경 밖으로 나가는 걸 막지만, 페이지에 심어둔 문장이 에이전트를 속여 엉뚱한 도구를 쓰게 하는 프롬프트 인젝션은 막지 못한다. 상품 설명에 숨긴 지시가 에이전트 시대의 검색 조작이 될 거라는 댓글도 있었다. 실행 코드의 권한을 나눠도, 에이전트가 읽은 내용과 실행할 행동 사이의 권한은 별개 문제로 남는다.

브라우저가 진짜 병목이냐는 반응도 설득력이 있었다. CAPTCHA와 문자 인증, 카드, 계정 승인은 렌더링 엔진을 가볍게 해도 사라지지 않는다. 에이전트에 정말 필요한 건 들고 다닐 수 있는 신원과 결제 수단이라는 주장이다. Cloudflare가 Web Bot Auth와 x402 결제를 함께 밀고 있다는 답변은 Kitesurf를 더 큰 전략의 한 조각으로 보게 한다.

쓰임새를 묻자 구체적인 사례가 모였다. 식단을 받아 온라인 장바구니를 채우는 개인 도구, 영수증 여러 장에서 반품할 물건을 찾는 일, 복잡한 배포 관리 화면을 대신 눌러주는 일, 조건에 맞는 상품 비교. 모두 공개 API가 없거나 부족해서 사람이 브라우저로 반복하던 작업이다. 이 사례들을 보면 Kitesurf가 노리는 자리가 제품 설명보다 또렷해진다.

기술 쪽에서는 기반 엔진 Blitz로 시선이 모였다. Blitz 개발자는 Kitesurf의 수정 사항이 오픈소스로 돌아오길 기대했고, CDP 대신 표준인 WebDriver BiDi를 지원해 달라는 제안도 나왔다. Cloudflare는 곧 오픈소스로 공개하겠다고 밝혔지만 Blitz는 아직 pre-alpha다.

## 크롬을 대신하기보다 빈칸을 채운다

Kitesurf는 새 범용 브라우저가 아니다. 크롬이 이미 잘하는 동영상과 정교한 화면, 긴 로그인 세션을 따라잡으려 하지 않는다. HTML 요청만으로는 부족하고 Chromium을 통째로 띄우기에는 비싼 구간을 겨냥한다.

그 구간은 분명히 존재한다. 웹 자동화에서는 화면을 완벽하게 보여주는 능력보다 DOM을 읽고 폼을 누른 뒤 결과를 돌려주는 능력이 더 자주 필요하다. CDP 호환을 지킨 채 작업마다 격리된 엔진을 잠깐 띄울 수 있다면 쓰던 자동화 도구도 크게 바꾸지 않아도 된다.

물론 가벼운 브라우저 하나로 에이전트 웹의 어려움이 다 풀리지는 않는다. 차단을 통과할 신원, 결제를 승인할 권한, 페이지가 심은 지시를 거를 안전장치는 모두 렌더러 밖에 있다. **Kitesurf의 가치는 브라우저를 완성했다는 데 있지 않고, 에이전트에게 브라우저의 어느 부분이 정말 필요한지 선을 그었다는 데 있다.**

지금은 Browser Run 베타에서 계정별 한도 안에 무료로 시험할 수 있다. 한 번 열고 버리는 HTML 추출이나 스크린숏부터 Chromium과 결과, 비용을 나란히 재보면 된다. 안 되는 기능을 만났을 때 Chromium으로 돌아갈 길은 남겨두는 게 좋다.

---

원문: [Introducing Kitesurf](https://blog.cloudflare.com/kitesurf/) (Cloudflare) / [Kitesurf 토론](https://news.ycombinator.com/item?id=49208393) (Hacker News)
