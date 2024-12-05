const socket = io();

const video = document.getElementById("myVideo");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");

const welcome = document.getElementById("welcome");
const call = document.getElementById("call");
const chatting = document.getElementById("chatting");

let roomName;
let nickName;


initiate()

function initiate() {
    call.hidden = true;
    chatting.hidden = true;
}

/* Welcome Form */

const welcomeForm = welcome.querySelector("form");

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;
    chatting.hidden = false;
    await getMedia()
    makeConnection()
}

welcomeForm.addEventListener("submit", async e => {
    e.preventDefault();
    const roomnameinput = document.getElementById("roomname");
    const nicknameinput = document.getElementById("nickname");
    await initCall();
    roomName = roomnameinput.value
    nickName = nicknameinput.value
    socket.emit("join", roomName, nickName);
})


/* Chatting Form */

const chattingForm = chatting.querySelector("form");

chattingForm.addEventListener("submit", async e => {
    e.preventDefault()
    const input = chattingForm.querySelector("input");
    socket.emit("new_message", input.value, roomName)
})


/* Media Code */

muteBtn.addEventListener("click", event => {
    event.preventDefault()
    const track = video.srcObject.getAudioTracks().at(0);
    muteBtn.innerText = track.enabled ? "Mute" : "UnMute";
    track.enabled = !track.enabled;
})

cameraBtn.addEventListener("click", event => {
    event.preventDefault()
    const track = video.srcObject.getVideoTracks().at(0);
    cameraBtn.innerText = track.enabled ? "Turn Camera On" : "Turn Camera Off";
    track.enabled = !track.enabled;
})




/* Socket On Code */

// socket.on("join", async (nickname) => {
//     /* 초대장을 만드는 과정 */
//     const offer = await myPeerConnection.createOffer();
//     await myPeerConnection.setLocalDescription(offer)
//     console.log("sent the offer");
//     socket.emit("offer", offer, roomName);
// })
//
// socket.on("offer", async offer => {
//     console.log("receive the offer")
//     console.log(offer)
//     await myPeerConnection.setRemoteDescription(offer);
//     const answer = await myPeerConnection.createAnswer();
//     await myPeerConnection.setLocalDescription(answer);
//     socket.emit("answer", answer, roomName);
//     console.log("sent the answer");
// })
//
// socket.on("answer", async answer => {
//     console.log("receive the answer");
//     await myPeerConnection.setRemoteDescription(answer);
// })
//
// socket.on("ice", async ice => {
//     console.log("receive the ice from other client");
//     await myPeerConnection.addIceCandidate(ice);
// })

socket.on("new_message", message => {
    console.log("receive the message");
    const body = document.querySelector("body");
    const h3 = document.createElement("h3");
    h3.innerText = message;
    body.appendChild(h3);
})


/* RTC Code */




