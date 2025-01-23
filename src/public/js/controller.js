

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
let screenPeerconnection;
let peerConnection;
let sendChannel;
let receiveChannel;

if (room == null) {
    alert("Room is Null")
}

getMedia()
    .then(() => {
        makeConnection()
        socket.emit("join", room)
    })

function close(event) {
    screenStream = null
    peerConnection.close()
    peerConnection = null
    startShareButton.disabled = false
    stopShareButton.disabled = true
}

async function getMedia() {
    try {
        screenStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        myVideo.srcObject = screenStream
    } catch (err) {
        /* handle the error */
        console.error(`${err.name}: ${err.message}`);
        alert(err)
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
    screenVideo.srcObject = incomingStream;
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

    setDataChannel()

    /*
        candidate : 소통하는 방식을 설명한다.
        브라우저에 의해 candidate가 생성된다.
    */
    screenPeerconnection.addEventListener("icecandidate", (data) => {
        socket.emit("ice", data.candidate, room, 0);
    });
    screenPeerconnection.addEventListener("track", handleAddStream);

    peerConnection.addEventListener("icecandidate", (data) => {
        socket.emit("ice", data.candidate, room, 1);
    });

    // myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
    if (screenStream)
        screenStream.getTracks().forEach(track => screenPeerconnection.addTrack(track, screenStream));
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
    console.log(time)
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

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer)

    const offer2 = await screenPeerconnection.createOffer();
    await screenPeerconnection.setLocalDescription(offer2)

    console.log("sent the offer");
    socket.emit("offer", offer, offer2, room);
})

socket.on("offer", async (offer1, offer2) => {
    console.log("receive the offer")

    await peerConnection.setRemoteDescription(offer1);
    const answer1 = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer1);

    await screenPeerconnection.setRemoteDescription(offer2);
    const answer2 = await screenPeerconnection.createAnswer();
    await screenPeerconnection.setLocalDescription(answer2);

    socket.emit("answer", answer1, answer2, room);
    console.log("sent the answer");
})

socket.on("answer", async (answer1, answer2) => {
    console.log("receive the answer");
    await peerConnection.setRemoteDescription(answer1);
    await screenPeerconnection.setRemoteDescription(answer2)
})

socket.on("ice", async (ice, num) => {
    console.log("receive the ice from other client");

    if (num === 1) {
        await peerConnection.addIceCandidate(ice);
    }
    else if (num === 0) {
        await screenPeerconnection.addIceCandidate(ice);
    }
})