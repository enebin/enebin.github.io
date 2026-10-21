---
title: Android TV에서 광고를 걷어 내는 법
description: 홈 화면 배너를 끌 설정이 없는 Google TV에서 런처와 YouTube 앱을 갈아 끼우고 ADB로 마무리하는 방법을 정리하고 무엇을 되돌릴 수 있는지 함께 살펴본다.
category: 개발
tags:
  - Android TV
reading_time: 7분
image: /assets/images/ad-free-android-tv-cover.svg
---

TV를 켜면 화면 위쪽 절반을 큰 배너가 차지한다. 깔지도 않은 앱의 콘텐츠를 홍보하는 광고다. 설정에서 "앱만 보기" 모드를 켜 본다. 추천 줄은 사라지지만 배너는 그대로 남는다. 배너를 끄는 설정은 어디에도 없다.

Google TV를 쓰면 흔히 겪는 일이다. Cretezy 블로그의 글쓴이는 10월 19일 이 문제를 직접 푼 과정을 글로 남겼다. 글쓴이는 Android TV를 좋아한다. 앱이 많고 Chromecast로 싸게 쓸 수 있고 여러 TV에 기본으로 들어 있어서다. 다만 광고는 싫다.

해법은 Android TV를 버리는 게 아니다. 광고를 띄우는 앱을 다른 앱으로 갈아 끼우는 것이다. 이 글에서는 무엇을 바꾸는지, 왜 ADB라는 도구까지 꺼내야 하는지, 바꾼 것을 어떻게 되돌리는지 정리한다.

<!--more-->

## 광고는 두 군데서 나온다

<figure>
  <img src="/assets/images/ad-free-android-tv-map.svg" alt="홈 화면 배너는 Projectivy Launcher로, YouTube 광고는 SmartTube로, 리모컨 YouTube 버튼은 Button Mapper로 바꾸고, 그 아래 네트워크 층에서 Pi-hole이나 AdGuard DNS가 광고 도메인을 막는 구조를 보여주는 그림">
  <figcaption>앱을 바꾸면 기기 안의 광고가 사라지고 DNS를 바꾸면 광고 도메인 자체가 막힌다.</figcaption>
</figure>

홈 화면 배너는 런처가 띄운다. 런처는 TV를 켰을 때 처음 보이는 홈 화면 앱이다. 기본 런처를 그대로 두는 한 배너는 사라지지 않는다. 그래서 글쓴이는 런처를 Projectivy Launcher로 바꿨다. 이 런처는 사용자가 고른 앱만 보여 준다. 대안으로 FLauncher와 ATV Launcher Pro도 소개했다.

두 번째는 YouTube 앱이다. 글쓴이는 공식 앱 대신 SmartTube를 쓴다. SmartTube에는 광고가 없고 화면 구성도 더 낫다고 한다. SponsorBlock도 들어 있다. SponsorBlock은 영상 안의 협찬 구간을 건너뛰게 해 주는 기능이다. 글쓴이는 YouTube Premium을 계속 결제하면서도 SmartTube를 더 좋아한다고 적었다.

나머지 앱은 빈자리를 메운다. Button Mapper는 리모컨의 YouTube 버튼이 SmartTube를 열도록 바꾼다. Wholphin은 Jellyfin용 앱이다. Jellyfin은 집에 있는 영상을 직접 서버로 돌려 보는 미디어 서버다. Wholphin 대신 Moonfin을 써도 된다.

기기 밖에서 막는 방법도 있다. 글을 올린 다음 날 Hacker News 반응을 보고 추가한 내용이다. Pi-hole은 네트워크 전체에서 광고·추적 도메인을 DNS 단계에서 막는다. DNS는 도메인 이름을 실제 주소로 바꿔 주는 서비스다. `androidtvwatsonfe-pa.googleapis.com`을 막으면 기본 런처의 배너도 숨겨진다고 한다. 재시작이나 런처 캐시 삭제가 필요할 수 있다. Pi-hole이 없다면 TV의 비공개 DNS를 AdGuard DNS로 바꾸면 된다.

## 홈 화면은 ADB로 바꾼다

