import http from "http";
import { Server } from "socket.io"
import { instrument } from "@socket.io/admin-ui";
import express from "express";

const app = express()
const path = require('path');

app.set(`view engine`, 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use('/public', express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log('Listening on http://localhost:3000');

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
    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName);
        done();
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        wsServer.emit("update_rooms", getPublicRooms());
    });
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("nickname", (nickname, done) => {
        socket['nickname'] = nickname;
        done();
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