
const socket = io()

const input = document.getElementById("text input")
const sendBtn = document.getElementById("sendbtn")

const url = new URL(window.location.href); // 현재 페이지의 전체 URL
const params = url.searchParams;
const room = params.get("room")
const myVideo = document.querySelector(".video-overlay video")
const screenVideo = document.querySelector(".screen-share video")

let myStream;
let screenStream;
let myPeerConnection;
let received = false

if (room == null) {
    alert("Room is Null")
}

socket.on("new_message", (content, time) => {
    appendMessageToChat(content, time, false)
})

// Face

getMedia().then(() => {
    getScreen().then(() => {
        makeConnection()
        socket.emit("join", room)
    })
})


async function getMedia() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        myStream['label'] = 'face'
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
            video: { displaySurface: "window" },
            audio: false,
        });
    } catch (err) {
        console.error("Error during screen capture", err);
    }
};

function handleIce(data) {
    console.log(`got Ice Candidate from browser : ${data.candidate}`);
    socket.emit("ice", data.candidate, room);
    console.log(`sent the ice candidate`);
}

// async function handleAddStream(data) {
//     screenVideo.srcObject = data.streams[0];
//     console.log(myVideo.srcObject)
//     screenVideo.onloadedmetadata = () => {
//         myVideo.play();
//     };
//     console.log("got an event from my peer");
// }

// handleAddStream에서 스트림 분리 처리
async function handleAddStream(event) {
    const incomingStream = event.streams[0];
    console.log("Received remote stream:", incomingStream);

    // 화면 공유 스트림과 화상 통신 스트림 구분
    if (received) {
        console.log("Attaching screen share stream");
        screenVideo.srcObject = incomingStream;
    } else {
        console.log("Attaching video call stream");
        myVideo.srcObject = incomingStream;
        received = true
    }
}

function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
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

    /*
        candidate : 소통하는 방식을 설명한다.
        브라우저에 의해 candidate가 생성된다.
    */
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("track", handleAddStream);
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
    screenStream.getTracks().forEach(track => myPeerConnection.addTrack(track, screenStream));
}

socket.on("join", async (nickname) => {
    /* 초대장을 만드는 과정 */
    const offer = await myPeerConnection.createOffer();
    await myPeerConnection.setLocalDescription(offer)
    console.log("sent the offer");
    socket.emit("offer", offer, room);
})

socket.on("offer", async offer => {
    console.log("receive the offer")
    console.log(offer)
    await myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    await myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, room);
    console.log("sent the answer");
})

socket.on("answer", async answer => {
    console.log("receive the answer");
    await myPeerConnection.setRemoteDescription(answer);
})

socket.on("ice", async ice => {
    console.log("receive the ice from other client");
    await myPeerConnection.addIceCandidate(ice);
})

// Chatting

function currentTime() {
    const now = new Date();
    const hours = now.getHours(); // 0~23 (24시간 형식)
    const minutes = now.getMinutes(); // 0~59
    return `${hours > 12 ? '오후' : '오전'} ${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`
}

function sendMessage(content, time) {
    socket.emit("new_message", content, time, room)
}
sendBtn.addEventListener("click", event => {
    const currenttime = currentTime()
    appendMessageToChat(input.value, currenttime, true)
    sendMessage(input.value, currenttime)
    input.value = ""
})

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