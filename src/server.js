import http from "http";
import { Server } from "socket.io"
import { instrument } from "@socket.io/admin-ui";
import express from "express";

const app = express()
const path = require('path');

// app.set(`view engine`, 'pug');
// app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, "public")));
// 라우트 설정
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/", "login.html"));
});
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log('Listening on http://localhost:3000');

const users = {
    "iyeaaa@naver.com": [
        {email: "cyh1443@gmail.com", room: "a"},
        {email: "sjj2305@naver.com", room: "b"}
    ],
    "cyh1443@gmail.com": [
        {email: "iyeaaa@naver.com", room: "a"},
        {email: "sjj2305@naver.com", room: "d"}
    ],
    "sjj2305@naver.com": [
        {email: "cyh1443@gmail.com", room: "d"},
        {email: "iyeaaa@naver.com", room: "b"}
    ],
}

const login_info = {
    "iyeaaa@naver.com": "123456",
    "cyh1443@gmail.com": "123456",
    "sjj2305@naver.com": "123456"
}

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
    cors: {
      origin: ["https://admin.socket.io"],
      credentials: true
    }
});

instrument(wsServer, {
    auth: false
});

function getPublicRooms() {
    let publicRooms = [];
    const rooms = wsServer.sockets.adapter.rooms;
    const sids = wsServer.sockets.adapter.sids;

    rooms.forEach((_, key) => {
        if (sids.get(key) === undefined)
            publicRooms.push(key);
    });

    return publicRooms;
}

function countRoom(roomName) {
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", socket => {
    socket['nickname'] = 'Anon';
    socket.emit("update_rooms", getPublicRooms());
    socket.onAny((event) => {
        console.log(`Socket Event: ${event}`);
    });
    socket.on("login", (email, password) => {
        let message = "fail";
        if (login_info[email] === undefined) {
            console.log("사용자를 찾을 수 없음")
        }
        else if (String(password) !== login_info[email]) {
            console.log(String(password))
            console.log(login_info[email]);
            console.log("사용자는 찾았으나 비밀번호가 다름")
        }
        else {
            console.log("사용자 일치");
            message = users[email];
        }
        socket.emit("login", email, message);
    })
    socket.on("join", (roomName, nickname) => {
        socket.join(roomName);
        socket.nickname = nickname
        socket.to(roomName).emit("join", socket.nickname);
        console.log(socket.nickname, ": join success")
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    })
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    })
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice);
    })
    socket.on("new_message", (msg, roomName) => {
        wsServer.emit("new_message", `${socket.nickname}: ${msg}`);
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => {
            socket.to(room).emit("bye", socket.nickname, countRoom(room)-1);
        });
    });
    socket.on("disconnect", () => {
        wsServer.emit("update_rooms", getPublicRooms());
    })
});

httpServer.listen(3000, handleListen);