<figure>
  <img src="/assets/images/ad-free-android-tv-launcher.svg" alt="Projectivy를 홈 앱으로 지정하고, 기본 런처 launcherx를 끄고, 복구 패키지 setupwraith를 끄는 세 단계와 각 단계의 주의점을 순서대로 보여주는 그림">
  <figcaption>홈 앱을 먼저 정하고 기본 런처를 끈다. 마지막 단계는 저장된 Wi-Fi를 지울 수 있다.</figcaption>
</figure>

Projectivy에도 "현재 런처 덮어쓰기" 옵션이 있다. 하지만 이 방법으로는 기본 홈 화면이 잠깐씩 다시 보인다. 그래서 글쓴이는 ADB를 썼다. ADB는 컴퓨터에서 안드로이드 기기에 명령을 보내는 도구다.

먼저 연결부터 한다. 설정 → 시스템 → 정보 → Android TV OS 빌드를 일곱 번 누르면 개발자 옵션이 켜진다. 거기서 무선 디버깅을 켜고 페어링 코드로 컴퓨터와 짝을 짓는다. 무선 디버깅은 Wi-Fi가 있어야 한다. Wi-Fi를 쓰지 않는 기기는 USB 디버깅을 켜고 5555 포트로 연결한다. 글쓴이의 Hisense TV가 그런 경우였다.

앱 설치도 ADB로 돕는다. Projectivy, Wholphin, Button Mapper는 Play 스토어에 있다. ADB로 TV에 스토어 페이지를 띄우면 사용자는 설치 버튼만 누르면 된다. SmartTube는 Play 스토어에 없다. GitHub 최신 릴리스의 APK를 받아 ADB로 설치한다.

런처 교체는 세 줄이다. `$D`는 앞에서 연결한 TV의 주소다.

```bash
adb -s $D shell cmd package set-home-activity com.spocky.projengmenu/.ui.home.MainActivity
adb -s $D shell pm disable-user --user 0 com.google.android.apps.tv.launcherx
adb -s $D shell pm disable-user --user 0 com.google.android.tungsten.setupwraith
```

첫 줄은 Projectivy를 홈 앱으로 정한다. 둘째 줄은 기본 런처를 끄고 셋째 줄은 기본 런처를 되살리는 패키지를 끈다. **홈 앱을 먼저 정해야 한다.** 일부 기기에서는 setupwraith를 끄면 저장된 Wi-Fi가 지워진다. 그러니 리모컨을 가까이 두라고 한다. 기본 런처가 HDMI 입력 전환을 맡고 있을 수도 있다. 끈 뒤에는 입력 전환이 되는지 확인해야 한다.

## 리모컨 버튼과 남은 앱 정리

SmartTube를 깔았으면 공식 YouTube 앱을 지운다. 펌웨어에 내장된 기기에서는 `DELETE_FAILED_INTERNAL_ERROR`가 난다. 이때는 `pm uninstall --user 0`으로 현재 사용자에게서만 지운다.

리모컨 버튼을 바꾸려면 Button Mapper와 Projectivy를 접근성 서비스로 켜야 한다. 접근성 서비스는 다른 앱의 버튼 입력을 받아 처리할 수 있는 권한이다. 이 설정은 목록을 통째로 바꾼다. 그래서 기존 목록을 먼저 확인해 원래 있던 항목을 살려 두라고 한다. 안드로이드가 이 서비스를 슬쩍 꺼 버리는 일도 있다. 이를 막으려고 Button Mapper에 `WRITE_SECURE_SETTINGS` 권한을 준다. 그러면 스스로 서비스를 다시 켤 수 있다. 배터리 최적화 대상에서도 뺀다. 마지막으로 Button Mapper 앱에서 YouTube 버튼을 SmartTube에 연결한다.

남은 것은 정리다. 화면 전환 애니메이션 배율 세 가지를 0.75로 줄여 반응을 빠르게 한다. 쓰지 않을 Google 앱과 서비스 여섯 개도 끈다. 영상, 게임, YouTube Music, TV 추천, 피드백, 파트너 설정 패키지다. 쓰는 앱은 목록에서 빼고 없는 패키지 오류는 무시하면 된다. 더 줄이고 싶다면 cleanyourtv 프로젝트가 있다. 제조사 앱, 광고 서비스, 텔레메트리를 기기별 목록으로 정리해 두었다.

