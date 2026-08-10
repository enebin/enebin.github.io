---
title: 브라우저에서 사람을 빼면 무엇이 남을까, Cloudflare Kitesurf
description: 사람 대신 AI 에이전트를 위해 만든 경량 브라우저 Kitesurf의 구조와 성능, Hacker News의 기대와 의문을 정리했다.
category: 개발
tags:
  - AI tooling
reading_time: 9분
image: /assets/images/kitesurf-agent-browser-cover.svg
---

AI 에이전트에게 웹페이지 하나를 읽히려 하면 선택지가 금세 막힌다. HTML만 받아오면 자바스크립트로 뒤늦게 채워지는 내용이 빠진다. 그렇다고 크롬을 통째로 띄우면 메모리와 CPU를 많이 쓴다. 에이전트가 수백 개씩 동시에 움직일 때 이 차이는 곧 비용이 된다.

Cloudflare는 질문을 뒤집었다. 사람이 볼 브라우저를 에이전트도 쓰게 하지 말고, 처음부터 에이전트만을 위한 브라우저를 만들면 어떨까. 2026년 8월 공개한 **Kitesurf는 화면의 완벽함을 덜어내고 자동화에 필요한 부분만 남긴 브라우저 엔진**이다.

<!--more-->

## 사람용 브라우저에서 짐을 덜어냈다

크롬은 사람이 쓰는 도구다. 탭과 테마, 확장 프로그램, 기기 간 동기화가 필요하다. 화면은 부드럽게 움직여야 하고 CSS도 픽셀 단위로 정확해야 한다. AI 에이전트가 따지는 조건은 다르다. 메모리를 적게 쓰고, 입력 문맥이 짧고, 많이 띄울 수 있어야 한다. 비용도 미리 가늠할 수 있어야 한다.

Kitesurf는 이 차이에서 출발했다. Cloudflare Workers의 V8 아이솔레이트에서 실행된다. 작업이 끝나면 바로 버릴 수 있도록 상태도 거의 남기지 않는다. 아이솔레이트는 서로 격리된 작은 실행 공간이다. 페이지 하나가 문제를 일으켜도 다른 세션이나 실행 환경으로 번지지 않게 경계를 만든다.

<figure>
  <img src="/assets/images/kitesurf-agent-browser-cut.svg" alt="사람용 브라우저의 기능 중 AI 에이전트에 필요한 기능만 Kitesurf에 남기는 비교 그림">
  <figcaption>Kitesurf는 브라우저를 축소한 것이 아니라 우선순위를 다시 정했다.</figcaption>
</figure>

빼낸 기능이 많은 만큼 못 하는 일도 있다. Kitesurf는 아직 동영상과 WebGL을 처리하지 못한다. 실제 TLS 지문이 필요한 봇 차단 절차에도 맞지 않는다. 10분짜리 로그인 세션처럼 상태를 오래 유지해야 하는 작업도 어렵다. 이때는 기존 Chromium 기반 Browser Run을 쓰라고 Cloudflare도 안내한다.

지금 잘 맞는 일은 한 번 열고 끝내는 자동화다. 페이지에서 HTML을 꺼내거나 PDF와 스크린숏을 만드는 작업이 대표적이다. React와 Vue, Angular로 만든 TodoMVC도 렌더링한다. Wikipedia와 Hacker News, Cloudflare 블로그도 된다. 특정 사이트가 되는지는 직접 시험해 봐야 한다. 아직 베타다.

## 한 페이지를 네 개의 경계로 나눴다

Kitesurf의 중심에는 Engine, PageScript, PageRenderer가 있다. 외부 네트워크는 SandboxOutbound가 전담한다. 기능을 나눈 기준은 성능보다 권한이다. 에이전트는 어떤 페이지든 열어야 하므로 웹에서 들어오는 모든 값을 의심해야 한다.

Engine은 외부에서 들어오는 요청을 받는다. Chrome DevTools Protocol, 줄여서 CDP라는 크롬 자동화 규격을 받아 세션 상태를 보관한다. 덕분에 Puppeteer와 Playwright, Chrome DevTools처럼 이미 널리 쓰는 도구가 Kitesurf에도 연결된다.

PageScript는 HTML과 CSS를 읽고 페이지의 자바스크립트를 실행한다. HTML과 CSS를 처리할 때는 Rust로 작성된 모듈형 엔진 Blitz와 Firefox 계열 CSS 파서 Stylo의 일부를 쓴다. Workers가 기본으로 허용하지 않는 `eval`은 Rust 기반 자바스크립트 엔진 Boa를 WebAssembly로 올려 처리한다. 런타임 위에 런타임을 다시 얹으니 효율은 떨어진다. 지금은 작동을 우선한 임시 해법이다.

