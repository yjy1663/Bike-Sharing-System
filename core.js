$("#coor_k").val(Math.random() + 33.644771);
$("#coor_B").val(Math.random() -117.842097);

$("#destination_x").val(Math.random() + 33.644771);
$("#destination_y").val(Math.random() -117.842097);

var mapOptions = {
    center: new google.maps.LatLng(33.644771, -117.842097),
    zoom: 8
};
var map = new google.maps.Map(document.getElementById("map"), mapOptions);
var panorama = map.getStreetView();
var directionsService = new google.maps.DirectionsService();
var directionsDisplay = new google.maps.DirectionsRenderer();
var socket = io();
var coordinate = '';
var socket_id = '';
var time = '';
var allFlightPath = [];
var allMarkerStress = [];
var streetLineStatus = 0;
var markers = [];
var bikemarker = [];
var bike_holding_id =null;
var bike_holding_coordinate = [];
var inusebike = [];
var position_from = [],
    infowindow = [];
serverUserTime = 0;
bikeUserTime =0;
createGroup = 0;
room_id = '';

function getServerUser() {
    socket.on("server_user", function(server_user) {
        if (serverUserTime == 0) {
            for (var i = 0; i < server_user.length; i++) {
                data_user = server_user[i];
                makeMarkerUser(data_user, server_user[i].id);
            }
            serverUserTime = 1;
        }
    });
}

// when connected received currently available bike and mark it on map
function getBikeUser() {
    socket.on("global_bikes", function(bike_onmap_id) {
        if (bikeUserTime == 0){
            for (var bike_id in bike_onmap_id){
                console.log(bike_onmap_id);
                latitude =  bike_onmap_id[bike_id][0]
                longitude = bike_onmap_id[bike_id][1]
                makeMarkerBike(latitude, longitude, bike_id)
            }
            bikeUserTime = 1;
        }
    });
}
//create marker 
function makeMarkerUser(data_user, id) {
    if (data_user.object == "male") {
        var icon_user = "http://icons.iconarchive.com/icons/hopstarter/sleek-xp-basic/24/Administrator-icon.png";
    } else {
        var icon_user = "http://icons.iconarchive.com/icons/hopstarter/sleek-xp-basic/24/Office-Girl-icon.png";
    }
    markers[id] = new google.maps.Marker({
        position: new google.maps.LatLng(data_user.coordinate[0], data_user.coordinate[1]),
        icon: icon_user
    });
    markers[id].setMap(map);
    markers[id].id = data_user.id;

    infowindow[id] = new google.maps.InfoWindow();
    infowindow[id].setContent("<b>" + data_user.name + "</b>");
    infowindow[id].open(map, markers[id]);

    google.maps.event.addListener(markers[id], 'dblclick', function(marker, id) {
        if (createGroup == 0) {
            alert("Please create group");
        } else {

            if (data_user.id != socket_id) {
                socket.emit("invite_room", data_user.id, room_id);
                alert("Sent invite message");
            } else {
                alert("You can't invite yourself");
            }

        }
    });
}

function makeMarkerBike(latitude, longitude, bike_id) {
    var icon_bike = "http://icons.iconarchive.com/icons/elegantthemes/beautiful-flat/24/bike-icon.png";
    bikemarker[bike_id] = new google.maps.Marker({
        position: new google.maps.LatLng(latitude, longitude),
        icon: icon_bike
    });
    bikemarker[bike_id].id = bike_id;
    bikemarker[bike_id].setMap(map);
}

function bikeInUse(coordinate, bike_id) {
    var icon_bike = "http://icons.iconarchive.com/icons/sonya/swarm/32/Bike-icon.png";
    inusebike[bike_id] = new google.maps.Marker({
        position: new google.maps.LatLng(coordinate[0], coordinate[1]),
        icon: icon_bike
    });
    inusebike[bike_id].id = bike_id;
    inusebike[bike_id].setMap(map);
}


