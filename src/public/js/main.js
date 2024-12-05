
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

    // h3 요소 생성 (사용자 이름)
    const usernameElement = document.createElement('h3');
    usernameElement.textContent = username;

    // p 요소 생성 (최근 메시지)
    const lastMessageElement = document.createElement('p');
    lastMessageElement.textContent = `Room Name: ${room}`;

    // remote-control-btn 버튼 생성
    const remoteControlBtn = document.createElement('button');
    remoteControlBtn.classList.add('remote-control-btn');
    remoteControlBtn.textContent = '원격 제어';
    remoteControlBtn.addEventListener("click", event => {
        fetch(`/remote`, {
            method: "GET",
        }).then(() => {
            window.location.href = `/remote?room=${room}`;
        });
    })

    // chat-info div에 사용자 이름과 메시지 추가
    chatInfoDiv.appendChild(usernameElement);
    chatInfoDiv.appendChild(lastMessageElement);

    // chat-room div에 프로필 사진, 채팅 정보, 버튼 추가
    chatRoomDiv.appendChild(profilePic);
    chatRoomDiv.appendChild(chatInfoDiv);
    chatRoomDiv.appendChild(remoteControlBtn);

    // 생성된 chat-room을 body 또는 특정 컨테이너에 추가
    chatList.appendChild(chatRoomDiv);  // 여기서 'document.body'를 원하는 부모 요소로 변경할 수 있습니다.
}

