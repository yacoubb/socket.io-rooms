module.exports = ({ port, appId, serverAddress, usernameMinLength, usernameMaxLength }) => {
	const { connect } = require('socket.io-client');
	const chalkModule = require('chalk');
	const chalk = new chalkModule.Instance({ level: 2 });
	const socket = connect(`${serverAddress}:${port}`);
	const {
		EVENT_PLAYERJOINED,
		EVENT_PLAYERLEFT,
		EVENT_PLAYERKICKED,
		EVENT_NEWOWNER,
		ERR_ALREADYINROOM,
		ERR_BADPASSWORD,
		ERR_BADROOMINFO,
		ERR_KICK_NOTINROOM,
		ERR_KICK_USERNAMEEMPTY,
		ERR_MIN_MAXPLAYERS,
		ERR_NOTINROOM,
		ERR_NOTREGISTERED,
		ERR_NOTROOMOWNER,
		ERR_NOTVERIFIED,
		ERR_ROOMALREADYEXIST,
		ERR_ROOMFULL,
		ERR_ROOMNAME_ALPHANUMERIC,
		ERR_ROOMNAME_EMPTY,
		ERR_ROOMNAME_LENGTH,
		ERR_ROOMNOTEXIST,
		ERR_USERNAME_ALPHANUMERIC,
		ERR_USERNAME_LENGTH,
	} = require('./codes');

	var logger = console.log;
	var logErr = console.error;
	const setLogger = (newLogger, newLogErr) => {
		logger = newLogger;
		logErr = newLogErr;
	};

	setTimeout(() => {
		logger(`attempting connection to server at: ${serverAddress}:${port}`);
	}, 1);

	socket.on('handshake', () => {
		logger('connected to server');
		socket.emit('handshake', appId, (success) => {
			if (success) {
				logger('verified');
			} else {
				logger('not verified');
			}
		});
	});

	socket.on('message', (username, message) => {
		logger(`${chalk.yellow('[' + username + ']')}: ${message}`);
	});

	socket.on('kicked', () => {
		logger(`${chalk.red('you were kicked!')}`);
	});

	socket.on('disconnect', () => {
		logger('disconnected from server');
	});

	socket.on('info', (eventCode, ...args) => {
		logEventCode(eventCode, ...args);
	});

	socket.on('error', (errorCode, ...args) => {
		logErrorCode(errorCode, ...args);
	});

	const logEventCode = (eventCode, ...args) => {
		let [id, username] = [undefined, undefined];
		switch (eventCode) {
			case EVENT_PLAYERJOINED:
				[id, username] = args;
				logger(`${chalk.red('[server]')} ${username} joined`);
				break;
			case EVENT_PLAYERLEFT:
				[id, username] = args;
				logger(`${chalk.red('[server]')} ${username} left`);
				break;
			case EVENT_PLAYERKICKED:
				[id, username] = args;
				logger(`${chalk.red('[server]')} ${username} was kicked!`);
				break;
			case EVENT_NEWOWNER:
				[id, username] = args;
				logger(`${chalk.red('[server]')} ${username} is the new room owner`);
				break;
			default:
				logger(`${chalk.red('[server]')} info event: ${eventCode}, args: ${args}`);
				break;
		}
	};

	const logErrorCode = (errorCode, ...args) => {
		switch (errorCode) {
			case ERR_ALREADYINROOM:
				logErr(`you're already connected to a room`);
				break;
			case ERR_BADPASSWORD:
				logErr(`password incorrect`);
				break;
			case ERR_BADROOMINFO:
				logErr(`bad roomInfo format`);
				break;
			case ERR_KICK_NOTINROOM:
				logErr(`player ${args[0]} is not in this room`);
				break;
			case ERR_KICK_USERNAMEEMPTY:
				logErr(`kick [username] - username cannot be empty`);
				break;
			case ERR_MIN_MAXPLAYERS:
				logErr(`maxPlayers must be at least 1`);
				break;
			case ERR_NOTINROOM:
				logErr(`you're not in a room`);
				break;
			case ERR_NOTREGISTERED:
				logErr(`you're not registered`);
				break;
			case ERR_NOTROOMOWNER:
				logErr(`you're not the room owner`);
				break;
			case ERR_NOTVERIFIED:
				logErr(`you're not verified - double check this is the right server address`);
				break;
			case ERR_ROOMALREADYEXIST:
				logErr(`a room with the name ${args[0]} already exists`);
				break;
			case ERR_ROOMFULL:
				logErr(`room full`);
				break;
			case ERR_ROOMNAME_ALPHANUMERIC:
				logErr(`room name must be alphanumeric`);
				break;
			case ERR_ROOMNAME_EMPTY:
				logErr(`room name cannot be empty`);
				break;
			case ERR_ROOMNAME_LENGTH:
				logErr(`room name must be between ${usernameMinLength} and ${usernameMaxLength} characters long`);
				break;
			case ERR_ROOMNOTEXIST:
				logErr(`room ${args[0]} doesn't exist`);
				break;
			case ERR_USERNAME_ALPHANUMERIC:
				logErr(`username must be alphanumeric`);
				break;
			case ERR_USERNAME_LENGTH:
				logErr(`username must be between ${usernameMinLength} and ${usernameMaxLength} characters long`);
				break;
			default:
				logErr(errorCode);
				break;
		}
	};

	const register = (username) => {
		return new Promise((resolve, reject) => {
			socket.emit('register', username, (success, data) => {
				if (success) {
					resolve(`registered username ${username}`);
				} else {
					reject(data);
				}
			});
		});
	};

	const rooms = () => {
		return new Promise((resolve, reject) => {
			socket.emit('roomList', (success, data) => {
				if (success) {
					resolve(data);
				} else {
					reject(data);
				}
			});
		});
	};

	const join = (roomName) => {
		return new Promise((resolve, reject) => {
			socket.emit('join', roomName, (success, data) => {
				if (success) {
					resolve(`joined room ${roomName}`);
				} else {
					reject(data);
				}
			});
		});
	};

	const registerPasswordCallback = (passwordPromptCallback) => {
		socket.on('password', async (ack) => {
			const password = await passwordPromptCallback();
			ack(password);
		});
	};

	const leave = () => {
		return new Promise((resolve, reject) => {
			socket.emit('leave', (success, data) => {
				if (success) {
					resolve(`left room`);
				} else {
					reject(data);
				}
			});
		});
	};

	const createRoom = () => {
		return new Promise((resolve, reject) => {
			socket.emit('createRoom', (success, data) => {
				if (success) {
					resolve(`created room ${data}`);
				} else {
					reject(data);
				}
			});
		});
	};

	const registerRoomInfoCallback = (roomInfoPromptCallback) => {
		socket.on('roomInfo', async (ack) => {
			const roomInfo = await roomInfoPromptCallback();
			ack(roomInfo);
		});
	};

	const roomInfo = () => {
		return new Promise((resolve, reject) => {
			socket.emit('roomInfo', (success, data) => {
				if (success) {
					resolve(data);
				} else {
					reject(data);
				}
			});
		});
	};

	const players = () => {
		return new Promise((resolve, reject) => {
			socket.emit('players', (success, data) => {
				if (success) {
					resolve(data);
				} else {
					reject(data);
				}
			});
		});
	};

	const msg = (messageWords) => {
		return new Promise((resolve, reject) => {
			socket.emit('message', messageWords.join(' '), (success, data) => {
				if (success) {
					resolve(data);
				} else {
					reject(data);
				}
			});
		});
	};

	const kick = (username) => {
		return new Promise((resolve, reject) => {
			socket.emit('kick', username, (success, data) => {
				if (success) {
					resolve(data);
				} else {
					reject(data);
				}
			});
		});
	};

	const commands = {
		register: { fn: register, help: 'register a username (must be alphanumeric + no spaces). usage: register [username]' },
		rooms: { fn: rooms, help: 'show list of public rooms' },
		join: { fn: join, help: 'join a room by name. usage: join [roomName]' },
		leave: { fn: leave, help: 'leave the room you are currently in' },
		createRoom: { fn: createRoom, help: 'create a new room,' },
		roomInfo: { fn: roomInfo, help: 'show info about current room' },
		players: { fn: players, help: 'show list of players in current room' },
		msg: { fn: msg, help: 'send a message to current room. usage: msg [message]' },
		kick: { fn: kick, help: 'kick a player (you must be room owner). usage: kick [username]' },
	};

	const callbacks = {
		registerPasswordCallback: registerPasswordCallback,
		registerRoomInfoCallback: registerRoomInfoCallback,
	};

	const registerCommands = (newCommands) => {
		Object.assign(commands, newCommands);
		return Object.keys(commands);
	};

	return { socket, commands, callbacks, registerCommands, setLogger, logger, logErr, logEventCode, logErrorCode, chalk };
};
