const {
    ERR_NOTVERIFIED,
    ERR_NOTREGISTERED,
    ERR_USERNAME_ALPHANUMERIC,
    ERR_USERNAME_LENGTH,
    ERR_NOTINROOM,
    ERR_ALREADYINROOM,
    ERR_ROOMNOTEXIST,
    ERR_BADPASSWORD,
    ERR_ROOMALREADYEXIST,
    EVENT_PLAYERJOINED,
    EVENT_PLAYERLEFT,
    EVENT_PLAYERKICKED,
    EVENT_NEWOWNER,
    ERR_ROOMNAME_EMPTY,
    ERR_ROOMNAME_LENGTH,
    ERR_NOTROOMOWNER,
    ERR_BADROOMINFO,
    ERR_MIN_MAXPLAYERS,
    ERR_ROOMFULL,
    ERR_ROOMNAME_ALPHANUMERIC,
    ERR_KICK_NOTINROOM,
    ERR_KICK_USERNAMEEMPTY,
} = require('./codes')

module.exports = (io, { appId, usernameMaxLength, usernameMinLength }) => {
    const rooms = () => io.sockets.adapter.rooms
    const alphanumeric = /^\w+$/

    console.log('roomifying server with config:')
    console.log({ appId, usernameMaxLength, usernameMinLength })

    io.on('connection', (socket) => {
        console.log('a user connected')
        socket.use((packet, next) => {
            console.log(socket.id, packet.slice(0, packet.length - 1))
            return next()
        })

        socket.on('disconnect', (reason) => {
            console.log(`${socket.username ? socket.username : socket.id} disconnected: ${reason}`)
        })

        socket.verified = false
        delete socket.username
        delete socket.roomName

        socket.emit('handshake')
        socket.on('handshake', (clientAppId, ack) => {
            if (clientAppId === appId) {
                // good handshake
                console.log(`socket ${socket.id} verified`)
                socket.verified = true
                ack(true)
                return true
            } else {
                console.log(`socket ${socket.id} bad appid`)
                ack(false)
                socket.disconnect()
                return false
            }
        })
        socket.use(([event, ...rest], next) => {
            if (socket.verified || event === 'handshake') {
                return next()
            } else {
                next(new Error(ERR_NOTVERIFIED))
            }
        })

        socket.on('register', (username, ack) => {
            if (socket.roomName !== undefined) {
                ack(false, ERR_ALREADYINROOM)
                return false
            }
            if (username && username.length >= usernameMinLength && username.length < usernameMaxLength) {
                if (alphanumeric.test(username)) {
                    ack(true)
                    socket.username = username
                    return true
                } else {
                    ack(false, ERR_USERNAME_ALPHANUMERIC)
                    return false
                }
            } else {
                ack(false, ERR_USERNAME_LENGTH)
                return false
            }
        })

        socket.use(([event, ...rest], next) => {
            if (socket.username !== undefined || event === 'handshake' || event === 'register') {
                return next()
            } else {
                next(new Error(ERR_NOTREGISTERED))
            }
        })

        socket.on('roomList', (ack) => {
            ack(
                true,
                Object.values(rooms())
                    .filter((room) => room.public)
                    .map((room) => {
                        return {
                            name: room.name,
                            passwordProtected: room.password.length > 0,
                            currentPlayers: playersOf(room).length,
                            maxPlayers: room.maxPlayers,
                        }
                    }),
            )
            return true
        })

        socket.on('createRoom', async (ack) => {
            if (socket.roomName !== undefined) {
                ack(false, ERR_ALREADYINROOM)
                return false
            }

            const roomInfo = await requestRoomInfo(socket)
            if (!('name' in roomInfo) || !('public' in roomInfo) || !('password' in roomInfo) || !('maxPlayers' in roomInfo)) {
                ack(false, ERR_BADROOMINFO)
                return false
            }

            if (!roomInfo.name) {
                ack(false, ERR_ROOMNAME_EMPTY)
                return false
            }

            if (roomInfo.name in rooms()) {
                ack(false, ERR_ROOMALREADYEXIST)
                return false
            }
            if (roomInfo.name.length < usernameMinLength || roomInfo.name.length > usernameMaxLength) {
                ack(false, ERR_ROOMNAME_LENGTH)
                return false
            }
            if (!alphanumeric.test(roomInfo.name)) {
                ack(false, ERR_ROOMNAME_ALPHANUMERIC)
                return false
            }
            if (roomInfo.maxPlayers === undefined || roomInfo.maxPlayers === undefined || roomInfo.maxPlayers < 1) {
                ack(false, ERR_MIN_MAXPLAYERS)
                return false
            }

            roomInfo.owner = socket.id
            console.log('creating room with info ' + JSON.stringify(roomInfo))
            socket.join(roomInfo.name)
            socket.roomName = roomInfo.name
            Object.assign(rooms()[roomInfo.name], roomInfo)
            ack(true, roomInfo.name)
            return true
        })

        socket.on('join', async (roomName, ack) => {
            if (socket.roomName !== undefined) {
                ack(false, ERR_ALREADYINROOM)
                return false
            }
            if (!(roomName in rooms())) {
                ack(false, ERR_ROOMNOTEXIST)
                return false
            }

            if (rooms()[roomName].password.length > 0) {
                const password = await requestPassword(socket)
                if (password === rooms()[roomName].password) {
                    // fine
                    console.log('got good password')
                } else {
                    ack(false, ERR_BADPASSWORD)
                    return false
                }
            }

            if (rooms()[roomName].length >= rooms()[roomName].maxPlayers) {
                ack(false, ERR_ROOMFULL)
                return false
            }

            socket.join(roomName)
            socket.roomName = roomName
            socket.to(roomName).emit('info', EVENT_PLAYERJOINED, socket.id, socket.username)
            ack(true)
            return true
        })

        socket.use(([event, ...rest], next) => {
            if (
                socket.roomName !== undefined ||
                event === 'handshake' ||
                event === 'register' ||
                event === 'roomList' ||
                event === 'join' ||
                event === 'createRoom'
            ) {
                return next()
            } else {
                next(new Error(ERR_NOTINROOM))
            }
        })

        socket.on('leave', (ack) => {
            socket.to(socket.roomName).emit('info', EVENT_PLAYERLEFT, socket.id, socket.username)
            if (rooms()[socket.roomName].owner === socket.id) {
                // need to get next player to be the owner
                const playerList = Object.keys(rooms()[socket.roomName].sockets)
                if (playerList.length > 1) {
                    let nextOwnerIndex = 0
                    while (playerList[nextOwnerIndex] === socket.id) {
                        nextOwnerIndex++
                    }
                    rooms()[socket.roomName].owner = playerList[nextOwnerIndex]
                    socket
                        .to(socket.roomName)
                        .emit('info', EVENT_NEWOWNER, playerList[nextOwnerIndex], io.sockets.sockets[playerList[nextOwnerIndex]].username)
                }
            }

            socket.leave(socket.roomName)
            delete socket.roomName
            ack(true)
            return true
        })

        socket.on('roomInfo', (ack) => {
            // sends client information about the room they are connected to
            const { public, password, maxPlayers, sockets, owner } = rooms()[socket.roomName]

            const roomInfo = {
                name: socket.roomName,
                owner: io.sockets.sockets[owner].username,
                public,
                passwordProtected: password.length > 0,
                players: `${Object.keys(sockets).length}/${maxPlayers}`,
            }
            ack(true, roomInfo)
            return true
        })

        socket.on('players', (ack) => {
            // sends client playerlist of their current room
            const playerList = {}
            Object.keys(rooms()[socket.roomName].sockets).forEach(
                (socketId) => (playerList[socketId] = io.sockets.sockets[socketId].username),
            )
            ack(true, playerList)
            return true
        })

        socket.on('message', (message, ack) => {
            io.to(socket.roomName).emit('message', socket.username, message)
            ack(true)
            return true
        })

        socket.on('kick', (username, ack) => {
            const roomPlayers = Object.keys(rooms()[socket.roomName].sockets).map((socketId) => io.sockets.sockets[socketId].username)
            if (roomPlayers.indexOf(socket.username) !== 0) {
                ack(false, ERR_NOTROOMOWNER)
                return false
            }
            if (username === undefined || username === null || username.length === 0) {
                ack(false, ERR_KICK_USERNAMEEMPTY)
                return false
            }
            if (roomPlayers.indexOf(username) === -1) {
                ack(false, ERR_KICK_NOTINROOM)
                return false
            }
            Object.keys(rooms()[socket.roomName].sockets).some((socketId) => {
                if (io.sockets.sockets[socketId].username === username) {
                    const kickedSocket = io.sockets.sockets[socketId]
                    kickedSocket.leave(socket.roomName)
                    delete kickedSocket.roomName

                    io.to(socket.roomName).emit('info', EVENT_PLAYERKICKED, kickedSocket.id, kickedSocket.username)
                    kickedSocket.emit('kicked', socket.username)
                    ack(true)
                    return true
                }
            })
        })
    })

    const requestPassword = (socket) => {
        return new Promise((resolve, reject) => {
            socket.emit('password', (password) => {
                resolve(password)
            })
        })
    }

    const requestRoomInfo = (socket) => {
        return new Promise((resolve, reject) => {
            socket.emit('roomInfo', (roomInfo) => {
                resolve(roomInfo)
            })
        })
    }

    const roomOf = (socket) => io.sockets.adapter.rooms[socket.roomName]
    const playersOf = (room) => (room !== undefined ? Object.keys(room.sockets).map((socketId) => io.sockets.sockets[socketId]) : [])
    const autoJoin = (socket) => {
        if (io.sockets.adapter.rooms['autoRoom'] !== undefined) {
            socket.emit('autojoin', `player${playersOf(io.sockets.adapter.rooms['autoRoom']).length}`)
        } else {
            socket.emit('autojoin', 'owner')
        }
    }

    const onEvent = (socket, eventName, callback) => {
        // use this function to listen to when other socket.on events have completed
        // useful for running initialisation code to run after createRoom or join
        const oldCallback = socket.listeners(eventName)[0]
        const chainedCallback = async (...args) => {
            let result
            if (oldCallback.constructor.name === 'AsyncFunction') {
                result = await oldCallback(...args)
            } else {
                result = oldCallback(...args)
            }
            callback(result, ...args)
        }
        socket.off(eventName, oldCallback)
        socket.on(eventName, chainedCallback)
    }

    const beforeEvent = (socket, eventName, callback) => {
        // use this function to executre code before other socket.io listeners run
        const oldCallback = socket.listeners(eventName)[0]
        const chainedCallback = async (...args) => {
            await callback(...args)
            oldCallback(...args)
        }
        socket.off(eventName, oldCallback)
        socket.on(eventName, chainedCallback)
    }

    return { roomOf, playersOf, autoJoin, onEvent, beforeEvent }
}