$(function() {
    socket.on("invite_room", function(id, invite_room_id) {
        if (socket_id == id) {
            $("#invite_form").show();
        }
        $("#invite_form #no").click(function() {
            $("#invite_form").hide();
        });
        $("#invite_form #yes").click(function() {
            room_id = invite_room_id;
            socket.emit("status_invited_room", id, invite_room_id, 1);
            $("#invite_form").hide();
        });
    });


    getServerUser();

    socket.on("user_connection", function(id) {
        //sign in to system will recieve a id from server
        if (socket_id == '') {
            socket_id = id;
        }
    });

    //update map for new free bikes
    socket.on("bike-location", function(location) {
        location = JSON.parse(location['value']);
        latitude = location['latitude'];
        longitude = location['longitude'];
        id = location['id'];
        makeMarkerBike(latitude, longitude, id);
    });

    //initialize already exist free bikes
    getBikeUser();

    //remove requested bikes from map
    socket.on("bike-requested", function(request) {
        request = JSON.parse(request['value']);
        user_id = request['user_id'];   //socket it
        bike_holding_id = request['bike_id'];
        bike_holding_coordinate = request['bike_coordinate'];

        console.log(user_id);
        if (bike_holding_id in bikemarker){
            bikemarker[$.trim(bike_holding_id)].setMap(null);
            bikemarker[$.trim(bike_holding_id)] = undefined;
        }
        bikeInUse(bike_holding_coordinate, bike_holding_id);
    });

    $("#send_message").click(function() {
        data_message = {
            id: socket_id,
            message: $("#chat_message").val(),
            name: $("#user_name").val()
        };
        $("#chat_message").val("");
        socket.emit("message", data_message);
    });

    //sending bike request message to server
    $("#request_bike").click(function() {
        request_message = {
            id: socket_id,
            coordinate: [Number($("#coor_k").val()), Number($("#coor_B").val())]
        };

        request_message=JSON.stringify(request_message);
        socket.emit("bike_request", request_message);
    });
    
    //sending return bike request to server
    $("#return_bike").click(function() {
        request_message = {
            id: Number(bike_holding_id),
            latitude: Number($("#destination_x").val()),
            longitude: Number($("#destination_y").val())
        };

        request_message=JSON.stringify(request_message);
        socket.emit("bike_return", request_message);
        if (bike_holding_id in inusebike){
            inusebike[$.trim(bike_holding_id)].setMap(null);
            inusebike[$.trim(bike_holding_id)] = undefined;
        }

        bike_holding_id = null;
        bike_holding_coordinate = [];
    });

    $("#button_login").click(function() {
        $("#login_panel").css({
            display: "none"
        });
        $("#world, .chat_area").css({
            display: "block"
        })
        var name = $("#user_name").val();
        var object = $("#object input:checked").prop("id");
        coordinate = [$("#coor_k").val(), $("#coor_B").val()];
        socket.emit("create_user", {
            id: socket_id,
            name: name,
            object: object,
            coordinate: coordinate
        });
    });
    //get user info
    //create user
    socket.on("create_user", function(create_user) {
        makeMarkerUser(create_user, create_user.id);
    });


    //user sign out
    socket.on("user_disconnect", function(id) {

        if (id in markers){
            markers[$.trim(id)].setMap(null);
            markers[$.trim(id)] = undefined;            
        }
    });
    //process send chat message
    socket.on("message", function(data_message) {
        if (typeof(infowindow[data_message.id]) === 'undefined') {
            infowindow[data_message.id] = new google.maps.InfoWindow();
            infowindow[data_message.id].setContent("<b>" + data_message.name + "</b>: " + data_message.message);
            infowindow[data_message.id].open(map, markers[data_message.id]);
        } else {
            infowindow[data_message.id].setContent("<b>" + data_message.name + "</b>: " + data_message.message);
        }
        $("#message").html($("#message").html() + "<b>" + data_message.name + "</b>: " + data_message.message + "<br/>");
        if (time != '') {
            clearTimeout(time);
        }
        setTimeout(function() {
            /*if (typeof(infowindow[data_message.id]) !== undefined) {
                infowindow[data_message.id].close();
                delete infowindow[data_message.id];
            }*/
            infowindow[data_message.id].setContent("<b>" + data_message.name + "</b>");
        }, 5000);
    });
    socket.on("event_room", function(user_in_room, message_type, event_room) {
        if (message_type == "travel") {
            position_from = [];
            for (var i = 0; i < user_in_room.length; i++) {
                position_from.push([markers[user_in_room[i]].Ie.ka.x, markers[user_in_room[i]].Ie.ka.y]); 
            }
            position_to = [event_room[0], event_room[1]];
            travel(position_from, position_to);
        } else if (message_type == "bounds") {
            map.setOptions({
                "zoom": event_room.zoom,
                "center": event_room.center
            });
        } else if (message_type == "streetview") {
            console.log(event_room);
            if (event_room.show == 1) {
                panorama.setVisible(true);
                panorama.setPano(event_room.setPano);
                panorama.setPov(event_room.getPov);
                panorama.setPosition({
                    "lat": event_room.getPosition.k,
                    "lng": event_room.getPosition.B
                });
                panorama.setZoom(event_room.getZoom);
            } else {
                panorama.setVisible(false);
            }
        }
    });
    google.maps.event.addListener(map, 'dblclick', function(event) {
        if (room_id != '') {
            socket.emit("event_room", room_id, "travel", [event.latLng.lat(), event.latLng.lng()]);
        } else {
            position_from = [coordinate];
            position_to = [event.latLng.lat(), event.latLng.lng()];
            travel(position_from, position_to);
        }
    });
    google.maps.event.addListener(map, 'bounds_changed', function() {
        if (room_id != '') {
            var mapview = {};
            center = {
                "lat": map.center.k,
                "lng": map.center.B
            }
            mapview.zoom = map.zoom;
            mapview.center = center;
            socket.emit("event_room", room_id, "bounds", mapview);
        }
    });
    google.maps.event.addListener(panorama, 'visible_changed', function() {
        streetview = {};
        if (panorama.getVisible()) {
            streetview.show = 1;
            streetview.getPano = panorama.getPano();
            streetview.getPov = panorama.getPov();
            streetview.getPosition = panorama.getPosition();
            streetview.getZoom = panorama.getZoom();
        } else {
            streetview.show = 0;
        }
        socket.emit("event_room", room_id, "streetview", streetview);
    });

    function streetview_changed(panorama) {
        streetview = {};
        streetview.show = 1;
        streetview.getPano = panorama.getPano();
        streetview.getPov = panorama.getPov();
        streetview.getPosition = panorama.getPosition();
        streetview.getZoom = panorama.getZoom();
        socket.emit("event_room", room_id, "streetview", streetview);
    }
    google.maps.event.addListener(panorama, 'position_changed', function() {
        streetview_changed(panorama);
    });
    google.maps.event.addListener(panorama, 'pov_changed', function() {
        streetview_changed(panorama);
    });
    google.maps.event.addListener(panorama, 'zoom_changed', function() {
        streetview_changed(panorama);
    });
    $(".world").click(function() {
        $("#world").css({
            display: "block"
        });
        $("#room").css({
            display: "none"
        });
        return false;
    });
    $("#createroom").click(function(event) {
        if (createGroup == 0 && room_id == '') {
            room_id = Math.random().toString(36).substring(7);
            socket.emit("create_room", room_id);
            createGroup = 1;
            $("#room_message").html("Created new room<br/>");
        }
        $("#world").css({
            display: "none"
        });
        $("#room").css({
            display: "block"
        });
        return false;
    });
    $("#send_room_message").click(function(event) {
        var data_message = {
            message: $("#chat_room_message").val(),
            name: $("#user_name").val()
        }
        socket.emit("room_message", room_id, data_message);
        $("#chat_room_message").val("");
        console.log(room_id);
        //console.log(data_message);
    });
    socket.on("room_message", function(data_message) {
        $("#room_message").html($("#room_message").html() + "<b>" + data_message.name + "</b>: " + data_message.message + "<br/>");
    })
});

