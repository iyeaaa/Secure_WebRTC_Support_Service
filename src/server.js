import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";
import session from "express-session"; // 세션 관리 추가
import path from "path";

const app = express();

// 세션 설정
const sessionMiddleware = session({
    secret: "your_secret_key", // 반드시 강력한 비밀 키 사용
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS 사용 시 secure: true
});

// 미들웨어로 세션 사용
app.use(sessionMiddleware);
// 정적 파일 제공 및 라우트 설정
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login.html");
    }
    res.sendFile(path.join(__dirname, "public/", "main.html"));
});

app.get("/remote", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login.html");
    }
    res.sendFile(path.join(__dirname, "public/", "remote.html"));
})

// 로그인 API
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (login_info[email] && login_info[email] === password) {
        // 세션에 사용자 정보 저장
        req.session.user = { email };
        res.status(200).json({ message: "success" });
    } else {
        res.status(401).json({ message: "fail" });
    }
});

// 로그아웃 API
app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// 데이터 예시
const users = {
    "iyeaaa@naver.com": [
        { email: "cyh1443@gmail.com", room: "a" },
        { email: "sjj2305@naver.com", room: "b" }
    ],
    "cyh1443@gmail.com": [
        { email: "iyeaaa@naver.com", room: "a" },
        { email: "sjj2305@naver.com", room: "d" }
    ],
    "sjj2305@naver.com": [
        { email: "cyh1443@gmail.com", room: "d" },
        { email: "iyeaaa@naver.com", room: "b" }
    ],
};

const login_info = {
    "iyeaaa@naver.com": "123456",
    "cyh1443@gmail.com": "123456",
    "sjj2305@naver.com": "123456"
};


const httpServer = http.createServer(app);

// Socket.IO와 세션 공유
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true
    }
});

instrument(wsServer, {
    auth: false
});

// 세션을 Socket.IO에 통합
wsServer.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// WebSocket 이벤트 처리
wsServer.on("connection", socket => {
    const session = socket.request.session;
    if (!session?.user) {
        console.log("Unauthorized access to Socket");
        return socket.disconnect();
    }

    console.log(`${session.user.email} connected`);

    socket.onAny(event => console.log(`Socket Event: ${event}`));

    socket.on("user", () => {
        socket.emit("user", JSON.stringify(users[session.user.email]))
    })

    socket.on("join", (roomName) => {
        socket.join(roomName);
        socket.nickname = users[session.user.email];
        socket.to(roomName).emit("join", socket.nickname);
    });

    socket.on("new_message", (msg, time, roomName) => {
        socket.to(roomName).emit("new_message", msg, time);
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => {
            socket.to(room).emit("bye", socket.nickname);
        });
    });
});

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen);

// Helper functions
function getPublicRooms() {
    const { rooms, sids } = wsServer.sockets.adapter;
    return [...rooms.keys()].filter(room => !sids.has(room));
}
