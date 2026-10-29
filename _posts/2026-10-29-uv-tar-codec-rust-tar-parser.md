---
title: Astral이 uv의 tar 파서 tar-codec과 상태 머신을 새로 짠 이유
description: 패키지 저장소와 설치 도구가 같은 tar 압축 파일을 다르게 읽는 파서 불일치 취약점을 막기 위해 Astral이 설계한 중첩 상태 머신과 tar-codec의 구조를 살펴본다.
category: 개발
tags:
  - Rust
  - 보안
reading_time: 8분
image: /assets/images/uv-tar-codec-rust-tar-parser-cover.svg
---

파이썬 패키지 저장소(PyPI)에 올라온 소스 배포판(`.tar.gz`)을 보안 검사기가 열어 본다. 안에는 평범한 `innocent.py` 하나만 들어 있고 악성 코드는 보이지 않는다. 검사를 통과한 패키지가 배포 목록에 올라간다.

그런데 터미널에서 `uv`나 `pip`로 같은 파일을 설치하는 순간 검사기에는 안 보이던 `evil.py`가 풀려나와 빌드 과정에서 실행된다. 512바이트 블록이 이어진 같은 바이트 스트림을 두고 검사 파서와 설치 파서가 파일의 시작과 끝을 다르게 읽었을 뿐이다.

