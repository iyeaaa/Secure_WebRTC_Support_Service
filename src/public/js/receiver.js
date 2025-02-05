

const socket = io()

const input = document.getElementById("text input")
const sendMessageButton = document.getElementById("sendbtn")

const url = new URL(window.location.href); // 현재 페이지의 전체 URL
const params = url.searchParams;
const room = params.get("room")
const myVideo = document.querySelector(".video-overlay video")
const screenVideo = document.querySelector(".screen-share video")

let screenStream;
let screenPeerconnection;
let chattingPeerConnection;
let sendChannel;
let receiveChannel;

const startShareButton = document.querySelector(".screen-share-controls #startShareBtn")
const stopShareButton = document.querySelector(".screen-share-controls #stopShareBtn")
const screenCropBtn = document.querySelector(".screen-share-controls #screenCropBtn")

let slider = [0, 0, 0, 0, 0];

const worker = new Worker("./js/cropworker.js", {name: 'Crop worker'})
let readable, writable

if (room == null) {
    alert("Room is Null")
}

socket.emit("join", room)

function init() {
    getScreen()
        .then(() => {
            makeConnection()
            socket.emit("start", room)
        })
}

/* 영역선택버튼 클릭 */

document.querySelector('.slider-container').style.display = 'none'

function updateValue(sliderNumber, value) {
    document.getElementById("value" + sliderNumber).innerText = value;
    slider[sliderNumber] = value
}

screenCropBtn.addEventListener('click', function () {
    const sliderContainer = document.querySelector('.slider-container');
    if (sliderContainer.style.display === 'none' || sliderContainer.style.display === '') {
        sliderContainer.style.display = 'flex';
    } else {
        sliderContainer.style.display = 'none';
    }
});

// 적용 버튼을 눌렀을 때 실행될 함수
function applySliderValues() {
    // slider 배열에 저장된 값을 사용하여 croppingScreen 함수 호출
    // slider 값이 모두 있는지 확인하고, 없으면 기본값을 설정할 수 있습니다.
    const top = slider[1] || 0;
    const bottom = slider[2] || 0;
    const left = slider[3] || 0;
    const right = slider[4] || 0;
    console.log("적용 버튼 클릭:", top, bottom, left, right);
    croppingScreen(top, bottom, left, right);
}

/* 버튼 설정 */

function close() {
    screenStream.getTracks().forEach(track => track.stop());
    screenVideo.srcObject = null
    chattingPeerConnection.close()
    chattingPeerConnection = null
    screenPeerconnection.close()
    screenPeerconnection = null
    startShareButton.disabled = false
    stopShareButton.disabled = true
    screenCropBtn.disabled = true
}


startShareButton.disabled = false
stopShareButton.disabled = true
screenCropBtn.disabled = true

startShareButton.addEventListener("click", init)
stopShareButton.addEventListener("click", close)


// 화면 공유

async function getScreen() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "window",
            },
            audio: {
                suppressLocalAudioPlayback: false,
            },
            preferCurrentTab: false,
            selfBrowserSurface: "exclude",
            systemAudio: "include",
            surfaceSwitching: "include",
            monitorTypeSurfaces: "include",
        });
        startShareButton.disabled = true
        stopShareButton.disabled = false
        screenCropBtn.disabled = false
        croppingScreen(0, 0, 0, 0)
    } catch (err) {
        console.error("Error during screen capture", err);
    }
}

// 스트림에서 사이즈를 불러와 screen_width, screen_height에 저장한다
// function getScreenSize(screenStream) {
//     const {width, height} = screenStream.getTracks()[0].getSettings()
//     screen_width = width
//     screen_height = height
// }

function croppingScreen(top, bottom, left, right) {
    /* global MediaStreamTrackProcessor, MediaStreamTrackGenerator */
    if (typeof MediaStreamTrackProcessor === 'undefined' ||
        typeof MediaStreamTrackGenerator === 'undefined') {
        alert(
            'Your browser does not support the experimental MediaStreamTrack API ' +
            'for Insertable Streams of Media. See the note at the bottom of the ' +
            'page.');
    }

    // 첫번째 Track을 불러온다.
    const [track] = screenStream.getTracks();
    const processor = new MediaStreamTrackProcessor({track});
    readable = processor.readable

    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    writable = generator.writable;

    screenVideo.srcObject = new MediaStream([generator]);

    worker.postMessage({
        operation: 'crop',
        readable,
        writable,
        top, bottom, left, right
    }, [readable, writable]);

    makeConnection()
}


// RTC 연결

// handleAddStream에서 스트림 분리 처리
async function handleAddStream(event) {
    const incomingStream = event.streams[0];
    console.log("Received remote stream:", incomingStream);
    myVideo.srcObject = incomingStream

    console.log("Attaching screen share stream");
}

function makeConnection() {
    screenPeerconnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun.l.google.com:5349",
                    "stun:stun1.l.google.com:3478",
                    "stun:stun1.l.google.com:5349"
                ]
            }
        ]
    });


    chattingPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun.l.google.com:5349",
                    "stun:stun1.l.google.com:3478",
                    "stun:stun1.l.google.com:5349"
                ]
            }
        ]
    });

    setDataChannel()
    // myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
    if (screenVideo.srcObject)
        screenVideo.srcObject.getTracks().forEach(track => screenPeerconnection.addTrack(track, screenVideo.srcObject));
    setIce()
}

