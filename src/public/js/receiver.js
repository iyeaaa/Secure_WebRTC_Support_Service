

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

let slider = new Array(5);

const worker = new Worker("./js/cropworker.js", {name: 'Crop worker'})
let readable, writable

if (room == null) {
    alert("Room is Null")
}

function init() {
    getScreen()
        .then(() => {
            makeConnection()
            socket.emit("join", room)
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
        createStreamToProcessing(screenStream)
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

function createStreamToProcessing(stream) {
    /* global MediaStreamTrackProcessor, MediaStreamTrackGenerator */
    if (typeof MediaStreamTrackProcessor === 'undefined' ||
        typeof MediaStreamTrackGenerator === 'undefined') {
        alert(
            'Your browser does not support the experimental MediaStreamTrack API ' +
            'for Insertable Streams of Media. See the note at the bottom of the ' +
            'page.');
    }

    // 첫번째 Track을 불러온다.
    const [track] = stream.getTracks();
    const processor = new MediaStreamTrackProcessor({track});
    readable = processor.readable

    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    writable = generator.writable;

    screenVideo.srcObject = new MediaStream([generator]);
}


// 스트림에서 비디오를 원하는 크기로 자를 수 있도록한다
function croppingScreen(top, bottom, left, right) {
    worker.postMessage({
        operation: 'crop',
        readable,
        writable,
        top, bottom, left, right
    }, [readable, writable]);

    console.log(readable)
    console.log(writable)
}


// RTC 연결

// function handleIce(data) {
//     console.log(`got Ice Candidate from browser : ${data.candidate}`);
//     socket.emit("ice", data.candidate, room);
//     console.log(`sent the ice candidate`);
// }

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

    /*
        candidate : 소통하는 방식을 설명한다.
        브라우저에 의해 candidate가 생성된다.
    */
    screenPeerconnection.addEventListener("icecandidate", (data) => {
        socket.emit("ice", data.candidate, room, 0);
    });
    screenPeerconnection.addEventListener("track", handleAddStream);

    chattingPeerConnection.addEventListener("icecandidate", (data) => {
        socket.emit("ice", data.candidate, room, 1);
    });

    // myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
    if (screenStream)
        screenStream.getTracks().forEach(track => screenPeerconnection.addTrack(track, screenStream));
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

socket.on("join", async (nickname) => {
    /* 초대장을 만드는 과정 */
    console.log("recieved join")

    const offer = await chattingPeerConnection.createOffer();
    await chattingPeerConnection.setLocalDescription(offer)

    const offer2 = await screenPeerconnection.createOffer();
    await screenPeerconnection.setLocalDescription(offer2)

    console.log("sent the offer");
    socket.emit("offer", offer, offer2, room);
})

socket.on("offer", async (offer1, offer2) => {
    console.log("receive the offer")

    await chattingPeerConnection.setRemoteDescription(offer1);
    const answer1 = await chattingPeerConnection.createAnswer();
    await chattingPeerConnection.setLocalDescription(answer1);

    await screenPeerconnection.setRemoteDescription(offer2);
    const answer2 = await screenPeerconnection.createAnswer();
    await screenPeerconnection.setLocalDescription(answer2);

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