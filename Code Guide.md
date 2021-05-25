## 이정륜 교수님 마이크로프로세서응용설계실습

##### 조교 이영빈

# Code guide

</br>

**안녕하세요. 이 문서는 실습 과제를 진행하는 데 있어 겪으시는 문제에 조금이나마 도움을 드리고자 작성되었습니다.**

**main.c의 플로우에 대해 간략하게 설명해 놓았으니 코드를 작성하시는 데 참고하시면 좋을 것 같습니다.**

**프로그램을 작성하는 데 있어 문제를 겪지 않으신 분들은 이 글을 읽지 않으셔도 좋습니다.**

**본 문서의 작성 기준이 된 main.c 파일은 게시글에 함께 첨부되어있습니다.**

</br>

일단 `main` 함수를 간략히 살펴보겠습니다.

## int main(int argc, char\* argv[])

```c
// From main.h
typedef union {
	unsigned char all;			// unsigned char는 8비트
struct {						// 비트필드 공용. 메모리 할당은 8비트.
		unsigned char  led : 1;	// 1비트 할당 * 5
		unsigned char  dot : 1;	// 속도면에서 손해. 저장공간면에서 이득.
		unsigned char  fnd : 1;
		unsigned char clcd : 1;
		unsigned char exit : 1;
	};
} seclection_t;


// From main.c
static seclection_t sel;

...

int main(int argc, char *argv[])
{
	int i;	//for문 안에서 사용하기 위해 미리 지정
	short *led, *dot[MAX_DOT], *fnd[MAX_FND];
	//
	short *clcd_cmd, *clcd_data, *keypad_out, *keypad_in;

	// 파일 오픈 루틴
	fd = open("/dev/mem", O_RDWR | O_SYNC);
	if (fd == -1)	{	// 에러 발생
		fprintf(stderr, "Cannot open /dev/mem file");
		exit(EXIT_FAILURE);
	}

	/*
	| ***** 메모리 매핑 *****
	| short *mapper(off_t offset, int prot)
	| PROT_WRITE : 쓰기 권한
	*/
	// 엘이디
	led = mapper(IEB_LED, PROT_WRITE);

	// 도트
	for (i = 0; i < MAX_DOT; i++)
		dot[i] = mapper(IEB_DOT[i], PROT_WRITE);

	// 매트릭스 (FND는 숫자 모양을 표현)
	for (i = 0; i < MAX_FND; i++)
		fnd[i] = mapper(IEB_FND[i], PROT_WRITE);

	// CLCD
	clcd_cmd = mapper(IEB_CLCD_CMD, PROT_WRITE);
	clcd_data = mapper(IEB_CLCD_DATA, PROT_WRITE);
	//keypad_out = mapper(IEB_KEY_W, PROT_WRITE);
	//keypad_in = mapper(IEB_KEY_R, PROT_READ);

	/***** 각종 초기화 함수들 *****/
	init_led(led);
	init_dot(dot);
	init_fnd(fnd);
	init_clcd(clcd_cmd, clcd_data);
	init_keypad(keypad_out, keypad_in);


	sel.all = 0;	// sel 유니온의 메모리 전체크기를 0으로 설정
	while (logic() == TRUE){}

	unmapper();
	close(fd);
	return 0;
}

...

truth_t logic()
{
	if (sel.all == 0)	{	// selection 공용체 이용. all(모든 비트)이 0이면 모드 선택으로.
		select_mode();
	}
	else if (sel.exit == 1)	{
		return FALSE;
	}
	else {
		input_mode();
	}

	return TRUE;
}
```

- main.c에서 제일 먼저 실행되는 함수는 main 함수(line: 28) 입니다. `main` 함수는 c언어 코드에서 제일 먼저 실행하기로 약속한 함수입니다.

- main 함수에서는 실행에 필요한 초기값을 설정하며 while문(line: 73)에 이르러서는 `logic` 함수(line:113)을 무한히 호출하는 loop에 진입합니다. 프로그램이 처음 실행되었거나, 혹은 초기 상태로 돌아가고자 하는 명령을 받았을 때(`sel.all == 0`) 입력값이 exit일 때(`sel.exit == 1`)가 아닌 경우 곧 해당 함수의 else문(line: 121)에 진입하며 곧 `input mode`함수를 무한히 호출합니다.

- `sel.all == 0` 일 경우 `select mode`(line: 128) 함수가 실행됩니다.

- `sel.exit == 1` 일 경우 프로그램이 종료됩니다.

</br>

코드가 처음 `logic()`에 진입하면 `select_mode()`을 실행합니다.

