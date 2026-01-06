// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

// Global objects
var clientId
var enableWebSockets
var map
var locationRegex = /(?:take me to|show|display)\s+(?:zip|postal code)\s+(\d{6})|(?:take me to|show|display)\s+(?:location|address)\s+(\S+(?:\s+\S+)*)/i
var userCameraStream = null

function initMap(location) {
    const mapContainer = document.getElementById('mapContainer');
    mapContainer.hidden = false;

    if (!map) {
        // Initialize map centered on Singapore with appropriate zoom level
        map = L.map('mapContainer').setView([1.3521, 103.8198], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
    }
    
    // Reset view to Singapore before searching
    map.setView([1.3521, 103.8198], 11);

    // Use Nominatim for geocoding with specific handling for postal codes
    const isPostalCode = /^\d{6}$/.test(location);
    
    // Try different query formats for better geocoding accuracy
    const tryGeocode = async (queries) => {
        for (const query of queries) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    map.setView([lat, lon], 15);
                    
                    // Clear existing markers
                    map.eachLayer((layer) => {
                        if (layer instanceof L.Marker) {
                            map.removeLayer(layer);
                        }
                    });
                    
                    // Add new marker
                    L.marker([lat, lon]).addTo(map);
                    return true;
                }
            } catch (error) {
                console.error('Geocoding error:', error);
            }
        }
        return false;
    };

    // Define query formats to try
    const queries = isPostalCode ? 
        [`${location} Singapore`, `Singapore postal ${location}`, `postal code ${location}, Singapore`] :
        [`${location}, Singapore`];

    // Try each query format until one succeeds
    tryGeocode(queries).then(found => {
        if (!found) {
            // Create error message element
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message bot-message error-message';
            errorDiv.style.color = 'red';
            errorDiv.textContent = isPostalCode ? 
                `Sorry, I couldn't find the location for postal code ${location}. Please verify the postal code and try again.` :
                `Sorry, I couldn't find the location "${location}". Please try a more specific address.`;
            
            // Add error message to chat
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.appendChild(errorDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            console.error('Location not found:', location);
        }
    }).catch(error => {
        console.error('Geocoding error:', error);
        // Handle API errors
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message bot-message error-message';
        errorDiv.style.color = 'red';
        errorDiv.textContent = 'Sorry, there was an error looking up that location. Please try again later.';
        
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.appendChild(errorDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

// User camera functions
async function startUserCamera() {
    try {
        // First, enumerate all video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', videoDevices.map(d => ({
            id: d.deviceId,
            label: d.label
        })));
        
        // Try to find the built-in/integrated camera
        // Priority: built-in > integrated > facetime > any camera that's not phone/virtual
        let selectedDeviceId = null;
        let builtInCamera = null;
        let integratedCamera = null;
        let fallbackCamera = null;
        
        for (const device of videoDevices) {
            const label = device.label.toLowerCase();
            
            // Skip Phone Link, virtual cameras, and remote devices
            if (label.includes('phone') || 
                label.includes('link') || 
                label.includes('virtual') ||
                label.includes('obs') ||
                label.includes('remote')) {
                continue;
            }
            
            // Prioritize built-in cameras
            if (label.includes('built-in') || label.includes('builtin')) {
                builtInCamera = device;
                break;
            }
            // Then integrated cameras
            else if (label.includes('integrated') || label.includes('facetime')) {
                integratedCamera = device;
            }
            // Otherwise use as fallback
            else if (!fallbackCamera) {
                fallbackCamera = device;
            }
        }
        
        // Select camera in order of preference
        const selectedCamera = builtInCamera || integratedCamera || fallbackCamera || videoDevices[0];
        if (selectedCamera) {
            selectedDeviceId = selectedCamera.deviceId;
            console.log('Selected camera:', selectedCamera.label);
        }
        
        const constraints = {
            video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        userCameraStream = stream;
        const videoElement = document.getElementById('userCameraVideo');
        const container = document.getElementById('userCameraContainer');
        
        if (videoElement && container) {
            videoElement.srcObject = stream;
            
            // Remove hidden attribute and force display
            container.removeAttribute('hidden');
            container.style.display = 'block';
            container.style.visibility = 'visible';
            container.style.opacity = '1';
            
            // Log dimensions for debugging
            console.log('Container dimensions:', {
                width: container.offsetWidth,
                height: container.offsetHeight,
                display: window.getComputedStyle(container).display,
                visibility: window.getComputedStyle(container).visibility
            });
            
            // Ensure video plays
            try {
                await videoElement.play();
                console.log('User camera video playing');
                console.log('Video dimensions:', {
                    width: videoElement.offsetWidth,
                    height: videoElement.offsetHeight,
                    videoWidth: videoElement.videoWidth,
                    videoHeight: videoElement.videoHeight
                });
            } catch (err) {
                console.error('Error playing video:', err);
            }
            
            console.log('User camera started successfully');
        } else {
            console.error('Video element or container not found');
        }
    } catch (error) {
        console.error('Error accessing user camera:', error);
        // Optionally show a message to the user
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            console.warn('Camera permission denied by user');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            console.warn('No camera found on this device');
        } else {
            console.warn('Error accessing camera:', error.message);
        }
    }
}

