const API = "https://lechatsauvage.pythonanywhere.com";
let currentRoom = null;
let currentUser = localStorage.getItem('username') || null;
let intervalId = null;
let intervalIdCheckLocations = null;
let intervalIdSendLocations = null;
let mapMarkers = [];
let map = null;
let ZOOM_LEVEL = 17;
let visible_users = [];
let host = false;
let settings = {};
let isDrawingPolygon = false;
let polygonPoints = [];
let polygonPreview = null;
let lastPolygonLayer = null;

showLobbyScreen();




window.onload = () => {
    const savedRoom = localStorage.getItem('room');
    const savedUser = localStorage.getItem('username');
    
    if (savedRoom && savedUser) {
        currentRoom = savedRoom;
        currentUser = savedUser;
        isHost();
        showRoomScreen();
    } else {
        showLobbyScreen();
        listRooms();
    }
};




function showLobbyScreen() {
    document.getElementById('content').innerHTML = `
    <div id="lobbyScreen">
    <h2>Lobby</h2>
    <div class='status' style="justify-content: center; align-items: center;">
        <input id="joinUsername" placeholder="Username" value="${currentUser ? currentUser : ''}"/>
    </div>

    <br>
    
    <div class='status' style="justify-content: center; align-items: center;">
        <button style="margin: 0.5em 0;" onclick="createRoom()">Create Room</button>
    </div>

    <br>
    
    <div style="text-align: center; gap: 0.5em;">
    <input id="joinRoomCode" placeholder="Room code" />
        <button style="margin: 0.5em 0;" onclick="joinRoom()">Join Room</button>
    </div>
    
    <h2>Available Rooms</h2>
    <button onclick="listRooms()">Refresh List</button>
    <ul id="roomsList"></ul>
  </div>
    `;
}

function showRoomScreen() {
    document.getElementById('content').innerHTML = `
    <div id="roomScreen">
    <h2>In Room: <span id="currentRoomCode"></span></h2>
    
    
    <div id="map-div">
    <button id="sendLocationButton" onclick="startSendingLocations()">Start sending Location</button>
    <button onclick="getLocations()">Refresh Locations</button>
    <div style="margin-top: 1em;" id="poly-buttons"></div>
    <div id="map" style="height: 400px; margin-top: 20px;"></div>
    </div>
    
    <br>
    
    <div style="display: flex; gap: .5em;" id="userList"></div>

    <h2>Chat</h2>
    <div id="messagesList"></div>
    <input id="messageInput" placeholder="Type your message here" />
    <button onclick="sendMessage()">Send</button>
    

    <div id="settings">
    
    </div>

    <h2>Leave Room</h2>
    <button onclick="leaveRoom()">Leave</button>
    <p id="leaveStatus"></p>
  </div>
    `;
    document.getElementById('currentRoomCode').innerText = currentRoom;
    
    getSettings(currentRoom, true);
    document.getElementById('refresh-settings').onclick = () => {
        getSettings(currentRoom, true);
    };
    startCheckingMessages();
    startCheckingLocations();
    setTimeout(() => {
        if (!map) {
            map = L.map('map').setView([0, 0], ZOOM_LEVEL);

            map.on('click', function (e) {
                if (!isDrawingPolygon) return;

                const latlng = [e.latlng.lat, e.latlng.lng];
                polygonPoints.push(latlng);

                L.circleMarker(latlng, { radius: 5, color: 'red' }).addTo(map);

                if (polygonPreview) {
                    map.removeLayer(polygonPreview);
                }
                polygonPreview = L.polygon(polygonPoints, { color: 'blue', dashArray: '4, 4' }).addTo(map);
            });
            


            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);  
        }
    }, 0);

}


function isHost() {
    fetch(`${API}/room-users/${currentRoom}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
        host = (data.users[currentUser] === 'host');
        
    });
}

function createRoom() {
    fetch(`${API}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        'username': currentUser
        })
    })
    .then(res => res.json())
    .then(data => {
    alert('Room created: ' + data.room_code);
    setSettingsTo(data.room_code, {"public": false, "timelapse": 60 * 2});
    joinRoom(data.room_code);
    listRooms();
    });
}

