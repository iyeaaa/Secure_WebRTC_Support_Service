
const socket = io();

const loginForm = document.querySelector("form");
const email = document.getElementById("email")
const password = document.getElementById("password")

console.log(loginForm)

function login() {
    socket.emit("login", email.value, password.value)
}

loginForm.addEventListener("submit", event => {
    event.preventDefault()
    login()
})

socket.on("login", (email, message) => {
    if (message === "fail") {
        alert("로그인 실패")
    } else {
        sessionStorage.setItem("userData", JSON.stringify(message));
        window.location.href = "/main.html";
    }
})