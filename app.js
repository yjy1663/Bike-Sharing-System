var express = require("express");
var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);


var server_user = []; 
var clients = []; 
var group_leader = [];
var bike_onmap_id = {}; //free bike inventory on map for display
var bike_in_use = {}; //bikes currently in use by clients

//kafka I/O
var kafka = require('kafka-node');
var ZOOKEEPER_SERVER = 'localhost:2181';
var KAFKA_CLIENT_ID = "socketio-kafka";
console.log('ZOOKEEPER_SERVER: ' + ZOOKEEPER_SERVER);
var kafkaClient = new kafka.Client(ZOOKEEPER_SERVER, KAFKA_CLIENT_ID);
var consumer = new kafka.Consumer(kafkaClient, [], {autoCommit: true});
var producer = new kafka.Producer(kafkaClient);

consumer.addTopics(["bikes-locations", "bike-requested", "bike-request"], function (err, added) {});

consumer.on('message', function (message) {
    if (message['topic'] == 'bikes-locations'){
        io.emit('bike-location', message);
        console.log('got location');

        location = JSON.parse(message['value']);
        latitude = location['latitude'];
        longitude = location['longitude'];
        id = location['id'];
        bike_onmap_id[id] = [latitude, longitude];
    }
    else if (message['topic'] == 'bike-requested'){
        io.emit('bike-requested', message);
        console.log(message);
        request = JSON.parse(message['value']);
        bike_id = request['id'];
        delete bike_onmap_id[bike_id];
    }
    else if (message['topic'] == 'bike-request'){
        console.log("got bike request");
    }
});

//server listening to port 2500

http.listen(2500, function() {
    console.log("Connected to :2500");
});

//routing
app.use(express.static(__dirname));
app.get("/", function(req, res) {
    res.sendfile(__dirname + "/index.html");
});
producer.on('ready', function(){
    io.sockets.on("connection", function(socket) {
        var producer = new kafka.Producer(kafkaClient);
        io.emit("user_connection", socket.id);
        //when user sign in
        //return all other users information
        io.emit("server_user", server_user);
        //create new user
        
        //when a new user connected send currently on map bike to new user for map syhchronize
        io.emit('global_bikes', bike_onmap_id);

        socket.on("bike_request", function(request_message){
            payloads = [{topic:"bike-request", messages: request_message},];
            producer.send(payloads, function(err, data){
            });
            
        });

        socket.on("bike_return", function(return_message) {
            payloads = [{topic:"bikes-locations", messages: return_message},];
            producer.send(payloads, function(err, data){
            });

        });

        socket.on("create_user", function(data_user) {
            server_user.push(data_user);
            io.emit("create_user", data_user); 
        });
        //send chatting message
        socket.on("message", function(data_message) {
            io.emit("message", data_message);
        });

        socket.on("disconnect", function() {
            var i = 0;
            for (var i = 0; i < server_user.length; i++) {
                if (server_user[i].id == socket.id) {
                    server_user.splice(i, 1); //remove user info
                }
            }
            io.emit("user_disconnect", socket.id);
        });

        //create new group
        socket.on("create_room", function(room_id) {
            io.sockets.connected[socket.id].join(room_id);
            group_leader[room_id] = socket.id;
        });
        socket.on("invite_room", function(id, room_id) {
            io.sockets.connected[id].emit("invite_room", id, room_id);
        });
        socket.on("status_invited_room", function(id, room_id, status) {
            if (status == 1) {
                io.sockets.connected[id].join(room_id);
            }
        });
        socket.on("event_room", function(room_id, message_type, event_room) {
            if (group_leader[room_id] == socket.id) {
                if (message_type == "travel") {
                    socket.in(room_id).emit("event_room", getUserRoom(room_id), message_type, event_room);
                    io.sockets.connected[socket.id].emit("event_room", getUserRoom(room_id), message_type, event_room);
                } else if (message_type == "bounds" || message_type == "streetview") {
                    socket.in(room_id).emit("event_room", '', message_type, event_room);
                }
            }
        });
        socket.on("room_message", function(room_id, data_message) {
            socket.in(room_id).emit("room_message", data_message);
            io.sockets.connected[socket.id].emit("room_message", data_message);
        })
    });

});

function getUserRoom(room_id) {
    var user = [];
    for (var key in io.sockets.adapter.rooms[room_id]) {
        if (io.sockets.adapter.rooms[room_id][key] == true) {
            user.push(key);
        }
    }
    return user;
}