function stopUserCamera() {
    if (userCameraStream) {
        userCameraStream.getTracks().forEach(track => track.stop());
        userCameraStream = null;
        const videoElement = document.getElementById('userCameraVideo');
        if (videoElement) {
            videoElement.srcObject = null;
        }
        document.getElementById('userCameraContainer').hidden = true;
        console.log('User camera stopped');
    }
}

var socket
var audioContext
var isFirstResponseChunk
var speechRecognizer
var peerConnection
var peerConnectionDataChannel
var speechSynthesizerConnected = false
var isSpeaking = false
var isReconnecting = false
var sessionActive = false
var userClosedSession = false
var recognitionStartedTime
var chatRequestSentTime
var chatResponseReceivedTime
var lastInteractionTime = new Date()
var lastSpeakTime
var isFirstRecognizingEvent = true
var sttLatencyRegex = new RegExp(/<STTL>(\d+)<\/STTL>/)
var firstTokenLatencyRegex = new RegExp(/<FTL>(\d+)<\/FTL>/)
var firstSentenceLatencyRegex = new RegExp(/<FSL>(\d+)<\/FSL>/)

// Connect to avatar service
function connectAvatar() {
    document.getElementById('startSession').disabled = true

    fetch('/api/getIceToken', {
        method: 'GET',
    })
    .then(response => {
        if (response.ok) {
            response.json().then(data => {
                const iceServerUrl = data.Urls[0]
                const iceServerUsername = data.Username
                const iceServerCredential = data.Password
                setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential)
            })
        } else {
            throw new Error(`Failed fetching ICE token: ${response.status} ${response.statusText}`)
        }
    })

    document.getElementById('configuration').hidden = true
}

// Create speech recognizer
function createSpeechRecognizer() {
    fetch('/api/getSpeechToken', {
        method: 'GET',
    })
    .then(response => {
        if (response.ok) {
            const speechRegion = response.headers.get('SpeechRegion')
            const speechPrivateEndpoint = response.headers.get('SpeechPrivateEndpoint')
            response.text().then(text => {
                const speechToken = text
                const speechRecognitionConfig = speechPrivateEndpoint ?
                    SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${speechPrivateEndpoint.replace('https://', '')}/stt/speech/universal/v2`), '') :
                    SpeechSDK.SpeechConfig.fromEndpoint(new URL(`wss://${speechRegion}.stt.speech.microsoft.com/speech/universal/v2`), '')
                speechRecognitionConfig.authorizationToken = speechToken
                speechRecognitionConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous")
                speechRecognitionConfig.setProperty("SpeechContext-PhraseDetection.TrailingSilenceTimeout", "3000")
                speechRecognitionConfig.setProperty("SpeechContext-PhraseDetection.InitialSilenceTimeout", "10000")
                speechRecognitionConfig.setProperty("SpeechContext-PhraseDetection.Dictation.Segmentation.Mode", "Custom")
                speechRecognitionConfig.setProperty("SpeechContext-PhraseDetection.Dictation.Segmentation.SegmentationSilenceTimeoutMs", "200")
                var sttLocales = document.getElementById('sttLocales').value.split(',')
                var autoDetectSourceLanguageConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(sttLocales)
                speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechRecognitionConfig, autoDetectSourceLanguageConfig, SpeechSDK.AudioConfig.fromDefaultMicrophoneInput())
            })
        } else {
            throw new Error(`Failed fetching speech token: ${response.status} ${response.statusText}`)
        }
    })
}

// Disconnect from avatar service
function disconnectAvatar(closeSpeechRecognizer = false) {
    fetch('/api/disconnectAvatar', {
        method: 'POST',
        headers: {
            'ClientId': clientId
        },
        body: ''
    })

    if (speechRecognizer !== undefined) {
        speechRecognizer.stopContinuousRecognitionAsync()
        if (closeSpeechRecognizer) {
            speechRecognizer.close()
        }
    }

    sessionActive = false
}