function joinRoom(...roomcode) {
    const room = roomcode.length > 0 ? roomcode[0] : document.getElementById('joinRoomCode').value;
    const username = document.getElementById('joinUsername').value;
    if (!room) {
        alert("Enter room code");
        return;
    }
    if (!username) {
        alert("Enter username");
        return;
    }
    fetch(`${API}/join/${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'username': username
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById('joinStatus').innerText = data.error;
        } else {
            currentRoom = room;
            currentUser = username;
            localStorage.setItem('room', currentRoom);
            localStorage.setItem('username', currentUser);
            showRoomScreen();
        }
    });
}

function listRooms() {
    fetch(`${API}/rooms`)
    .then(res => res.json())
    .then(data => {
    const list = document.getElementById('roomsList');
    list.innerHTML = '';
    data.rooms.forEach(room => {
        console.log("Room: ", room);
        getSettings(room, false);
        setTimeout(() => {
        if (settings.public) {
            const li = document.createElement('li');
            li.innerText = room;
            li.className = 'room-item';
            li.innerHTML += ` <button onclick="joinRoom('${room}')">Join</button>`;
            list.appendChild(li);
        }
    }, 100);
    });
    });
}


function startCheckingMessages() {
    getMessages();
    if (intervalId) return; 
    intervalId = setInterval(() => {
        getMessages();
    }, 2000);
}

function startCheckingLocations() {
    getLocations();
    if (intervalIdCheckLocations) return; 
    intervalIdCheckLocations = setInterval(() => {
        getLocations();
    }, 30000);
}

function startSendingLocations() {
    if (intervalIdSendLocations) return;
    intervalIdSendLocations = setInterval(() => {
        locationFunction();
    }, 30000);
    locationFunction();
    document.getElementById('sendLocationButton').innerText = 'Stop Sending Location';
    document.getElementById('sendLocationButton').onclick = stopSendingLocations;
}

function stopCheckingMessages() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function stopCheckingLocations() {
    if (intervalIdCheckLocations) {
        clearInterval(intervalIdCheckLocations);
        intervalIdCheckLocations = null;
    }
}
function stopSendingLocations() {
    if (intervalIdSendLocations) {
        clearInterval(intervalIdSendLocations);
        intervalIdSendLocations = null;
    }
    document.getElementById('sendLocationButton').innerText = 'Start Sending Location';
    document.getElementById('sendLocationButton').onclick = startSendingLocations;
}

function sendMessage() {
    const message = document.getElementById('messageInput').value;
    if (!message) {
        alert("Please enter a message");
        return;
    }
    document.getElementById('messageInput').value = '';
    fetch(`${API}/room/${currentRoom}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        'username': currentUser,
        'chat': {
            message: message
        }
        
    })
    });
}

function getMessages() {
    fetch(`${API}/room/${currentRoom}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
    const messagesList = document.getElementById('messagesList')
    messagesList.innerHTML = ''
    data.chat.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.innerText = `${msg.username}: ${msg.content.message}`;
        messagesList.appendChild(msgDiv);
    });
    document.getElementById('userList').innerHTML = '';
    data.users.forEach(user => {
        const userDiv = document.createElement('div');
        if (!visible_users.includes(user)) {
            userDiv.classList.add('user-invisible');
            userDiv.innerText = `${user} (invis)`;
           
        } else {
            userDiv.innerText = user;
        }
        userDiv.onclick = () => {
            if (visible_users.includes(user)) {
                visible_users = visible_users.filter(u => u !== user);
            } else {
                visible_users.push(user);
            }
        }
        userDiv.classList.add('user-item');
        if (user == currentUser) {
            userDiv.classList.add('current-user');
        }
        document.getElementById('userList').appendChild(userDiv);
    });
    });
}



function locationFunction() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            sendLocation(location);
        }, function(error) {
            console.error("Error getting location: ", error);
            alert("Unable to retrieve your location. Please allow location access.");
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}


function sendLocation(location) {
    fetch(`${API}/room/${currentRoom}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        'username': currentUser,
        'location': {
            'location': location
        }
        
    })
    });
}





function getLocations() {
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];
    if (host) {
        document.getElementById('poly-buttons').innerHTML = `
    <button id="startPolygonButton" onclick="startPolygonDrawing()">Add Polygon</button>
    <button id="finishPolygonButton" style="display: none;" onclick="finishPolygon()">Finish Polygon</button>
    <button id="cancelPolygonButton" style="display: none;" onclick="cancelPolygon()">Cancel</button>
    `;
    }
    getMapData();

    fetch(`${API}/room/${currentRoom}/location`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
        data.location.forEach(loc => {
            const { username, content } = loc;
            const { latitude, longitude } = content.location;
            
            if (!visible_users.includes(username)) {
                return;
            }
            // Create marker
            const marker = L.marker([latitude, longitude])
                .addTo(map)
                .bindPopup(`${username}`)
                .openPopup();

            mapMarkers.push(marker);
        });

        if (data.location.length > 0) {
            const firstLoc = data.location[0].content.location;
            map.setView([firstLoc.latitude, firstLoc.longitude], ZOOM_LEVEL);
        }
    });
}