PageRenderer는 계산이 끝난 페이지를 PNG나 JPEG, PDF로 만든다. 이 부품은 페이지 상태를 갖지 않는다. 멈추거나 실패하면 Engine이 버리고 새로 띄울 수 있다. SandboxOutbound만 외부 이미지와 글꼴, 스크립트에 접근한다. CORS를 적용하고 응답을 거르며 페이지마다 쿠키 저장소를 분리한다.

<figure>
  <img src="/assets/images/kitesurf-agent-browser-components.svg" alt="요청이 Engine, PageScript, PageRenderer로 흐르고 SandboxOutbound만 외부 웹에 접근하는 구조도">
  <figcaption>페이지를 나누는 기준은 각 부품이 꼭 가져야 할 권한이다.</figcaption>
</figure>

실패를 다루는 방식도 이 구조를 따른다. 잘못된 입력을 만나도 세션 전체를 죽이지 않는다. 대신 빈 프레임이나 빠진 요소로 처리하고 원인을 로그에 남긴다. 화면을 완벽하게 그리는 것보다 작업을 이어가는 편을 택했다.

## 호환성은 시험 목록으로 넓힌다

브라우저를 새로 만든다는 건 HTML 몇 개를 그리는 일과 차원이 다르다. 웹에는 오래된 규칙과 예외가 겹겹이 쌓여 있다. Kitesurf 팀은 Web Platform Tests, 즉 WPT를 개발의 기준으로 삼았다. WPT는 브라우저가 웹 표준을 지키는지 공동으로 확인하는 시험 모음이다.

공개 시점의 Kitesurf는 WPT 약 21만 5천 개를 통과한다. CSS, DOM, HTML, 선택 영역, SVG, XHR처럼 에이전트에 중요한 영역은 이미 비교적 넓게 지원한다. 팀은 매주 통과하는 시험을 수백 개씩 늘리고 있다고 밝혔다.

표준 시험을 통과했다고 실제 사이트까지 잘 열린다는 보장은 없다. Chromium과 Kitesurf에 같은 Puppeteer 동작을 시키는 통합 시험을 따로 둔 이유다. 단계마다 화면을 저장하고 차이를 찾는 시각 회귀 시험도 돌린다. AI 에이전트가 구현 속도를 높였고, 사람은 기능 순서와 구조를 정했다. 시험은 둘이 따라갈 합격선을 그었다.

제품을 만든 방식도 흥미롭다. 첫 시제품은 AI 에이전트의 도움으로 기존 Rust 엔진을 Workers에 옮기며 만들었다. Cloudflare는 성공 조건과 질문할 지점을 자세히 정한 뒤 에이전트에게 반복 작업을 맡겼다고 설명한다. **복잡한 코드를 AI에 맡긴 비결은 자유를 많이 준 것이 아니라 시험할 답을 많이 준 데 있었다.**

## 비용을 줄인 대신 더 기다린다

Cloudflare가 공개한 성능표에는 장점과 약점이 함께 담겼다. 숫자는 14개 URL에서 Browser Run 빠른 작업을 다섯 번씩 실행한 중앙값이다. 비교 대상 Chromium은 미리 떠 있는 warm pool 상태다.

스크린숏을 만들 때 Kitesurf는 CPU 380ms와 메모리 57.8MiB를 썼다. Chromium은 CPU 1,173ms와 메모리 271.0MiB였다. HTML 추출에서는 Kitesurf가 CPU 229ms와 메모리 39.4MiB, Chromium이 CPU 877ms와 메모리 273.7MiB를 썼다. Cloudflare의 표현대로 CPU와 메모리는 작업에 따라 3배에서 7배 적다.

<figure>
  <img src="/assets/images/kitesurf-agent-browser-tradeoff.svg" alt="Kitesurf가 Chromium보다 CPU와 메모리를 적게 쓰지만 완료 시간은 더 긴 성능 비교 그림">
  <figcaption>한 작업은 늦게 끝나지만 같은 자원에 더 많은 작업을 올릴 수 있다.</figcaption>
</figure>

작업이 끝날 때까지 걸린 시간은 Kitesurf가 더 길었다. 스크린숏은 1,148ms로 Chromium의 637ms보다 1.8배 느렸다. HTML 추출은 820ms로 472ms보다 1.7배 느렸다. 차가운 소프트웨어 렌더러가 래스터화와 이미지 인코딩까지 해야 하는 탓이다.

Kitesurf를 무조건 빠른 브라우저라고 부르면 정확하지 않다. 한 요청을 가장 빨리 끝내기보다 같은 자원으로 많은 요청을 감당하려는 도구다. 짧은 작업이 한꺼번에 몰리는 에이전트 서비스에서는 CPU와 메모리 절감이 더 중요하다. 사람이 결과 하나를 기다리는 자동화라면 Chromium의 짧은 완료 시간이 낫다.

## Hacker News는 브라우저 밖을 물었다

Hacker News의 실제 Kitesurf 토론에서는 제품 밖의 문제가 더 오래 이어졌다. 가장 먼저 나온 질문은 Cloudflare가 한쪽에서는 봇을 막고 다른 쪽에서는 봇용 브라우저를 파는 모순이었다. Kitesurf가 Cloudflare의 봇 차단을 특별히 통과하는지 의심하는 댓글도 이어졌다.