function setIce() {
    /*
        candidate : 소통하는 방식을 설명한다.
        브라우저에 의해 candidate가 생성된다.
    */
    screenPeerconnection.addEventListener("icecandidate", (data) => {
        socket.emit("ice", data.candidate, room, 0);
        console.log("sent screen ice")
    });
    screenPeerconnection.addEventListener("track", handleAddStream);

    chattingPeerConnection.addEventListener("icecandidate", (data) => {
        socket.emit("ice", data.candidate, room, 1);
        console.log("sent chat ice")
    });
}

/* Data Channel 설정 */

function setDataChannel() {
    // sendChannel 설정
    sendChannel = chattingPeerConnection.createDataChannel("sendChannel")
    sendChannel.onopen = handleSendChannelStatusChange;
    sendChannel.onclose = handleSendChannelStatusChange;

    // receiveChannel 설정
    chattingPeerConnection.ondatachannel = (event) => {
        receiveChannel = event.channel;
        receiveChannel.onmessage = handleReceiveMessage;
        receiveChannel.onopen = handleReceiveChannelStatusChange;
        receiveChannel.onclose = handleReceiveChannelStatusChange;
    };
}

function handleSendChannelStatusChange(event) {
    if (sendChannel) {
        const state = sendChannel.readyState;

        if (state === "open") {
            input.disabled = false;
            input.focus();
            sendMessageButton.disabled = false;
        } else {
            input.disabled = true;
            sendMessageButton.disabled = true;
        }
    }
}

function handleReceiveChannelStatusChange(event) {
    if (receiveChannel) {
        console.log("Receive channel's status has changed to " +
            receiveChannel.readyState);
    }
}

/* Setting Chat */

function timestamp2date(timestamp) {
    const hours = timestamp.getHours(); // 0~23 (24시간 형식)
    const minutes = timestamp.getMinutes(); // 0~59
    return `${hours > 12 ? '오후' : '오전'} ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`
}

sendMessageButton.addEventListener("click", event => {
    const currenttime = timestamp2date(new Date())
    let message = input.value;

    sendChannel.send(message);
    appendMessageToChat(message, currenttime, true)

    input.value = ""
    input.focus();
})

function handleReceiveMessage(event) {
    let message = event.data
    let time = event.timeStamp
    appendMessageToChat(message, timestamp2date(new Date(time * 1000)), false)
}

function createMessageElement(content, timestamp, isMine = false) {
    // Create the main container div
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isMine ? 'mine' : 'other');

    // Create the paragraph element for the message content
    const contentParagraph = document.createElement('p');
    contentParagraph.textContent = content;

    // Create the span element for the timestamp
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = timestamp;

    // Append the content and timestamp to the main container
    messageDiv.appendChild(contentParagraph);
    messageDiv.appendChild(timestampSpan);

    // Return the created element
    return messageDiv;
}

function appendMessageToChat(content, timestamp, isMine = false) {
    // Find the chat messages container
    const chatMessagesContainer = document.querySelector('.chat-messages');

    if (!chatMessagesContainer) {
        console.error('Chat messages container not found!');
        return;
    }

    // Create the message element
    const newMessage = createMessageElement(content, timestamp, isMine);

    // Append the new message to the chat messages container
    chatMessagesContainer.appendChild(newMessage);

    // Scroll to the bottom of the chat
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

/* Socket ON */

socket.on("start", async (nickname) => {
    /* 초대장을 만드는 과정 */
    console.log("recieved join")

    const offer1 = await chattingPeerConnection.createOffer();
    await chattingPeerConnection.setLocalDescription(offer1)

    const offer2 = await screenPeerconnection.createOffer();
    await screenPeerconnection.setLocalDescription(offer2)

    console.log("sent the offer");
    socket.emit("offer", offer1, offer2, room);
})

socket.on("offer", async (offer1, offer2) => {
    console.log("receive the offer")

    await chattingPeerConnection.setRemoteDescription(offer1);
    await screenPeerconnection.setRemoteDescription(offer2);

    const answer2 = await screenPeerconnection.createAnswer();
    await screenPeerconnection.setLocalDescription(answer2);
    const answer1 = await chattingPeerConnection.createAnswer();
    await chattingPeerConnection.setLocalDescription(answer1);

    socket.emit("answer", answer1, answer2, room);
    console.log("sent the answer");

})

socket.on("answer", async (answer1, answer2) => {
    console.log("receive the answer");
    await chattingPeerConnection.setRemoteDescription(answer1);
    await screenPeerconnection.setRemoteDescription(answer2)

})

socket.on("ice", async (ice, num) => {
    console.log("receive the ice from other client");

    if (num === 1) {
        await chattingPeerConnection.addIceCandidate(ice);
    }
    else if (num === 0) {
        await screenPeerconnection.addIceCandidate(ice);
    }
})