function travel(from, to) {
    for (var i = 0; i < Math.max(allFlightPath.length, allMarkerStress.length); i++) {
        if (typeof(allFlightPath[i]) !== undefined) {
            allFlightPath[i].setMap(null);
        }
        if (typeof(allMarkerStress[i]) !== undefined) {
            allMarkerStress[i].setMap(null);
        }
    }
    allFlightPath = [];
    allMarkerStress = [];
    for (var i = 0; i < from.length; i++) {
        var request = {
            origin: new google.maps.LatLng(from[i][0], from[i][1]),
            destination: new google.maps.LatLng(to[0], to[1]), //lat, lng
            travelMode: google.maps.TravelMode["WALKING"]
        };
        directionsService.route(request, function(response, status) {
            var flightPath = '',
                marker_stress = '';
            if (status == google.maps.DirectionsStatus.OK) {
                data = response.routes[0].overview_path;
                color = "#ff0000";
                opacity = 1;

                flightPath = new google.maps.Polyline({
                    path: data,
                    geodesic: true,
                    strokeColor: color,
                    strokeOpacity: opacity,
                    strokeWeight: 2,
                    map: map
                });
                flightPath.setMap(map);
                marker_stress = new google.maps.Marker({
                    position: new google.maps.LatLng(data[data.length - 1].k, data[data.length - 1].B),
                    icon: "http://icons.iconarchive.com/icons/fatcow/farm-fresh/32/hand-point-270-icon.png"
                });
                marker_stress.setMap(map);
                allFlightPath.push(flightPath);
                allMarkerStress.push(marker_stress);
            }
        });
    }
}