Astral의 윌리엄 우드러프(William Woodruff)가 쓴 [`tar-codec` 소개 글](https://astral.sh/blog/tar-codec)과 [GeekNews](https://news.hada.io/topic?id=36141)·[Lobste.rs 토론](https://lobste.rs/s/q7arzy/fast_secure_tar_parser_for_rust_ecosystem)은 47년 된 `tar` 포맷의 모호함을 상태 머신으로 잠근 과정을 보여 준다. `uv 0.13`의 기본 파서가 된 `tar-codec`이 속도를 두 배로 높이면서 파서 간 해석 차이를 차단한 방식을 짚어 본다.

<!--more-->

## 같은 압축 파일에서 다른 파일이 나오는 파서 역동기화

<figure>
  <img src="/assets/images/uv-tar-codec-rust-tar-parser-differential.svg" alt="동일한 512바이트 tar 블록 스트림을 두고 패키지 저장소 검사기는 innocent.py만 보고 통과시키지만, 설치 도구의 관대한 파서는 헤더 경계를 다르게 해석해 evil.py를 꺼내는 파서 역동기화 과정을 비교한 그림">
  <figcaption>파일 크기나 확장 헤더 해석이 한 번 어긋나면 두 파서가 보는 아카이브의 파일 목록 자체가 갈라진다.</figcaption>
</figure>

파이썬 패키지는 빌드된 `wheel`(`bdist`)과 소스를 묶은 `sdist`로 나뉜다. `wheel`은 고정된 ZIP이라 설치 시 코드를 실행하지 않지만 `sdist`는 빌드 스크립트를 돌려야 하는 `tar` 아카이브다. PyPI 프로젝트의 91~95%가 `sdist`를 배포하며 누적된 `.tar.gz`만 약 986만 개(약 12TB)에 달한다.

파이썬 생태계는 `sdist`가 빌드 시점에 임의 코드를 실행한다는 이유로 파서 간 작은 차이를 대수롭지 않게 여겼다. 하지만 지난해 Edera의 'TARmageddon' 등 보안 보고서가 잇따르면서 판단이 달라졌다. 파서 불일치(parser differential, 같은 입력을 파서마다 다르게 해석하는 현상)가 블록 경계를 무너뜨리는 '파서 역동기화(desynchronization)'로 이어지기 때문이다.

`tar`는 목차 없이 512바이트 헤더와 본문 블록이 번갈아 이어진다. 헤더의 크기(`size`)만큼 본문을 건너뛴 뒤 다음 헤더를 찾는데 이 크기를 읽는 기준이 파서마다 조금씩 다르다. 조작된 크기나 확장 헤더를 넣으면 검사 파서는 문제의 블록들을 앞 파일 본문으로 지나치지만 설치 파서는 중간 블록을 새 파일 헤더로 읽는다. **두 파서가 같은 아카이브에서 겹치지 않는 별개의 파일 집합을 꺼내는 셈이다.** 관대한 기존 파서(`astral-tokio-tar`)를 고쳐 쓰는 방식이 한계에 부딪히자 Astral은 모호한 입력을 거부하는 `tar-codec`을 새로 짰다.

## 512바이트 고정 블록 위에 47년간 덧댄 세 가지 방언

<figure>
  <img src="/assets/images/uv-tar-codec-rust-tar-parser-variants.svg" alt="1979년 UNIX V7 tar의 512바이트 고정 헤더 한계를 넘기 위해 POSIX UStar/pax와 GNU tar가 각기 다른 방식으로 확장 블록과 인코딩을 덧붙인 구조를 비교한 그림">
  <figcaption>앞선 블록의 본문이 뒤따르는 블록 헤더의 파일명과 크기를 덮어쓰면서 문맥 없는 파싱이 불가능해졌다.</figcaption>
</figure>

해석이 갈리는 뿌리는 1979년 UNIX V7 `tar`의 한계를 후대 표준들이 각자 다르게 우회한 데 있다. V7 `tar`는 데이터를 512바이트 블록으로 나눈다. 513바이트 파일을 담으려면 헤더 1개와 본문 블록 2개를 합쳐 1,536바이트를 써야 하고 빈칸은 `NUL`로 채운다. 파일명과 링크 대상은 각 100바이트로 제한됐고 크기는 12바이트 공간에 8진수 문자열(최대 `0o77777777777`, 약 8GiB)로 적었다.

이 제한을 넘으려 POSIX는 UStar에 이어 `pax`를 내놓았다. UStar는 `ustar\0` 매직 바이트와 155바이트 `prefix`로 경로를 255바이트까지 늘렸고 `pax`는 확장 헤더 블록을 앞에 세웠다. 타입플래그 `x`는 다음 파일 하나에 적용되는 지역(local) 헤더이고 `g`는 뒤따르는 모든 파일에 적용되는 전역(global) 헤더다. 본문에는 `13 size=8000\n`처럼 `<길이> <키>=<값>\n` 형태로 속성을 덮어쓰는데 우선순위는 **지역(`x`)이 가장 높고 그다음이 전역(`g`), 마지막이 파일 자신의 UStar 헤더다.**

반면 GNU `tar`는 UStar 초기 초안(`ustar ` 매직 바이트)에서 갈라져 나왔다. 크기가 8GiB를 넘으면 12바이트 필드의 첫 바이트 최상위 비트를 `1`로 켜고 나머지를 Base-256 이진수로 읽어 최대 $2^{80}$바이트까지 표현한다. 긴 파일명은 타입플래그 `L` 블록 본문에, 긴 링크 대상은 `K` 블록 본문에 담아 파일 헤더 앞에 쌓는다.

## 칠면조 속 오리 같은 중첩 상태 머신과 툼스톤의 함정

<figure>
  <img src="/assets/images/uv-tar-codec-rust-tar-parser-state-machine.svg" alt="단순한 UNIX V7 상태 머신과 달리 tar-codec이 첫 블록에서 UStar/pax와 GNU 계열을 잠그고 pax 툼스톤을 처리하는 중첩 상태 머신 구조를 비교한 그림">
  <figcaption>첫 헤더에서 아카이브 계열을 고정하고 pax 레코드의 3단 상태를 추적해 모호한 조합을 거부한다.</figcaption>
</figure>

Lobste.rs와 GeekNews 독자들이 반긴 대목은 복잡한 `tar` 규칙을 정리한 상태 머신 다이어그램이었다. 원래 V7 `tar`의 상태 머신은 단순하다. '헤더 대기(`AwaitingHeader`)'에서 시작해 `size > 0`이면 $\lceil\text{size}/512\rceil$개 블록만큼 '본문 읽기(`ReadingBody`)'를 반복한 뒤 돌아오고 헤더 대기 중에 0으로만 채워진 블록이 두 번 연속 나오면 종료(`Complete`)한다. 본문을 읽는 동안에는 블록 내용을 헤더로 보지 않는다.

하지만 `pax`와 GNU 확장이 끼어들면 앞 블록 본문을 끝까지 읽어야 다음 블록이 진짜 파일인지 또 다른 확장 헤더인지 알 수 있다. 우드러프는 이를 '상태 머신 터더킨(state machine turducken, 칠면조 속 오리처럼 중첩된 상태 머신)'이라 부른다. `tar-codec`의 첫 원칙은 **첫 비제로 헤더에서 아카이브 전체의 계열을 영구히 잠그는 것이다.** 첫 헤더가 POSIX(`ustar\0`)면 `USTAR/PAX`로, GNU(`ustar `)면 `GNU` 하위 상태 머신으로 진입하며 도중에 다른 계열이 섞이면 실패(`Failed`) 처리한다. GNU `L` 뒤에 `pax` `x`가 오고 `foo.txt`가 이어지는 혼합을 허용하면 `L`이 무엇의 이름을 바꾸는지 파서마다 다르게 해석하기 때문이다.

하위 상태 머신의 전이 조건도 엄격하다. `GNU` 경로에서는 파일당 `L`과 `K`가 최대 한 번씩만 나오게 제한해 중복 확장을 막았다. `USTAR/PAX` 경로에서는 전역 헤더(`g`) 본문이 끝나면 `AwaitingHeader`로 돌아가지만 지역 헤더(`x`) 본문이 끝나면 일반 UStar 헤더만 허용하는 `AwaitingUstarHeader`로 전이한다.

> If the <value> is of zero length, it shall delete any header block field, previously entered extended header value, or global extended header value of the same name.

여기에 POSIX `pax` 명세의 '툼스톤(tombstone, 삭제 표시)' 규칙이 더해진다. `8 path=\n`처럼 값이 빈 레코드는 UStar 값으로 돌아가라는 뜻이 아니라 해당 필드를 지우라는 뜻이다. 모든 `pax` 레코드는 미선언(Undeclared), 활성(Active), 툼스톤(Tombstoned) 세 상태를 가진다. 다른 파서들이 경로가 지워진 '이름 없는 파일'을 만나 엉뚱하게 동작할 때 `tar-codec`은 빈 경로나 전역 `size` 선언을 에러로 걸러낸다.

## 3계층 구조와 디스크 추출에서 마주친 현실적인 타협

<figure>
  <img src="/assets/images/uv-tar-codec-rust-tar-parser-layers.svg" alt="tar-framing과 tar-codec, archive-trait으로 이어지는 3단계 계층 구조와 cap-std 기반 디렉터리 고정 추출의 성능을 보여주는 그림">
  <figcaption>파싱 속도는 두 배 이상 끌어올리면서 디스크에 쓸 때는 디렉터리 탈출 방지를 위해 시스템 콜 비용을 감수한다.</figcaption>
</figure>

Astral은 이 상태 머신을 세 크레이트(Rust 패키지) 계층으로 나누어 위로 갈수록 제약이 강해지게 설계했다. 맨 아래 `tar-framing`은 블록 단위로 상태 머신을 진행하는 물리 API와 확장을 합쳐 멤버로 묶는 논리 API를 제공한다. 그 위의 `tar-codec`은 논리 API를 받아 파일을 풀어내고 맨 위의 `archive-trait`은 여러 포맷을 단일 인터페이스로 묶는다.

엄격한 검증에도 파싱 속도는 두 배 이상 빨라졌다. 체크섬과 `pax` 길이 파싱을 최적화하고 버퍼를 재사용한 덕분에 `uv` 벤치마크에서 기존 `astral-tokio-tar`가 702.8ms 걸리던 작업을 `tar-codec`은 329.4ms 만에 끝냈다. 호환을 위해 `SCHILY.xattr.*` 같은 비표준 레코드를 건너뛰는 옵션을 두고 파이썬 `tarfile`이 32바이트를 채울 때 `NUL`을 빼먹는 버그(`CPython#159322`)도 역동기화를 일으키지 않는 선에서 수용했다.

파일을 디스크에 쓰는 일은 또 다른 난관이었다. Lobste.rs에서 회자된 킨들 터치(Kindle Touch) 탈옥 사건은 디스크 추출의 위험을 잘 보여 준다. 당시 킨들은 업데이트용 `.tar.gz`를 먼저 푼 뒤 `/etc/authorized_keys`로 서명을 검증했는데 아카이브에 `../../../etc/authorized_keys`를 넣어 인증 키를 덮어쓰는 공격에 뚫렸다. **`archive-trait`은 경로 탈출과 심볼릭 링크 공격을 막기 위해 권한 기반 파일시스템 라이브러리 `cap-std`로 추출 폴더를 고정한다.** 리눅스에서는 커널의 `openat2`(`RESOLVE_BENEATH`)로 상위 폴더 탈출을 한 번에 막지만 이 기능이 없는 macOS 등에서는 경로가 깊어질수록(`a/b/c`) 중간 디렉터리 핸들을 하나씩 열며 검증하느라 추출 비용이 늘어난다. 우드러프는 다른 파서들의 취약점도 제보했으며 다음으로 `uv`의 ZIP 파서를 교체할 계획이다.

출처: Astral, [tar-codec: a fast and secure tar parser for the Rust ecosystem](https://astral.sh/blog/tar-codec) · [GeekNews 토픽 #36141](https://news.hada.io/topic?id=36141) · [Lobste.rs 토론](https://lobste.rs/s/q7arzy/fast_secure_tar_parser_for_rust_ecosystem).