function setSettingsTo(room, settings) {
    fetch(`${API}/room-settings/${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'username': currentUser,
            'settings': settings
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Settings response: ", data);
        if (data.success) {
            console.log("Settings updated successfully");
        } else {
            console.log("Error updating settings: " + data.error);
        }
    });
}

function setSettings() {
    const publicCheckbox = document.getElementById('settings').querySelector('input[type="checkbox"]');
    const timelapseInput = document.getElementById('settings').querySelector('input[type="number"]');
    const settings = {
        "public": publicCheckbox.checked,
        "timelapse": timelapseInput ? parseInt(timelapseInput.value) : 60 * 2
    };
    
    setSettingsTo(currentRoom, settings);
    console.log("Settings submitted: ", settings);
}

function getSettings(room, update_ui = true) {
    if (update_ui) {
        const settingsContainer = document.getElementById('settings');

        if (host) {
            settingsContainer.innerHTML = `
                <h2>Settings</h2>
                <button id="refresh-settings">Refresh</button>
                <p>Public Room</p>
                <input type="checkbox" id="public-checkbox" />
                <p>Timelapse (in seconds)</p>
                <input type="number" id="timelapse-input" placeholder="Timelapse (seconds)" value="120" />
                <button id="submit-button">Submit</button>
            `;
            document.getElementById('submit-button').onclick = setSettings;
        } else {
            settingsContainer.innerHTML = `
                <h2>Settings</h2>
                <button id="refresh-settings">Refresh</button>
                <p id='public-setting'></p>
                <p id='timelapse-setting'></p>
            `;
        }
    }

    fetch(`${API}/room-settings/${room}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
        if (data) {
            console.log("Current settings: ", data);
            const settingsDiv = document.getElementById('settings');

            if (update_ui && settingsDiv) {
                if (host) {
                    // Delay DOM manipulation slightly to ensure elements are created
                    setTimeout(() => {
                        const checkbox = settingsDiv.querySelector('#public-checkbox');
                        const timelapseInput = settingsDiv.querySelector('#timelapse-input');

                        if (checkbox) checkbox.checked = data.public;
                        if (timelapseInput) timelapseInput.value = data.timelapse || 120;
                    }, 0);
                } else {
                    document.getElementById('public-setting').innerText = `Public: ${data.public ? 'Yes' : 'No'}`;
                    document.getElementById('timelapse-setting').innerText = `Timelapse: ${data.timelapse || 120} seconds`;
                }
            }

            settings = data;
            return data;
        } else {
            console.log("Error fetching settings: " + data.error);
        }
    });
}


function leaveRoom() {
    stopCheckingMessages();
    fetch(`${API}/room/${currentRoom}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('leaveStatus').innerText = data.message || data.error;
        currentRoom = null;
        localStorage.removeItem('room');
        showLobbyScreen();
        listRooms();
    });
}


function startPolygonDrawing() {
    isDrawingPolygon = true;
    polygonPoints = [];

    document.getElementById('startPolygonButton').style.display = 'none';
    document.getElementById('finishPolygonButton').style.display = 'inline';
    document.getElementById('cancelPolygonButton').style.display = 'inline';

    alert("Click on the map to add polygon points.");
}

function finishPolygon() {
    if (polygonPoints.length < 3) {
        alert("Need at least 3 points to form a polygon.");
        return;
    }

    if (polygonPreview) {
        map.removeLayer(polygonPreview);
        polygonPreview = null;
    }

    L.polygon(polygonPoints, { color: 'green' })
        .addTo(map)
        .bindPopup("Map");

    sendPolygon(polygonPoints);
    polygonPoints = [];
    isDrawingPolygon = false;

    document.getElementById('startPolygonButton').style.display = 'inline';
    document.getElementById('finishPolygonButton').style.display = 'none';
    document.getElementById('cancelPolygonButton').style.display = 'none';
}
function cancelPolygon() {
    isDrawingPolygon = false;
    polygonPoints = [];

    if (polygonPreview) {
        map.removeLayer(polygonPreview);
        polygonPreview = null;
    }

    document.getElementById('startPolygonButton').style.display = 'inline';
    document.getElementById('finishPolygonButton').style.display = 'none';
    document.getElementById('cancelPolygonButton').style.display = 'none';
}



function sendPolygon(polygonCoords) {
    fetch(`${API}/room/${currentRoom}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            'username': currentUser,
            'map': {
                'polygon': polygonCoords
            }
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Polygon sent:", data);
    });
}


function getMapData() {
    fetch(`${API}/room/${currentRoom}/map`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
        const mapData = data.map;
        if (!Array.isArray(mapData) || mapData.length === 0) return;

        const lastEntry = mapData[mapData.length - 1];
        const polygon = lastEntry.content.polygon;

        // Remove the previous polygon from the map if it exists
        if (lastPolygonLayer) {
            map.removeLayer(lastPolygonLayer);
            lastPolygonLayer = null;
        }

        if (polygon && Array.isArray(polygon)) {
            lastPolygonLayer = L.polygon(polygon, { color: 'purple' })
                .addTo(map)
                .bindPopup(`${lastEntry.username}'s area`);
        }
    });
}
