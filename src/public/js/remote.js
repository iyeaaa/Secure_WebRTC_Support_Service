
const socket = io()

const input = document.getElementById("text input")
const sendBtn = document.getElementById("sendbtn")

const url = new URL(window.location.href); // 현재 페이지의 전체 URL
const params = url.searchParams;
const room = params.get("room")
const myVideo = document.querySelector(".video-overlay video")
console.log(myVideo)

if (room == null) {
    alert("Room is Null")
}

// Socket

socket.emit("join", room)

socket.on("join", nickname => {
    console.log("success join", nickname)
})

socket.on("new_message", (content, time) => {
    appendMessageToChat(content, time, false)
})

// Face

getMedia()
// makeConnection()

async function getMedia() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        myVideo.srcObject = myStream;
        myVideo.onloadedmetadata = () => {
            myVideo.play();
        };
    } catch (err) {
        /* handle the error */
        console.error(`${err.name}: ${err.message}`);
        alert(err)
    }
}

// function handleIce(data) {
//     console.log(`got Ice Candidate from browser : ${data.candidate}`);
//     socket.emit("ice", data.candidate, roomName);
//     console.log(`sent the ice candidate`);
// }

// function handleAddStream(data) {
//     const peersFace = document.getElementById("peersFace");
//     peersFace.srcObject = data.stream;
//     console.log("got an event from my peer");
// }
//
// function makeConnection() {
//     myPeerConnection = new RTCPeerConnection({
//         iceServers: [
//             {
//                 urls: [
//                     "stun:stun.l.google.com:19302",
//                     "stun:stun.l.google.com:5349",
//                     "stun:stun1.l.google.com:3478",
//                     "stun:stun1.l.google.com:5349"
//                 ]
//             }
//         ]
//     });
//
//     /*
//         candidate : 소통하는 방식을 설명한다.
//         브라우저에 의해 candidate가 생성된다.
//     */
//     myPeerConnection.addEventListener("icecandidate", handleIce);
//     myPeerConnection.addEventListener("addstream", handleAddStream);
//     myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
// }


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