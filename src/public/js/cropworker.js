
let rt, rl, rr, rb;
let currentAbortController = null; // 진행 중인 작업의 취소 컨트롤러를 저장


function transform(frame, controller) {
    const top = frame.displayHeight * (rt / 100);
    const left = frame.displayWidth * (rl / 100);
    const right = frame.displayWidth * (rr / 100);
    const bottom = frame.displayHeight * (rb / 100);

    // 2의 배수 정렬 함수
    function alignTo(value, alignment) {
        return value - (value % alignment);
    }

    const roundedLeft = Math.round(left);
    const alignedLeft = alignTo(roundedLeft, 2); // 2의 배수로 조정

    const roundedTop = Math.round(top)
    const alignedTop = alignTo(roundedTop, 2)

    const newFrame = new VideoFrame(frame, {
        visibleRect: {
            x: alignedLeft,
            width: Math.round(frame.displayWidth - (left + right)),
            y: alignedTop,
            height: Math.round(frame.displayHeight - (top + bottom)),
        }
    });

    controller.enqueue(newFrame);
    frame.close();
}


onmessage = async (event) => {
    const { operation } = event.data;
    if (operation === 'crop') {
        const { readable, writable, top, bottom, left, right } = event.data;

        // 새로운 작업이 시작되기 전에 기존 작업이 있다면 취소합니다.
        if (currentAbortController) {
            currentAbortController.abort();
        }
        // 새 AbortController 생성
        currentAbortController = new AbortController();

        // 전역 변수에 값 저장(필요하다면)
        rt = top;
        rb = bottom;
        rl = left;
        rr = right;

        try {
            await readable
                .pipeThrough(new TransformStream({ transform }))
                .pipeTo(writable, { signal: currentAbortController.signal });
        } catch (err) {
            // abort로 인한 에러인 경우는 무시하거나 로그로 처리합니다.
            if (err.name === 'AbortError') {
                console.log('이전 작업이 취소되었습니다.');
            } else {
                console.error(err);
            }
        }
    } else {
        console.error('Unknown operation', operation);
    }
};