function setupWebSocket() {
    // Don't create a new socket if one already exists
    if (socket && socket.connected) {
        console.log('WebSocket already connected, reusing existing connection.');
        return;
    }
    
    socket = io.connect(`${window.location.origin}?clientId=${clientId}`, {
        transports: ['websocket'], // Force WebSocket transport only (no polling)
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    })
    
    socket.on('connect', function() {
        console.log('WebSocket connected. Socket ID:', socket.id);
    })
    
    socket.on('disconnect', function() {
        console.log('WebSocket disconnected.');
    })
    
    socket.on('reconnect', function() {
        console.log('WebSocket reconnected. Socket ID:', socket.id);
    })

    socket.on('response', function(data) {
        // Filter messages - only process if it's for this client or no clientId specified
        if (data.clientId && data.clientId !== clientId) {
            console.log('Ignoring message for different client. Expected:', clientId, 'Got:', data.clientId);
            return;
        }
        
        let path = data.path
        console.log('WebSocket response received:', path, data);
        if (path === 'api.userMessage') {
            // Display user message from speech recognition
            console.log('Displaying user message:', data.userMessage);
            const chatMessages = document.getElementById('chatMessages');
            const messageElement = createMessageElement(data.userMessage, true);
            console.log('Created message element:', messageElement);
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            console.log('User message appended, total messages:', chatMessages.children.length);
            // Set flag so next response creates a new bot message bubble
            isFirstResponseChunk = true;
        } else if (path === 'api.chat') {
            lastInteractionTime = new Date()
            let chunkString = data.chatResponse
            const chatMessages = document.getElementById('chatMessages')
            
            if (sttLatencyRegex.test(chunkString)) {
                let sttLatency = parseInt(sttLatencyRegex.exec(chunkString)[0].replace('<STTL>', '').replace('</STTL>', ''))
                console.log(`STT latency: ${sttLatency} ms`)
                let latencyLogTextArea = document.getElementById('latencyLog')
                latencyLogTextArea.innerHTML += `STT latency: ${sttLatency} ms\n`
                chunkString = chunkString.replace(sttLatencyRegex, '')
            }

            if (firstTokenLatencyRegex.test(chunkString)) {
                let aoaiFirstTokenLatency = parseInt(firstTokenLatencyRegex.exec(chunkString)[0].replace('<FTL>', '').replace('</FTL>', ''))
                chunkString = chunkString.replace(firstTokenLatencyRegex, '')
            }

            if (firstSentenceLatencyRegex.test(chunkString)) {
                let aoaiFirstSentenceLatency = parseInt(firstSentenceLatencyRegex.exec(chunkString)[0].replace('<FSL>', '').replace('</FSL>', ''))
                chatResponseReceivedTime = new Date()
                console.log(`AOAI latency: ${aoaiFirstSentenceLatency} ms`)
                let latencyLogTextArea = document.getElementById('latencyLog')
                latencyLogTextArea.innerHTML += `AOAI latency: ${aoaiFirstSentenceLatency} ms\n`
                latencyLogTextArea.scrollTop = latencyLogTextArea.scrollHeight
                chunkString = chunkString.replace(firstSentenceLatencyRegex, '')
            }

            if (isFirstResponseChunk) {
                // Create new bot message element for first chunk
                const botMessageDiv = createMessageElement('', false);
                chatMessages.appendChild(botMessageDiv);
                isFirstResponseChunk = false;
            }

            // Update the last bot message with new content
            if (chunkString) {
                const lastMessage = chatMessages.lastElementChild;
                lastMessage.textContent += chunkString;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } else if (path === 'api.event') {
            console.log("[" + (new Date()).toISOString() + "] WebSocket event received: " + data.eventType)
            if (data.eventType === 'SPEECH_SYNTHESIZER_DISCONNECTED') {
                if (document.getElementById('autoReconnectAvatar').checked && !userClosedSession && !isReconnecting) {
                    // No longer reconnect when there is no interaction for a while
                    if (new Date() - lastInteractionTime < 300000) {
                        // Session disconnected unexpectedly, need reconnect
                        console.log(`[${(new Date()).toISOString()}] The speech synthesizer got disconnected unexpectedly, need reconnect.`)
                        isReconnecting = true
                        connectAvatar()
                        createSpeechRecognizer()
                    }
                }
            }
        }
    })
}

// Setup WebRTC
function setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential) {
    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [ iceServerUrl ],
            username: iceServerUsername,
            credential: iceServerCredential
        }],
        iceTransportPolicy: 'relay'
    })

    // Fetch WebRTC video stream and mount it to an HTML video element
    peerConnection.ontrack = function (event) {
        if (event.track.kind === 'audio') {
            let audioElement = document.createElement('audio')
            audioElement.id = 'audioPlayer'
            audioElement.srcObject = event.streams[0]
            audioElement.autoplay = true

            audioElement.onplaying = () => {
                console.log(`WebRTC ${event.track.kind} channel connected.`)
            }

            // Clean up existing audio element if there is any
            remoteVideoDiv = document.getElementById('remoteVideo')
            for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
                if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                    remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
                }
            }

            // Append the new audio element
            document.getElementById('remoteVideo').appendChild(audioElement)
        }

        if (event.track.kind === 'video') {
            let videoElement = document.createElement('video')
            videoElement.id = 'videoPlayer'
            videoElement.srcObject = event.streams[0]
            videoElement.autoplay = true
            videoElement.playsInline = true

            // Continue speaking if there are unfinished sentences while reconnecting
            if (isReconnecting) {
                fetch('/api/chat/continueSpeaking', {
                    method: 'POST',
                    headers: {
                        'ClientId': clientId
                    },
                    body: ''
                })
            }

            videoElement.onplaying = () => {
                // Clean up existing video element if there is any
                remoteVideoDiv = document.getElementById('remoteVideo')
                for (var i = 0; i < remoteVideoDiv.childNodes.length; i++) {
                    if (remoteVideoDiv.childNodes[i].localName === event.track.kind) {
                        remoteVideoDiv.removeChild(remoteVideoDiv.childNodes[i])
                    }
                }

                // Append the new video element
                document.getElementById('remoteVideo').appendChild(videoElement)

                console.log(`WebRTC ${event.track.kind} channel connected.`)
                document.getElementById('microphone').disabled = false
                document.getElementById('stopSession').disabled = false
                document.getElementById('remoteVideo').style.width = '450px'
                document.getElementById('chatMessages').hidden = false
                document.getElementById('latencyLog').hidden = false
                document.getElementById('showTypeMessage').disabled = false

                if (document.getElementById('useLocalVideoForIdle').checked) {
                    document.getElementById('localVideo').hidden = true
                    if (lastSpeakTime === undefined) {
                        lastSpeakTime = new Date()
                    }
                }

                isReconnecting = false
                setTimeout(() => { sessionActive = true }, 5000) // Set session active after 5 seconds
            }
        }
    }

    // Listen to data channel, to get the event from the server
    peerConnection.addEventListener("datachannel", event => {
        peerConnectionDataChannel = event.channel
        peerConnectionDataChannel.onmessage = e => {
            console.log("[" + (new Date()).toISOString() + "] WebRTC event received: " + e.data)

            if (e.data.includes("EVENT_TYPE_SWITCH_TO_SPEAKING")) {
                if (chatResponseReceivedTime !== undefined) {
                    let speakStartTime = new Date()
                    let ttsLatency = speakStartTime - chatResponseReceivedTime
                    console.log(`TTS latency: ${ttsLatency} ms`)
                    let latencyLogTextArea = document.getElementById('latencyLog')
                    latencyLogTextArea.innerHTML += `TTS latency: ${ttsLatency} ms\n\n`
                    latencyLogTextArea.scrollTop = latencyLogTextArea.scrollHeight
                    chatResponseReceivedTime = undefined
                }

                isSpeaking = true
                document.getElementById('stopSpeaking').disabled = false
            } else if (e.data.includes("EVENT_TYPE_SWITCH_TO_IDLE")) {
                isSpeaking = false
                lastSpeakTime = new Date()
                document.getElementById('stopSpeaking').disabled = true
            } else if (e.data.includes("EVENT_TYPE_SESSION_END")) {
                if (document.getElementById('autoReconnectAvatar').checked && !userClosedSession && !isReconnecting) {
                    // No longer reconnect when there is no interaction for a while
                    if (new Date() - lastInteractionTime < 300000) {
                        // Session disconnected unexpectedly, need reconnect
                        console.log(`[${(new Date()).toISOString()}] The session ended unexpectedly, need reconnect.`)
                        isReconnecting = true
                        // Remove data channel onmessage callback to avoid duplicatedly triggering reconnect
                        peerConnectionDataChannel.onmessage = null
                        connectAvatar()
                        createSpeechRecognizer()
                    }
                }
            }
        }
    })

    // This is a workaround to make sure the data channel listening is working by creating a data channel from the client side
    c = peerConnection.createDataChannel("eventChannel")

    // Make necessary update to the web page when the connection state changes
    peerConnection.oniceconnectionstatechange = e => {
        console.log("WebRTC status: " + peerConnection.iceConnectionState)
        if (peerConnection.iceConnectionState === 'disconnected') {
            if (document.getElementById('useLocalVideoForIdle').checked) {
                document.getElementById('localVideo').hidden = false
                document.getElementById('remoteVideo').style.width = '0.1px'
            }
        }
    }

    // Offer to receive 1 audio, and 1 video track
    peerConnection.addTransceiver('video', { direction: 'sendrecv' })
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' })

    // Connect to avatar service when ICE candidates gathering is done
    iceGatheringDone = false

    peerConnection.onicecandidate = e => {
        if (!e.candidate && !iceGatheringDone) {
            iceGatheringDone = true
            connectToAvatarService(peerConnection)
        }
    }

    peerConnection.createOffer().then(sdp => {
        peerConnection.setLocalDescription(sdp).then(() => { setTimeout(() => {
            if (!iceGatheringDone) {
                iceGatheringDone = true
                connectToAvatarService(peerConnection)
            }
        }, 2000) })
    })
}

