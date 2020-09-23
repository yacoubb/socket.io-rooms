module.exports.ERR_NOTVERIFIED = 'ERR_NOTVERIFIED'; // client or server has wrong appid - double check server address
module.exports.ERR_NOTREGISTERED = 'ERR_NOTREGISTERED'; // client has not registered a username
module.exports.ERR_USERNAME_ALPHANUMERIC = 'ERR_USERNAME_ALPHANUMERIC'; // client attempted to register a username with non-alphanumeric characters
module.exports.ERR_USERNAME_LENGTH = 'ERR_USERNAME_LENGTH'; // client attempted to register a username with a disallowed length

module.exports.ERR_ROOMNOTEXIST = 'ERR_ROOMNOTEXIST'; // client attempted to join a room that doesn't exist
module.exports.ERR_ROOMALREADYEXIST = 'ERR_ROOMALREADYEXIST'; // client attempted to create a room with a name already taken
module.exports.ERR_NOTINROOM = 'ERR_NOTINROOM'; // client is not connected to a room
module.exports.ERR_ALREADYINROOM = 'ERR_ALREADYINROOM'; // client attempted to join a room while already in one
module.exports.ERR_ROOMFULL = 'ERR_ROOMFULL'; // client attempted to join a full room
module.exports.ERR_BADPASSWORD = 'ERR_BADPASSWORD'; // client supplied a bad password for a password-protected room

module.exports.ERR_BADROOMINFO = 'ERR_BADROOMINFO'; // roomInfo didn't have the correct properties
module.exports.ERR_ROOMNAME_EMPTY = 'ERR_ROOMNAME_EMPTY'; // roomInfo.roomName was empty
module.exports.ERR_ROOMNAME_LENGTH = 'ERR_ROOMNAME_LENGTH'; // roomInfo.roomName was too short/long (as specified by config)
module.exports.ERR_ROOMNAME_ALPHANUMERIC = 'ERR_ROOMNAME_ALPHANUMERIC'; // roomInfo.roomName was non-alphanumeric
module.exports.ERR_MIN_MAXPLAYERS = 'ERR_MIN_MAXPLAYERS'; // roomInfo.maxPlayers was not an integer > 0

module.exports.ERR_NOTROOMOWNER = 'ERR_NOTROOMOWNER'; // client attempted to kick a player while not being room owner
module.exports.ERR_KICK_USERNAMEEMPTY = 'ERR_KICK_USERNAMEEMPTY'; // client didn't supply username to kick command
module.exports.ERR_KICK_NOTINROOM = 'ERR_KICK_NOTINROOM'; // client called kick on a user not in the client's room

module.exports.EVENT_PLAYERJOINED = 'EVENT_PLAYERJOINED'; // a player joined a room
module.exports.EVENT_PLAYERLEFT = 'EVENT_PLAYERLEFT'; // a player left a room
module.exports.EVENT_PLAYERKICKED = 'EVENT_PLAYERKICKED'; // a player was kicked from a room
module.exports.EVENT_NEWOWNER = 'EVENT_NEWOWNER'; // the old owner left the room, and a new owner now exists
