
let rt, rl, rr, rb;

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

    const roundedBottom = Math.round(bottom)
    const alignedBottom = alignTo(roundedBottom, 2)

    const newFrame = new VideoFrame(frame, {
        visibleRect: {
            x: alignedLeft,
            width: Math.round(frame.displayWidth - (left + right)),
            y: alignedBottom,
            height: Math.round(frame.displayHeight - (top + bottom)),
        }
    });

    controller.enqueue(newFrame);
    frame.close();
}


onmessage = async (event) => {
    const {operation} = event.data;
    if (operation === 'crop') {
        const {readable, writable} = event.data;
        const {top, bottom, left, right} = event.data;
        rt = top; rb = bottom; rl = left; rr = right

        await readable
            .pipeThrough(new TransformStream({transform}))
            .pipeTo(writable);
    } else {
        console.error('Unknown operation', operation);
    }
};