화질 설정도 덧붙였다. Filmmaker Mode나 Movie, Cinema 같은 중립 모드를 고른다. 모션 스무딩, 노이즈 감소, 다이내믹 콘트라스트는 끄고 취향대로 맞춘다.

## 되돌릴 길을 남겨 둔다

<figure>
  <img src="/assets/images/ad-free-android-tv-undo.svg" alt="앱 끄기는 pm enable로, 내장 YouTube 제거는 install-existing으로 되돌릴 수 있고, setupwraith 끄기와 기본 런처 끄기와 켜 둔 ADB 포트는 바로 확인해야 한다는 것을 세 칸으로 나눈 그림">
  <figcaption>대부분은 지운 게 아니라 끈 것이라 다시 켜면 돌아온다. 조심할 곳은 Wi-Fi, HDMI, 열린 ADB 포트다.</figcaption>
</figure>

이 작업에서는 대부분 지우지 않고 끈다. `disable-user`로 끈 앱은 `pm enable`로 다시 켠다. 현재 사용자에게서만 지운 YouTube는 `install-existing`으로 되살린다.

```bash
adb shell pm enable <패키지>
adb shell cmd package install-existing <패키지>
```

**작업이 끝나면 디버깅을 꺼야 한다.** 무선이든 USB든 마찬가지다. ADB 포트가 열려 있으면 같은 네트워크의 다른 기기가 TV에 접속할 수 있다. 런처를 바꾸고 광고를 막으려던 작업이 새 구멍을 남기는 셈이다.

글쓴이는 AI 에이전트에게 이 과정을 맡겨도 된다고 했다. 대신 명령마다 실행 전에 직접 확인하라고 덧붙였다. GeekNews 댓글에서도 의견이 갈렸다. ADB 명령을 AI에 맡기는 건 `curl | bash`와 비슷하지만 훨씬 예측하기 어렵다는 걱정이 나왔다. 반대로 Claude로 Chromecast의 Plex 문제를 고치고 VPN 클라이언트까지 만들었다는 경험담도 있었다. 어느 쪽이든 어떤 명령이 되돌리기 어려운지 알고 맡기는 편이 안전하다.

시험해 본 범위도 좁다. 글쓴이는 Chromecast with Google TV 두 대와 Hisense TV 한 대에서 해 봤다. 대부분의 Android TV 기기에서 될 거라고 했지만 다른 기기에서는 다르게 동작할 수 있다.

## 정리

광고 없는 TV는 설정 하나로 얻는 게 아니다. 광고를 띄우는 앱 두 개를 바꿔야 한다. 그 앱으로 가는 길인 홈 지정과 리모컨 버튼까지 손봐야 한다. 그러려면 ADB로 시스템 설정을 직접 건드릴 수밖에 없다.

댓글에는 아예 스마트 기능이 없는 TV를 사자는 의견도 있었다. 그런 TV는 비싸거나 찾기 어렵다는 반론이 이어졌다. 상업용 디스플레이를 쓰자는 말도, 스마트 TV를 인터넷에서 떼어 놓고 스트리밍 기기를 따로 붙이자는 말도 나왔다. 아이가 낮에 TV를 보는데 공포 영화 배너가 떴다는 Firestick 사용자의 이야기도 있었다.

처음 장면으로 돌아가 보자. 배너를 끄는 설정은 여전히 없다. 하지만 배너를 띄우는 홈 화면 자체는 바꿀 수 있다. 그 대가는 기기를 직접 관리하는 수고다. 무엇을 껐고 어떻게 되살리는지 알고 시작한다면 해 볼 만한 수고다.

출처: [Cretezy — An Ad-Free Android TV](https://cretezy.com/2026/ad-free-android-tv), [GeekNews — 광고 없는 Android TV 만들기](https://news.hada.io/topic?id=35697)