## void select_mode()

```c
void select_mode()
{
	int i;
	char buf[100];
	char clcd_str[20] = "";

	// 메모리 비우기 루틴
	led_clear();
	dot_clear();
	fnd_clear();
	clcd_clear_display();

	// 화면 표현
	printf("\n");
	printf("*********** Select device **********\n");
	printf("*   l (LED)       d (Dot Matrix)   *\n");
	printf("*   f (FND)       c (CLCD)         *\n");
	printf("*   a (All devices)                *\n");
	printf("*       press 'e' to exit program  *\n");
	printf("************************************\n\n");

	scanf("%s", buf);	// 입력(스트링)

	// 받은 입력으로 sel을 입력 길이만큼 변경
	for (i = 0; i < strlen(buf); i++){
		if (buf[i] == 'l'){sel.led = 1;}
		else if (buf[i] == 'd'){sel.dot = 1;}
		else if (buf[i] == 'f'){sel.fnd = 1;}
		else if (buf[i] == 'c'){sel.clcd = 1;}
		else if (buf[i] == 'e'){sel.exit = 1;
			break;
		}
		else if (buf[i] == 'a'){
			sel.all = 0xFF;	// 1111.1111
			sel.exit = 0;
			break;
		}
	}

	if (sel.led == 1){strcat(clcd_str, "LED ");	// clcd_str += "LED"}
	if (sel.dot == 1){strcat(clcd_str, "Dot ");}
	if (sel.fnd == 1){strcat(clcd_str, "FND ");}
	if (sel.clcd == 1){strcat(clcd_str, "CLCD");}
	clcd_write_string(clcd_str);	// 쓰러 감. 문자 값만 보내주면 자동으로 CLCD에
									// 띄워주는 프로세서를 가지고 있음.
}

}
```

- 기본적으로 `select_mode`는 main.h의 `selection_t`를 업데이트 하는 함수입니다.
- `selection_t` union은 사용자의 키보드 입력을 저장합니다.
- 예를 들어, 사용자가 d를 입력했을 경우 `select_mode` 함수는 union의 dot 바이트를 1로 변경해 주며(line: 154) 이는 `input_mode` 함수의 if문(line: 182)을 거쳐 dot에 정보를 입력하는 함수 `dot_write`를 호출합니다.
- 여러 글자를 입력하여도 `buffer`(line: 131)에 해당 입력이 모두 저장되므로 for loop(line: 152)을 이용하여 `sel`을 업데이트 할 수 있습니다.
- `sel.all`은 `selection_t` 내부의 모든 byte를 1로 만들어줍니다. 따라서 모든 기능을 사용하도록 지시합니다.

</br>

그러면 다음으로 input_mode 함수를 살펴보겠습니다.

## void input_mode()

```c
// 키패드 입력시(all != 0 and exit != 1 일때) 실행되는 루틴
// 값을 입력하는 모드
void input_mode()
{
	int key_count, key_value;
	char clcd_str[20];
	//key_count = keypad_read(&key_value);
	key_count = key_read(&key_value);	// 키밸류 포인터 전달

	if (key_count == 1){
		if (sel.led == 1){led_bit(key_value);}
		if (sel.dot == 1){dot_write(key_value);}
		if (sel.fnd == 1){fnd_write(key_value, 7);}
		if (sel.clcd == 1){
			sprintf(clcd_str, "%#04x            ", key_value);
			clcd_set_DDRAM(0x40);
			clcd_write_string(clcd_str);
		}
	}
	else if (key_count > 1){
		sel.all = 0;
	}
}
}
```

- input mode 함수 내에서 `key_count` 와 `key_value` 는 각각 '입력 문자열의 **길이**'와 '입력 문자열 **자체**'를 나타내는 변수입니다.

- 원래의 코드는 `key_count`가 1 이상이 될 경우, 즉 2개 이상의 입력이 주어질 경우 `select_mode`으로 빠져나가게 되어있습니다. 2글자 이상의 입력을 받고자 할 경우 이 부분을 수정해야 합니다.
- 또한 특정 함수가 '입력 문자열'을 받고자 할 경우 `key_count`가 아닌 `key_value`를 전달해야 함을 유념하세요.

</br>

## 이외의 함수들

