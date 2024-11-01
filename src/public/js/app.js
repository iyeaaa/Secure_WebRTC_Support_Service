const socket = io();

const video = document.getElementById("myVideo");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const myStream = document.getElementById("myStream");

initiate()

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

function initiate() {
    myStream.hidden = true;
}

async function getMedia(constraints) {
    let stream = null;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };
    } catch (err) {
        /* handle the error */
        console.error(`${err.name}: ${err.message}`);
    }
}