// Connect to TTS Avatar Service
function connectToAvatarService(peerConnection) {
    let localSdp = btoa(JSON.stringify(peerConnection.localDescription))
    let headers = {
        'ClientId': clientId,
        'AvatarCharacter': document.getElementById('AvatarCharacter').value,
        'AvatarStyle': document.getElementById('AvatarStyle').value,
        'IsCustomAvatar': document.getElementById('customizedAvatar').checked
    }

    if (isReconnecting) {
        headers['Reconnect'] = true
    }

    if (document.getElementById('azureOpenAIDeploymentName').value !== '') {
        headers['AoaiDeploymentName'] = document.getElementById('azureOpenAIDeploymentName').value
    }

    if (document.getElementById('enableOyd').checked && document.getElementById('azureCogSearchIndexName').value !== '') {
        headers['CognitiveSearchIndexName'] = document.getElementById('azureCogSearchIndexName').value
    }

    if (document.getElementById('ttsVoice').value !== '') {
        headers['TtsVoice'] = document.getElementById('ttsVoice').value
    }

    if (document.getElementById('customVoiceEndpointId').value !== '') {
        headers['CustomVoiceEndpointId'] = document.getElementById('customVoiceEndpointId').value
    }

    if (document.getElementById('personalVoiceSpeakerProfileID').value !== '') {
        headers['PersonalVoiceSpeakerProfileId'] = document.getElementById('personalVoiceSpeakerProfileID').value
    }

    fetch('/api/connectAvatar', {
        method: 'POST',
        headers: headers,
        body: localSdp
    })
    .then(response => {
        if (response.ok) {
            response.text().then(text => {
                const remoteSdp = text
                peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(remoteSdp))))
            })
        } else {
            document.getElementById('startSession').disabled = false;
            document.getElementById('configuration').hidden = false;
            throw new Error(`Failed connecting to the Avatar service: ${response.status} ${response.statusText}`)
        }
    })
}

