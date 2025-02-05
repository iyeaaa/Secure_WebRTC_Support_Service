import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";
import session from "express-session"; // 세션 관리 추가
import path from "path";


const app = express();

/* Session 설정 */

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

/* Database */

// 데이터 예시
const users = {
    "iyeaaa@naver.com": [
        { email: "cyh1443@gmail.com", room: "a" },
        { email: "sjj2305@naver.com", room: "b" }
    ],
    "cyh1443@gmail.com": [
        { email: "iyeaaa@naver.com", room: "a" },
        { email: "sjj2305@naver.com", room: "c" }
    ],
    "sjj2305@naver.com": [
        { email: "cyh1443@gmail.com", room: "c" },
        { email: "iyeaaa@naver.com", room: "b" }
    ],
};

const login_info = {
    "iyeaaa@naver.com": "123456",
    "cyh1443@gmail.com": "123456",
    "sjj2305@naver.com": "123456"
};

// const isEntered = {
//     "a": {
//         controller: false,
//         reciever: false,
//     },
//     "b": {
//         controller: false,
//         reciever: false,
//     },
//     "c": {
//         controller: false,
//         reciever: false,
//     },
// }
//


/* HTTP 서버 설정 */

function ifNotLogin(req, res) {
    if (!req.session.user) {
        return res.redirect("/login.html");
    }
}

app.get("/", (req, res) => {
    ifNotLogin(req, res)
    res.sendFile(path.join(__dirname, "public/", "main.html"));
});

app.get("/user", (req, res) => {
    ifNotLogin(req, res)
    res.send(JSON.stringify(users[req.session.user.email]))
})

app.get("/controller", (req, res) => {
    ifNotLogin(req, res)
    const roomname = req.query.room
    res.sendFile(path.join(__dirname, "public/", "controller.html"));
})

app.get("/receiver", (req, res) => {
    ifNotLogin(req, res)
    res.sendFile(path.join(__dirname, "public/", "receiver.html"));
})

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (login_info[email] && login_info[email] === password) {
        // 세션에 사용자 정보 저장
        req.session.user = { email };
        res.status(200).json({ message: "success", sid: session.sid });
    } else {
        res.status(401).json({ message: "fail" });
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

const httpServer = http.createServer(app);



/* Socket.io 서버 설정 */

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
wsServer.use((socket, next) =>
    sessionMiddleware(socket.request, socket.request.res || {}, next))

wsServer.on("connection", socket => {
    const session = socket.request.session;
    if (!session?.user) {
        console.log("Unauthorized access to Socket");
        return socket.disconnect();
    }

    console.log(`${session.user.email} connected`);

    socket.onAny(event => console.log(`Socket Event: ${event}`));

    socket.on("join", (roomName) => {
        socket.join(roomName)
    })

    socket.on("start", (roomName) => {
        socket.join(roomName)
        socket.to(roomName).emit("start", socket.nickname);
    });

    socket.on("offer", (offer1, offer2, roomName) => {
        socket.to(roomName).emit("offer", offer1, offer2);
    })
    socket.on("answer", (answer1, answer2, roomName) => {
        socket.to(roomName).emit("answer", answer1, answer2);
    })
    socket.on("ice", (ice, roomName, num) => {
        socket.to(roomName).emit("ice", ice, num);
    })

    socket.on("new_message", (msg, time, roomName) => {
        socket.to(roomName).emit("new_message", msg, time);
    });

    socket.on("size", (dx, dy, width, height) => {
        socket.to(roomName).emit("size", dx, dy, width, height)
    })

    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => {
            socket.to(room).emit("bye", socket.nickname);
        });
    });
    socket.on("disconnect", () => {
        wsServer.emit("update_rooms", getPublicRooms());
    })
});

////////////////////////////////////////////////////////

const handleListen = () => console.log("Listening on http://localhost:3000");
httpServer.listen(3000, handleListen);


/* ETC Helper*/
function getPublicRooms() {
    const { rooms, sids } = wsServer.sockets.adapter;
    return [...rooms.keys()].filter(room => !sids.has(room));
}
