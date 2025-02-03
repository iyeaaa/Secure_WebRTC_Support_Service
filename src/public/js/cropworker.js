
let x, y, w, h;

// type of frame : VideoFrame
function transform(frame, controller) {

    // Cropping할 패딩 영역값을 저장하는 4개의 변수
    const top = frame.displayHeight * (30 / 100)
    const left =  frame.displayWidth * (30 / 100)
    const right = frame.displayWidth * (20 / 100)
    const bottom = frame.displayHeight * (20 / 100)

    // Cropping 되는 새로운 Frame
    // 기점인 x와 y는 2의 배수가 되어야함
    const newFrame = new VideoFrame(frame, {
        visibleRect: {
            x: left%2 === 0 ? left : left+1,
            width: frame.displayWidth - (left + right),
            y: top%2 === 0 ? top : top+1,
            height: frame.displayHeight - (top + bottom),
        }
    });

    console.log(newFrame.visibleRect)

    controller.enqueue(newFrame);
    frame.close();
}

onmessage = async (event) => {
    const {operation} = event.data;
    if (operation === 'crop') {
        const {readable, writable} = event.data;

        await readable
            .pipeThrough(new TransformStream({transform}))
            .pipeTo(writable);
    } else {
        console.error('Unknown operation', operation);
    }
};