```c
short *mapper(off_t offset, int prot)
{
	// mmap를 이용해서 열린 파일을 메모리에 대응시킨다.
    // map_data[]은 대응된 주소를 가리키고, map_data[]을 이용해서 필요한 작업을 하면 된다.
	// map_counter = 0 에서 시작. 함수가 실행될 때마다 1씩 증가.
	map_data[map_counter] = mmap(NULL, sizeof(short), prot, MAP_SHARED, fd, offset);

	if (map_data[map_counter] == MAP_FAILED){
		fprintf(stderr, "Cannot do mmap()");
		emergency_closer();
	}

	return (short *)map_data[map_counter++];
}

void unmapper()
{
	// map한 메모리들을 unmap 해준다.
	int i;
	for (i = 0; i < map_counter; i++)
	{
		munmap(map_data[i], sizeof(short));
	}
	map_counter = 0;
}

void emergency_closer()
{
	// 비상탈출
	unmapper();
	close(fd);
	exit(EXIT_FAILURE);
}
```

- `mapper` 함수는 mmap를 이용해서 열린 파일을 메모리에 대응시키는 역할을 합니다. 메모리와 관련하여 특수한 기능을 구현하지 않는 이상 따로 수정하실 필요는 없습니다.

- `unmapper`는 `mapper`로 map된 메모리를 해제해주는 과정입니다. 역시 따로 수정하실 필요가 없습니다.

- `emergency_closer`는 `mapper`에서 메모리 크래시가 일어났을 경우 호출되어 프로그램을 종료시키는 함수입니다.

</br>

## 그 외 자주 묻는 질문들

### Q. 기능을 추가할 때마다 꼭 .c 파일과 .h 파일을 새로 만들어야 하나요?

### A.

`main.c` 에서 모두 구현이 가능하다면 그러지 않아도 괜찮습니다. 헤더파일과 소스파일을 따로 만들어 관리하는 것은 유지보수의 편의성을 위함이지 코드 완성을 위한 필수사항이 아닙니다.

</br>

### Q. 외부 라이브러리를 사용해도 되나요?

### A.

수정하기 힘든 환경의 하드웨어에서도(Ximulator) 동작하는 것을 가정한 실습의 특성을 감안하면 기존에 include 된 표준 라이브러리만을 이용하기를 권장 드리지만 어쩔 수 없이 터미널에서 결과를 확인해야 하는 현 상황을 고려하여 외부 라이브러리를 include하는 것도 괜찮습니다.

터미널에서 실시간의 키보드 입력을 받기 위한 kbhit 함수를 구현하기 위해 termios, ncurses 등의 라이브러리를 이용하는 것이 예시가 될 수 있습니다.

</br>

### Q. `make xim` 실행 시 다음과 같은 에러가 발생합니다. 어떻게 해결해야 할까요?

### A.

```text
make: *** No rule to make target `xim'. Stop.
```

Makefile에서 소스파일 의존성에 관한 문제가 발생한 경우가 대다수입니다. 자신이 만든 모든 소스파일이 제대로 적혀있는지 확인해주세요. 바르게 동작하는 makefile의 예시를 아래 첨부합니다.

```makefile
CC := /usr/local/arm-linux-4.1.1/bin/arm-linux-gcc

OUTPUT		= keypad
SRCS		= ./src/main.c \
				./src/led.c\
				./src/dot.c\
				./src/fnd.c\
				./src/clcd.c\
				./src/keypad.c

CFLAGS		= -I./lib


$(OUTPUT) : $(SRCS)
	$(CC) $(CFLAGS) -o $@ $(SRCS)


xim : $(SRCS)
	@cd /usr/xim && $(MAKE) -s xim_OUTPUT="$(OUTPUT)" \
	xim_PATH="$(PWD)" xim_SRCS="$(SRCS)" xim_CFLAGS="$(CFLAGS)"

clean:
	@rm -f $(OUTPUT)
```

</br>

### Q. Ximulator에 Input 입력 시 엔터를 두 번 눌러야 제대로 입력되는데 어떻게 해결해야 하나요? 예를 들면 'c'를 눌러 clcd 모드로 변경하고자 하는데 c를 2번 입력해야만 변경이 됩니다.

### A.

해당 Input을 주기 기 전 눌린 엔터가 scanf의 입력으로 들어가 해당 문제를 일으켰을 가능성이 있습니다. 입력을 받는 scanf에 엔터를 무시하는 로직을 더해주세요. 이에 대해서는 다음 블로그 글을 참고해주세요.(https://blog.naver.com/PostView.nhn?blogId=zlatmgpdjtiq&logNo=221577996732)

단, 일괄적으로 엔터를 무시하는 로직을 추가할 경우 아예 입력이 들어가지 않는 문제가 발생할 수 있습니다. 개인의 재량에 따라 알맞은 방식으로 로직을 설계해주세요.
