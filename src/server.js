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
} = require('./codes');

module.exports = (io, { appId, usernameMaxLength, usernameMinLength }) => {
	const rooms = () => io.sockets.adapter.rooms;
	const alphanumeric = /^\w+$/;

	io.on('connection', (socket) => {
		console.log('a user connected');
		socket.use((packet, next) => {
			console.log(socket.id, packet.slice(0, packet.length - 1));
			return next();
		});

		socket.on('disconnect', (reason) => {
			console.log(`${socket.username ? socket.username : socket.id} disconnected: ${reason}`);
		});

		socket.verified = false;
		delete socket.username;
		delete socket.roomName;

		socket.emit('handshake');
		socket.on('handshake', (clientAppId, ack) => {
			if (clientAppId === appId) {
				// good handshake
				console.log(`socket ${socket.id} verified`);
				socket.verified = true;
				ack(true);
			} else {
				console.log(`socket ${socket.id} bad appid`);
				ack(false);
				socket.disconnect();
			}
		});
		socket.use(([event, ...rest], next) => {
			if (socket.verified || event === 'handshake') {
				return next();
			} else {
				next(new Error(ERR_NOTVERIFIED));
			}
		});

		socket.on('register', (username, ack) => {
			if (username && username.length >= usernameMinLength && username.length < usernameMaxLength) {
				if (alphanumeric.test(username)) {
					ack(true);
					socket.username = username;
				} else {
					ack(false, ERR_USERNAME_ALPHANUMERIC);
				}
			} else {
				ack(false, ERR_USERNAME_LENGTH);
			}
		});

		socket.use(([event, ...rest], next) => {
			if (socket.username !== undefined || event === 'handshake' || event === 'register') {
				return next();
			} else {
				next(new Error(ERR_NOTREGISTERED));
			}
		});

		socket.on('roomList', (ack) => {
			ack(
				true,
				Object.keys(rooms()).filter((roomName) => rooms()[roomName].public),
			);
		});

		socket.on('createRoom', async (ack) => {
			if (socket.roomName !== undefined) {
				ack(false, ERR_ALREADYINROOM);
				return;
			}

			const roomInfo = await requestRoomInfo(socket);
			if (!('roomName' in roomInfo) || !('public' in roomInfo) || !('password' in roomInfo) || !('maxPlayers' in roomInfo)) {
				ack(false, ERR_BADROOMINFO);
				return;
			}

			if (roomInfo.roomName === undefined || roomInfo.roomName === null || roomInfo.roomName.length == 0) {
				ack(false, ERR_ROOMNAME_EMPTY);
				return;
			}

			if (roomInfo.roomName in rooms()) {
				ack(false, ERR_ROOMALREADYEXIST);
				return;
			}
			if (roomInfo.roomName.length < usernameMinLength || roomInfo.roomName.length > usernameMaxLength) {
				ack(false, ERR_ROOMNAME_LENGTH);
				return;
			}
			if (!alphanumeric.test(roomInfo.roomName)) {
				ack(false, ERR_ROOMNAME_ALPHANUMERIC);
				return;
			}
			if (roomInfo.maxPlayers === undefined || roomInfo.maxPlayers === undefined || roomInfo.maxPlayers < 1) {
				ack(false, ERR_MIN_MAXPLAYERS);
				return;
			}

			roomInfo.owner = socket.id;
			console.log('creating room with info ' + JSON.stringify(roomInfo));
			socket.join(roomInfo.roomName);
			socket.roomName = roomInfo.roomName;
			Object.assign(rooms()[roomInfo.roomName], roomInfo);
			ack(true, roomInfo.roomName);
		});

		socket.on('join', async (roomName, ack) => {
			if (socket.roomName !== undefined) {
				ack(false, ERR_ALREADYINROOM);
			}
			if (!(roomName in rooms())) {
				ack(false, ERR_ROOMNOTEXIST);
				return;
			}

			if (rooms()[roomName].password.length > 0) {
				const password = await requestPassword(socket);
				if (password === rooms()[roomName].password) {
					// fine
					console.log('got good password');
				} else {
					ack(false, ERR_BADPASSWORD);
					return;
				}
			}

			if (rooms()[roomName].length >= rooms()[roomName].maxPlayers) {
				ack(false, ERR_ROOMFULL);
				return;
			}

			socket.join(roomName);
			socket.roomName = roomName;
			socket.to(roomName).emit('info', EVENT_PLAYERJOINED, socket.id, socket.username);
			ack(true);
		});

		socket.use(([event, ...rest], next) => {
			if (socket.roomName !== undefined || event === 'handshake' || event === 'register' || event === 'roomList' || event === 'join' || event === 'createRoom') {
				return next();
			} else {
				next(new Error(ERR_NOTINROOM));
			}
		});

		socket.on('leave', (ack) => {
			socket.to(socket.roomName).emit('info', EVENT_PLAYERLEFT, socket.id, socket.username);
			if (rooms()[socket.roomName].owner === socket.id) {
				// need to get next player to be the owner
				const playerList = Object.keys(rooms()[socket.roomName].sockets);
				if (playerList.length > 1) {
					let nextOwnerIndex = 0;
					while (playerList[nextOwnerIndex] === socket.id) {
						nextOwnerIndex++;
					}
					rooms()[socket.roomName].owner = playerList[nextOwnerIndex];
					socket.to(socket.roomName).emit('info', EVENT_NEWOWNER, playerList[nextOwnerIndex], io.sockets.sockets[playerList[nextOwnerIndex]].username);
				}
			}

			socket.leave(socket.roomName);
			delete socket.roomName;
			ack(true);
		});

		socket.on('roomInfo', (ack) => {
			// sends client information about the room they are connected to
			const { public, password, maxPlayers, sockets, owner } = rooms()[socket.roomName];

			const roomInfo = {
				name: socket.roomName,
				owner: io.sockets.sockets[owner].username,
				public,
				passwordProtected: password.length > 0,
				players: `${Object.keys(sockets).length}/${maxPlayers}`,
			};
			ack(true, roomInfo);
		});

		socket.on('players', (ack) => {
			// sends client playerlist of their current room
			const playerList = {};
			Object.keys(rooms()[socket.roomName].sockets).forEach((socketId) => (playerList[socketId] = io.sockets.sockets[socketId].username));
			ack(true, playerList);
		});

		socket.on('message', (message, ack) => {
			io.to(socket.roomName).emit('message', socket.username, message);
			ack(true);
		});

		socket.on('kick', (username, ack) => {
			const roomPlayers = Object.keys(rooms()[socket.roomName].sockets).map((socketId) => io.sockets.sockets[socketId].username);
			if (roomPlayers.indexOf(socket.username) !== 0) {
				ack(false, ERR_NOTROOMOWNER);
				return;
			}
			if (username === undefined || username === null || username.length === 0) {
				ack(false, ERR_KICK_USERNAMEEMPTY);
				return;
			}
			if (roomPlayers.indexOf(username) === -1) {
				ack(false, ERR_KICK_NOTINROOM);
				return;
			}
			Object.keys(rooms()[socket.roomName].sockets).some((socketId) => {
				if (io.sockets.sockets[socketId].username === username) {
					const kickedSocket = io.sockets.sockets[socketId];
					kickedSocket.leave(socket.roomName);
					delete kickedSocket.roomName;

					io.to(socket.roomName).emit('info', EVENT_PLAYERKICKED, kickedSocket.id, kickedSocket.username);
					kickedSocket.emit('kicked', socket.username);
					ack(true);
					return true;
				}
			});
		});
	});

	const requestPassword = (socket) => {
		return new Promise((resolve, reject) => {
			socket.emit('password', (password) => {
				resolve(password);
			});
		});
	};

	const requestRoomInfo = (socket) => {
		return new Promise((resolve, reject) => {
			socket.emit('roomInfo', (roomInfo) => {
				resolve(roomInfo);
			});
		});
	};

	const roomOf = (socket) => io.sockets.adapter.rooms[socket.roomName];
	const playersOf = (room) => Object.keys(room.sockets).map((socketId) => io.sockets.sockets[socketId]);
	const autoJoin = (socket) => {
		if (io.sockets.adapter.rooms['autoRoom'] !== undefined) {
			socket.username = 'peasant1';
			socket.roomName = 'autoRoom';
			socket.join('autoRoom');
		} else {
			socket.username = 'owner';
			socket.roomName = 'autoRoom';
			socket.join('autoRoom', () => {
				Object.assign(roomOf(socket), { name: 'autoRoom', owner: socket.id, private: false, password: '', maxPlayers: 10 });
			});
		}
	};

	return { roomOf, playersOf, autoJoin };
};
