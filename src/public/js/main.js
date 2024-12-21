

const socket = io()
const logoutBtn = document.getElementById("logout")

socket.emit("user")

socket.on("user", users_json => {
    const users = JSON.parse(users_json)
    users.forEach((value, key) => {
        const email = value.email
        const room = value.room
        createChatRoom(
            'profile1.jpg',
            email,
            room,
        )
    })
})

const chatList = document.querySelector(".chat-list")

function logout() {
    fetch("/logout", {
        method: "POST"
    }).then(() => {
        window.location.href = "/";
    });
}
logoutBtn.addEventListener("click", (event) => {
    logout()
})

// 새 채팅 방 정보를 생성하는 함수
function createChatRoom(profilePicSrc, username, room) {
    // chat-room div 생성
    const chatRoomDiv = document.createElement('div');
    chatRoomDiv.classList.add('chat-room');

    // profile-pic img 생성
    const profilePic = document.createElement('img');
    profilePic.src = profilePicSrc;
    profilePic.alt = 'Profile Picture';
    profilePic.classList.add('profile-pic');

    // chat-info div 생성
    const chatInfoDiv = document.createElement('div');
    chatInfoDiv.classList.add('chat-info');

    // 사용자 이름
    const usernameElement = document.createElement('h3');
    usernameElement.textContent = username;

    // 최근 메시지
    const lastMessageElement = document.createElement('p');
    lastMessageElement.textContent = `Room Name: ${room}`;

    // 원격 제어(하는 쪽) 버튼
    const remoteControlBtn = document.createElement('button');
    remoteControlBtn.classList.add('remote-control-btn');
    remoteControlBtn.textContent = '원격 제어하기';
    remoteControlBtn.addEventListener('click', () =>
        socket.emit("controller", room)
    );

    // 원격 제어(받는 쪽) 버튼
    const remoteControlledBtn = document.createElement('button');
    remoteControlledBtn.classList.add('remote-controlled-btn');
    remoteControlledBtn.textContent = '원격 제어 받기';
    remoteControlledBtn.addEventListener('click', () => {
        socket.emit("receiver", room)
    });

    // chat-info div에 사용자 이름과 메시지 추가
    chatInfoDiv.appendChild(usernameElement);
    chatInfoDiv.appendChild(lastMessageElement);

    // chat-room div에 요소들 추가
    chatRoomDiv.appendChild(profilePic);
    chatRoomDiv.appendChild(chatInfoDiv);
    chatRoomDiv.appendChild(remoteControlBtn);
    chatRoomDiv.appendChild(remoteControlledBtn);

    // 원하는 부모 요소에 chat-room 추가 (예: chatList)
    chatList.appendChild(chatRoomDiv);
}

socket.on("controller", (isEntered, roomName) => {
    if (isEntered)
        alert("Contoller is already entered")
    else
        window.location.href = `/controller?room=${roomName}`
})

socket.on("receiver", (isEntered, roomName) => {
    if (isEntered)
        alert("Receiver is already entered")
    else
        window.location.href = `/receiver?room=${roomName}`
})
