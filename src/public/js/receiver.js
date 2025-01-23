

const socket = io()

const input = document.getElementById("text input")
const sendMessageButton = document.getElementById("sendbtn")

const url = new URL(window.location.href); // 현재 페이지의 전체 URL
const params = url.searchParams;
const room = params.get("room")
const myVideo = document.querySelector(".video-overlay video")
const screenVideo = document.querySelector(".screen-share video")

let myStream;
let screenStream;
let peerConnection;
let sendChannel;
let receiveChannel;

if (room == null) {
    alert("Room is Null")
}

function init() {
    console.log("dafds")
    getScreen()
        .then(() => {
            makeConnection()
            socket.emit("join", room)
        })
}


/* 버튼 설정 */

function close() {
    screenStream = null
    peerConnection.close()
    peerConnection = null
    startShareButton.disabled = false
    stopShareButton.disabled = true
}

const startShareButton = document.querySelector(".screen-share-controls #startShareBtn")
const stopShareButton = document.querySelector(".screen-share-controls #stopShareBtn")

startShareButton.disabled = false
stopShareButton.disabled = true

startShareButton.addEventListener("click", init)
stopShareButton.addEventListener("click", close)

////////////////////////////////////////////////////////

async function getMedia() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        startShareButton.disabled = true
        stopShareButton.disabled = false
    } catch (err) {
        /* handle the error */
        console.error(`${err.name}: ${err.message}`);
        alert(err)
    }
}

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
        screenVideo.srcObject = screenStream
        console.log(screenStream)
        console.log(screenStream.getTracks())
    } catch (err) {
        console.error("Error during screen capture", err);
    }
}

/* RTC 연결 */

function handleIce(data) {
    console.log(`got Ice Candidate from browser : ${data.candidate}`);
    socket.emit("ice", data.candidate, room);
    console.log(`sent the ice candidate`);
}

// handleAddStream에서 스트림 분리 처리
async function handleAddStream(event) {
    const incomingStream = event.streams[0];
    console.log("Received remote stream:", incomingStream);

    console.log("Attaching screen share stream");
}

function makeConnection() {
    peerConnection = new RTCPeerConnection({
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
    peerConnection.addEventListener("icecandidate", handleIce);
    peerConnection.addEventListener("track", handleAddStream);
    // myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
    if (screenStream)
        screenStream.getTracks().forEach(track => peerConnection.addTrack(track, screenStream));
}

/* Data Channel 설정 */

function setDataChannel() {
    // sendChannel 설정
    sendChannel = peerConnection.createDataChannel("sendChannel")
    sendChannel.onopen = handleSendChannelStatusChange;
    sendChannel.onclose = handleSendChannelStatusChange;

    // receiveChannel 설정
    peerConnection.ondatachannel = (event) => {
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

function currentTime() {
    const now = new Date();
    const hours = now.getHours(); // 0~23 (24시간 형식)
    const minutes = now.getMinutes(); // 0~59
    return `${hours > 12 ? '오후' : '오전'} ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`
}

sendMessageButton.addEventListener("click", event => {
    const currenttime = currentTime()
    let message = input.value;

    sendChannel.send(message);
    appendMessageToChat(message, currenttime, true)

    input.value = ""
    input.focus();
})

function handleReceiveMessage(event) {
    let message = event.data
    let time = event.timeStamp
    appendMessageToChat(message, time, false)
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
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer)
    console.log("sent the offer");
    socket.emit("offer", offer, room);
})

socket.on("offer", async offer => {
    console.log("receive the offer")
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, room);
    console.log("sent the answer");
})

socket.on("answer", async answer => {
    console.log("receive the answer");
    await peerConnection.setRemoteDescription(answer);
})

socket.on("ice", async ice => {
    console.log("receive the ice from other client");
    await peerConnection.addIceCandidate(ice);
})