Cloudflare 측 답변은 명확했다. Browser Run에서 나가는 Chromium과 Kitesurf 요청은 항상 봇 트래픽으로 식별된다. 정해진 사용자 에이전트를 쓰고 Web Bot Auth로 요청에 서명한다. Kitesurf는 자신을 숨기지 않으며 사이트 운영자는 지금도 차단할 수 있다는 설명이다. 이 답은 우회 의혹을 줄이지만, 봇 차단과 봇 실행을 한 회사가 함께 제공해도 되는가라는 사업 구조의 불신까지 없애지는 못했다.

보안 쪽에서는 더 근본적인 지적이 나왔다. V8 아이솔레이트는 악성 페이지가 실행 환경 밖으로 탈출하는 일을 막는다. 하지만 페이지 속 문장이 에이전트를 속여 원래 의도하지 않은 도구를 쓰게 하는 프롬프트 인젝션은 막지 못한다. 한 댓글은 상품 설명에 숨긴 지시가 에이전트 시대의 검색 조작으로 바뀔 수 있다고 지적했다. Kitesurf가 실행 코드의 권한을 나눴어도 에이전트가 읽은 내용과 실행할 행동 사이의 권한은 별도 문제로 남는다.

브라우저가 진짜 병목인지 묻는 반응도 설득력이 있었다. CAPTCHA와 문자 인증, 카드, 계정 승인은 렌더링 엔진을 가볍게 해도 사라지지 않는다. 에이전트에 필요한 핵심이 브라우저보다 휴대할 수 있는 신원과 결제 수단이라는 주장이다. Cloudflare가 Web Bot Auth와 x402 결제를 함께 밀고 있다는 답변은 Kitesurf를 더 큰 전략의 한 조각으로 보게 한다.

실제 쓰임새를 묻자 구체적인 사례가 모였다. 식단을 받아 온라인 장바구니를 채우는 개인 도구가 있었다. 영수증 여러 장에서 반품할 물건을 찾거나 복잡한 앱 배포 관리 화면을 대신 누르는 일도 나왔다. 조건에 맞는 상품 비교도 있었다. 모두 공개 API가 없거나 부족해서 사람이 브라우저로 반복하던 작업이다. 이 사례들을 보면 Kitesurf가 노리는 자리가 제품 설명보다 또렷해진다.

기술 쪽에서는 기반 엔진 Blitz로 시선이 모였다. Blitz 개발자는 Kitesurf의 수정 사항이 오픈소스로 돌아오길 기대했다. CDP 대신 W3C 표준인 WebDriver BiDi를 지원해 달라는 제안도 나왔다. Cloudflare는 Kitesurf를 곧 오픈소스로 공개하고 사용자가 자기 계정에 배포할 수 있게 하겠다고 밝혔다. 다만 Blitz가 아직 pre-alpha라고 명시한 만큼 실제 공개와 안정화 과정을 지켜봐야 한다.

## 크롬을 대신하기보다 빈칸을 채운다

Kitesurf는 새 범용 브라우저가 아니다. 크롬이 이미 잘하는 동영상과 정교한 화면, 긴 로그인 세션을 따라잡으려 하지 않는다. 대신 HTML 요청만으로는 부족하고 Chromium 전체를 띄우기에는 비싼 구간을 겨냥한다.

그 구간은 분명히 존재한다. 웹 자동화에는 화면을 완벽하게 보여주는 능력보다 DOM을 읽고 폼을 누른 뒤 결과를 돌려주는 능력이 더 중요할 때가 많다. CDP 호환성을 유지한 채 작업마다 격리된 엔진을 잠깐 띄울 수 있다면 기존 자동화 도구도 크게 바꾸지 않아도 된다.

가벼운 브라우저만으로 에이전트 웹의 어려움을 전부 풀 수는 없다. 차단을 통과할 신원, 결제를 승인할 권한, 페이지가 심은 지시를 거를 안전장치가 따로 필요하다. 모두 렌더러 밖에 있는 문제다. **Kitesurf의 가치는 브라우저를 완성했다는 데 있지 않고, 에이전트에게 브라우저의 어느 부분이 정말 필요한지 선을 그었다는 데 있다.**

지금은 Browser Run 베타에서 계정별 한도 안에 무료로 시험할 수 있다. 한 번 열고 버리는 HTML 추출이나 스크린숏 작업부터 Chromium과 결과, 비용을 나란히 재보면 된다. 지원하지 않는 기능을 만났을 때 기존 Chromium으로 돌아갈 경로는 남겨둬야 한다.

---

원문: [Introducing Kitesurf](https://blog.cloudflare.com/kitesurf/) (Cloudflare) / [Kitesurf 토론](https://news.ycombinator.com/item?id=49208393) (Hacker News)