// Handle user query. Send user query to the chat API and display the response.
    // Helper function to create a message element
    function formatResponseText(text) {
        // First, normalize basic whitespace and line endings
        text = text.replace(/\s+/g, ' ').trim();
        
        // Helper function to deduplicate content
        function deduplicate(str, separator = ' ') {
            const parts = str.split(separator);
            return [...new Set(parts)].join(separator);
        }
        
        // Handle common prefixes like "Your first" that might be repeated
        text = text.replace(/(\b(?:Your|The|This|[Aa]|[Aa]n)\s+\w+)(?:\s+\1)+/g, '$1');
        
        // Remove duplicate clauses and phrases
        text = text.replace(/(.{10,}?)(?:\s*[-,]\s*\1)+/g, '$1');
        
        // Clean up key-value pairs and ensure consistent formatting
        const pairs = new Map();
        text = text.replace(/([A-Za-z][A-Za-z\s]*?):\s*([^:\n]+?)(?=\s*(?:[A-Za-z][\w\s]*:|$))/g, 
            (match, key, value) => {
                key = key.trim();
                value = value.trim();
                if (!pairs.has(key)) {
                    pairs.set(key, value);
                    return `\n${key}:\n    ${value}`;
                }
                return '';
            }
        );
        
        // Special handling for ticket information
        text = text.replace(/(?:Ticket ID|Task ID|Assignment ID|Reference):\s*([^:\n]+)/g, '\nTicket ID: $1');
        
        // Clean up various formatting issues
        text = text
            .replace(/\(([^()]*?)\)\s*\(\1\)/g, '($1)') // Deduplicate parenthetical content
            .replace(/([:\-])\s*\1+/g, '$1') // Fix repeated punctuation
            .replace(/[,\s]*,/g, ',') // Fix multiple commas
            .replace(/\(\s*\)/g, '') // Remove empty parentheses
            .replace(/([.!?])\s+/g, '$1\n\n') // Add line breaks after sentences
            .replace(/(\d+)\.\s*/g, '\n$1. '); // Format list numbers
            
        // Final cleanup
        text = text
            .split('\n')
            .map(line => deduplicate(line.trim())) // Deduplicate each line
            .filter(line => line) // Remove empty lines
            .join('\n');
            
        // Ensure consistent spacing
        text = text.replace(/\n{3,}/g, '\n\n');
        
        return text.trim();
    }

    function createMessageElement(text, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        if (!isUser) {
            text = formatResponseText(text);
            // Use white-space: pre-wrap to preserve formatting
            messageDiv.style.whiteSpace = 'pre-wrap';
        }
        
        messageDiv.textContent = text;
        return messageDiv;
    }

    function handleUserQuery(userQuery) {
        lastInteractionTime = new Date()
        chatRequestSentTime = new Date()

        // Check for location request
        const locationMatch = userQuery.match(locationRegex);
        if (locationMatch) {
            // Extract either postal code or location, whichever matched
            const location = locationMatch[1] || locationMatch[2];
            if (location) {
                // Show map for the location
                initMap(location.trim());
            }
        }

        if (socket !== undefined) {
            socket.emit('message', { clientId: clientId, path: 'api.chat', systemPrompt: document.getElementById('prompt').value, userQuery: userQuery })
            isFirstResponseChunk = true
            return
        }

    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'ClientId': clientId,
            'SystemPrompt': document.getElementById('prompt').value,
            'Content-Type': 'text/plain'
        },
        body: userQuery
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Chat API response status: ${response.status} ${response.statusText}`)
        }

        let currentBotMessage = '';
        const chatMessages = document.getElementById('chatMessages');
        const botMessageDiv = createMessageElement('', false);
        chatMessages.appendChild(botMessageDiv);

        const reader = response.body.getReader()

        // Function to recursively read chunks from the stream
        function read() {
            return reader.read().then(({ value, done }) => {
                if (done) {
                    return;
                }

                let chunkString = new TextDecoder().decode(value, { stream: true })

                if (firstTokenLatencyRegex.test(chunkString)) {
                    let aoaiFirstTokenLatency = parseInt(firstTokenLatencyRegex.exec(chunkString)[0].replace('<FTL>', '').replace('</FTL>', ''))
                    // console.log(`AOAI first token latency: ${aoaiFirstTokenLatency} ms`)
                    chunkString = chunkString.replace(firstTokenLatencyRegex, '')
                    if (chunkString === '') {
                        return read()
                    }
                }

                if (firstSentenceLatencyRegex.test(chunkString)) {
                    let aoaiFirstSentenceLatency = parseInt(firstSentenceLatencyRegex.exec(chunkString)[0].replace('<FSL>', '').replace('</FSL>', ''))
                    chatResponseReceivedTime = new Date()
                    let chatLatency = chatResponseReceivedTime - chatRequestSentTime
                    let appServiceLatency = chatLatency - aoaiFirstSentenceLatency
                    console.log(`App service latency: ${appServiceLatency} ms`)
                    console.log(`AOAI latency: ${aoaiFirstSentenceLatency} ms`)
                    let latencyLogTextArea = document.getElementById('latencyLog')
                    latencyLogTextArea.innerHTML += `App service latency: ${appServiceLatency} ms\n`
                    latencyLogTextArea.innerHTML += `AOAI latency: ${aoaiFirstSentenceLatency} ms\n`
                    latencyLogTextArea.scrollTop = latencyLogTextArea.scrollHeight
                    chunkString = chunkString.replace(firstSentenceLatencyRegex, '')
                    if (chunkString === '') {
                        return read()
                    }
                }

                if (chunkString) {
                    currentBotMessage += chunkString;
                    botMessageDiv.textContent = currentBotMessage;
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                // Continue reading the next chunk
                return read()
            })
        }

        // Start reading the stream
        return read()
    })
}

// Handle local video. If the user is not speaking for 15 seconds, switch to local video.
function handleLocalVideo() {
    if (lastSpeakTime === undefined) {
        return
    }

    let currentTime = new Date()
    if (currentTime - lastSpeakTime > 15000) {
        if (document.getElementById('useLocalVideoForIdle').checked && sessionActive && !isSpeaking) {
            disconnectAvatar()
            userClosedSession = true // Indicating the session was closed on purpose, not due to network issue
            document.getElementById('localVideo').hidden = false
            document.getElementById('remoteVideo').style.width = '0.1px'
            sessionActive = false
        }
    }
}

// Check server status
function checkServerStatus() {
    fetch('/api/getStatus', {
        method: 'GET',
        headers: {
            'ClientId': clientId
        }
    })
    .then(response => {
        if (response.ok) {
            response.text().then(text => {
                responseJson = JSON.parse(text)
                synthesizerConnected = responseJson.speechSynthesizerConnected
                if (speechSynthesizerConnected === true && synthesizerConnected === false) {
                    console.log(`[${(new Date()).toISOString()}] The speech synthesizer connection is closed.`)
                    if (document.getElementById('autoReconnectAvatar').checked && !userClosedSession && !isReconnecting) {
                        // No longer reconnect when there is no interaction for a while
                        if (new Date() - lastInteractionTime < 300000) {
                            // Session disconnected unexpectedly, need reconnect
                            console.log(`[${(new Date()).toISOString()}] The speech synthesizer got disconnected unexpectedly, need reconnect.`)
                            isReconnecting = true
                            connectAvatar()
                            createSpeechRecognizer()
                        }
                    }
                }

                speechSynthesizerConnected = synthesizerConnected
            })
        }
    })
}

// Check whether the avatar video stream is hung
function checkHung() {
    // Check whether the avatar video stream is hung, by checking whether the video time is advancing
    let videoElement = document.getElementById('videoPlayer')
    if (videoElement !== null && videoElement !== undefined && sessionActive) {
        let videoTime = videoElement.currentTime
        setTimeout(() => {
            // Check whether the video time is advancing
            if (videoElement.currentTime === videoTime) {
                // Check whether the session is active to avoid duplicatedly triggering reconnect
                if (sessionActive) {
                    sessionActive = false
                    if (document.getElementById('autoReconnectAvatar').checked) {
                        // No longer reconnect when there is no interaction for a while
                        if (new Date() - lastInteractionTime < 300000) {
                            console.log(`[${(new Date()).toISOString()}] The video stream got disconnected, need reconnect.`)
                            isReconnecting = true
                            // Remove data channel onmessage callback to avoid duplicatedly triggering reconnect
                            peerConnectionDataChannel.onmessage = null
                            connectAvatar()
                            createSpeechRecognizer()
                        }
                    }
                }
            }
        }, 2000)
    }
}

window.onload = () => {
    clientId = document.getElementById('clientId').value
    enableWebSockets = document.getElementById('enableWebSockets').value === 'True'

    if (!enableWebSockets) {
        setInterval(() => {
            checkServerStatus()
        }, 2000) // Check server status every 2 seconds
    }

    setInterval(() => {
        checkHung()
    }, 2000) // Check session activity every 2 seconds
}

window.startSession = () => {
    lastInteractionTime = new Date()
    if (enableWebSockets) {
        setupWebSocket()
    }

    userClosedSession = false

    createSpeechRecognizer()
    
    // Start user camera
    startUserCamera()
    
    if (document.getElementById('useLocalVideoForIdle').checked) {
        document.getElementById('startSession').disabled = true
        document.getElementById('configuration').hidden = true
        document.getElementById('microphone').disabled = false
        document.getElementById('stopSession').disabled = false
        document.getElementById('localVideo').hidden = false
        document.getElementById('remoteVideo').style.width = '0.1px'
        document.getElementById('chatMessages').hidden = false
        document.getElementById('latencyLog').hidden = false
        document.getElementById('showTypeMessage').disabled = false
        return
    }

    connectAvatar()
}

window.stopSpeaking = () => {
    lastInteractionTime = new Date()
    document.getElementById('stopSpeaking').disabled = true

    if (socket !== undefined) {
        socket.emit('message', { clientId: clientId, path: 'api.stopSpeaking' })
        return
    }

    fetch('/api/stopSpeaking', {
        method: 'POST',
        headers: {
            'ClientId': clientId
        },
        body: ''
    })
    .then(response => {
        if (response.ok) {
            console.log('Successfully stopped speaking.')
        } else {
            throw new Error(`Failed to stop speaking: ${response.status} ${response.statusText}`)
        }
    })
}

window.stopSession = () => {
    lastInteractionTime = new Date()
    document.getElementById('startSession').disabled = false
    document.getElementById('microphone').disabled = true
    document.getElementById('stopSession').disabled = true
    document.getElementById('configuration').hidden = false
    document.getElementById('chatMessages').hidden = true
    document.getElementById('latencyLog').hidden = true
    document.getElementById('mapContainer').hidden = true
    document.getElementById('showTypeMessage').checked = false
    document.getElementById('showTypeMessage').disabled = true
    document.getElementById('userMessageBox').hidden = true
    if (document.getElementById('useLocalVideoForIdle').checked) {
        document.getElementById('localVideo').hidden = true
    }

    // Stop user camera
    stopUserCamera()

    userClosedSession = true // Indicating the session was closed by user on purpose, not due to network issue
    disconnectAvatar(true)
}

function resetMap() {
    const mapContainer = document.getElementById('mapContainer');
    mapContainer.hidden = true;
    if (map) {
        map.remove();
        map = null;
    }
}

window.exportChatTranscript = () => {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return '';
    
    let transcript = '';
    const messages = chatMessages.querySelectorAll('.message');
    
    messages.forEach((message, index) => {
        const isUser = message.classList.contains('user-message');
        const speaker = isUser ? 'User' : 'Assistant';
        const text = message.textContent.trim();
        
        if (text) {
            transcript += `${speaker}: ${text}\n\n`;
        }
    });
    
    return transcript;
}

window.navigateToEvaluation = () => {
    const transcript = window.exportChatTranscript();
    // Store transcript in localStorage to pass to test.html
    localStorage.setItem('chatTranscript', transcript);
    window.location.href = '/test';
}

window.clearChatHistory = () => {
    lastInteractionTime = new Date()
    resetMap();
    fetch('/api/chat/clearHistory', {
        method: 'POST',
        headers: {
            'ClientId': clientId,
            'SystemPrompt': document.getElementById('prompt').value
        },
        body: ''
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('chatMessages').innerHTML = ''
            document.getElementById('latencyLog').innerHTML = ''
        } else {
            throw new Error(`Failed to clear chat history: ${response.status} ${response.statusText}`)
        }
    })
}

window.microphone = () => {
    lastInteractionTime = new Date()
    if (document.getElementById('microphone').innerHTML === 'Stop Microphone') {
        // Stop microphone for websocket mode
        if (socket !== undefined) {
            document.getElementById('microphone').disabled = true
            fetch('/api/disconnectSTT', {
                method: 'POST',
                headers: {
                    'ClientId': clientId
                },
                body: ''
            })
            .then(() => {
                document.getElementById('microphone').innerHTML = 'Start Microphone'
                document.getElementById('microphone').disabled = false
                if (audioContext !== undefined) {
                    audioContext.close()
                    audioContext = undefined
                }
            })
        }

        // Stop microphone (if speech recognizer exists)
        if (speechRecognizer !== undefined) {
            document.getElementById('microphone').disabled = true
            speechRecognizer.stopContinuousRecognitionAsync(
                () => {
                    document.getElementById('microphone').innerHTML = 'Start Microphone'
                    document.getElementById('microphone').disabled = false
                }, (err) => {
                    console.log("Failed to stop continuous recognition:", err)
                    document.getElementById('microphone').disabled = false
                })
        } else {
            // No speech recognizer, just update the button
            document.getElementById('microphone').innerHTML = 'Start Microphone'
            document.getElementById('microphone').disabled = false
        }

        return
    }

    // Start microphone for websocket mode
    if (socket !== undefined) {
        document.getElementById('microphone').disabled = true
        // Audio worklet script (https://developer.chrome.com/blog/audio-worklet) for recording audio
        const audioWorkletScript = `class MicAudioWorkletProcessor extends AudioWorkletProcessor {
                constructor(options) {
                    super(options)
                }

                process(inputs, outputs, parameters) {
                    const input = inputs[0]
                    const output = []
                    for (let channel = 0; channel < input.length; channel += 1) {
                        output[channel] = input[channel]
                    }
                    this.port.postMessage(output[0])
                    return true
                }
            }

            registerProcessor('mic-audio-worklet-processor', MicAudioWorkletProcessor)`
        const audioWorkletScriptBlob = new Blob([audioWorkletScript], { type: 'application/javascript; charset=utf-8' })
        const audioWorkletScriptUrl = URL.createObjectURL(audioWorkletScriptBlob)

        fetch('/api/connectSTT', {
            method: 'POST',
            headers: {
                'ClientId': clientId,
                'SystemPrompt': document.getElementById('prompt').value
            },
            body: ''
        })
        .then(response => {
            document.getElementById('microphone').disabled = false
            if (response.ok) {
                document.getElementById('microphone').innerHTML = 'Stop Microphone'

                navigator.mediaDevices
                .getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 16000
                    }
                })
                .then((stream) => {
                    audioContext = new AudioContext({ sampleRate: 16000 })
                    const audioSource = audioContext.createMediaStreamSource(stream)
                    audioContext.audioWorklet
                        .addModule(audioWorkletScriptUrl)
                        .then(() => {
                            const audioWorkletNode = new AudioWorkletNode(audioContext, 'mic-audio-worklet-processor')
                            audioWorkletNode.port.onmessage = (e) => {
                                const audioDataFloat32 = e.data
                                const audioDataInt16 = new Int16Array(audioDataFloat32.length)
                                for (let i = 0; i < audioDataFloat32.length; i++) {
                                    audioDataInt16[i] = Math.max(-0x8000, Math.min(0x7FFF, audioDataFloat32[i] * 0x7FFF))
                                }
                                const audioDataBytes = new Uint8Array(audioDataInt16.buffer)
                                const audioDataBase64 = btoa(String.fromCharCode(...audioDataBytes))
                                socket.emit('message', { clientId: clientId, path: 'api.audio', audioChunk: audioDataBase64 })
                            }

                            audioSource.connect(audioWorkletNode)
                            audioWorkletNode.connect(audioContext.destination)
                        })
                        .catch((err) => {
                            console.log('Failed to add audio worklet module:', err)
                        })
                })
                .catch((err) => {
                    console.log('Failed to get user media:', err)
                })
            } else {
                throw new Error(`Failed to connect STT service: ${response.status} ${response.statusText}`)
            }
        })

        return
    }

    if (document.getElementById('useLocalVideoForIdle').checked) {
        if (!sessionActive) {
            connectAvatar()
        }

        setTimeout(() => {
            document.getElementById('audioPlayer').play()
        }, 5000)
    } else {
        document.getElementById('audioPlayer').play()
    }

    document.getElementById('microphone').disabled = true
    speechRecognizer.recognizing = async (s, e) => {
        if (isFirstRecognizingEvent && isSpeaking) {
            window.stopSpeaking()
            isFirstRecognizingEvent = false
        }
    }

    speechRecognizer.recognized = async (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            let userQuery = e.result.text.trim()
            if (userQuery === '') {
                return
            }

            let recognitionResultReceivedTime = new Date()
            let speechFinishedOffset = (e.result.offset + e.result.duration) / 10000
            let sttLatency = recognitionResultReceivedTime - recognitionStartedTime - speechFinishedOffset
            console.log(`STT latency: ${sttLatency} ms`)
            let latencyLogTextArea = document.getElementById('latencyLog')
            latencyLogTextArea.innerHTML += `STT latency: ${sttLatency} ms\n`
            latencyLogTextArea.scrollTop = latencyLogTextArea.scrollHeight

            // Auto stop microphone when a phrase is recognized, when it's not continuous conversation mode
            if (!document.getElementById('continuousConversation').checked) {
                document.getElementById('microphone').disabled = true
                speechRecognizer.stopContinuousRecognitionAsync(
                    () => {
                        document.getElementById('microphone').innerHTML = 'Start Microphone'
                        document.getElementById('microphone').disabled = false
                    }, (err) => {
                        console.log("Failed to stop continuous recognition:", err)
                        document.getElementById('microphone').disabled = false
                    })
            }

            const chatMessages = document.getElementById('chatMessages');
            chatMessages.appendChild(createMessageElement(userQuery, true));
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            handleUserQuery(userQuery)

            isFirstRecognizingEvent = true
        }
    }

    recognitionStartedTime = new Date()
    speechRecognizer.startContinuousRecognitionAsync(
        () => {
            document.getElementById('microphone').innerHTML = 'Stop Microphone'
            document.getElementById('microphone').disabled = false
        }, (err) => {
            console.log("Failed to start continuous recognition:", err)
            document.getElementById('microphone').disabled = false
        })
}

window.updataEnableOyd = () => {
    if (document.getElementById('enableOyd').checked) {
        document.getElementById('cogSearchConfig').hidden = false
    } else {
        document.getElementById('cogSearchConfig').hidden = true
    }
}

window.updateTypeMessageBox = () => {
    if (document.getElementById('showTypeMessage').checked) {
        document.getElementById('userMessageBox').hidden = false
        document.getElementById('userMessageBox').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const userQuery = document.getElementById('userMessageBox').value
                if (userQuery !== '') {
                    const chatMessages = document.getElementById('chatMessages');
                    chatMessages.appendChild(createMessageElement(userQuery.trim('\n'), true));
                    chatMessages.scrollTop = chatMessages.scrollHeight;

                    if (isSpeaking) {
                        window.stopSpeaking()
                    }

                    handleUserQuery(userQuery.trim('\n'))
                    document.getElementById('userMessageBox').value = ''
                }
            }
        })
    } else {
        document.getElementById('userMessageBox').hidden = true
    }
}

window.updateLocalVideoForIdle = () => {
    if (document.getElementById('useLocalVideoForIdle').checked) {
        document.getElementById('showTypeMessageCheckbox').hidden = true
    } else {
        document.getElementById('showTypeMessageCheckbox').hidden = false
    }
}

window.onbeforeunload = () => {
    navigator.sendBeacon('/api/releaseClient', JSON.stringify({ clientId: clientId }))
}
