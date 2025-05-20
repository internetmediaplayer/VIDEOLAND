import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Inject @font-face for tvcd.ttf at the top of the file
if (!document.getElementById('tvcd-font-face')) {
  const style = document.createElement('style');
  style.id = 'tvcd-font-face';
  style.innerHTML = `
    @font-face {
      font-family: 'tvcd';
      src: url('tvcd.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
}

// Utility to ensure tvcd font is loaded before drawing overlays
async function ensureTVCDLoaded() {
    if (document.fonts) {
        try {
            await document.fonts.load('64px tvcd');
            await document.fonts.ready;
        } catch (e) {
            console.error('Error loading TVCD font:', e);
            // Fallback to system font
            return false;
        }
    }
    return true;
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// First-person controls
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Movement variables
const moveSpeed = 0.1;
const keys = {
    w: false,
    s: false,
    a: false,
    d: false
};

// Create office room
function createRoom() {
    const roomWidth = 10;
    const roomHeight = 4;
    const roomDepth = 10;
    
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -roomHeight / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFFFFF,
        roughness: 0.7,
        metalness: 0.1
    });

    // Back wall
    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, roomHeight),
        wallMaterial
    );
    backWall.position.z = -roomDepth / 2;
    backWall.position.y = 0;
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomDepth, roomHeight),
        wallMaterial
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -roomWidth / 2;
    leftWall.position.y = 0;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomDepth, roomHeight),
        wallMaterial
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = roomWidth / 2;
    rightWall.position.y = 0;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, roomDepth),
        wallMaterial
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight / 2;
    ceiling.receiveShadow = true;
    scene.add(ceiling);
}

// Add picture control variables at the top with other globals
let brightness = 1.0;
let contrast = 1.0;
let saturation = 1.0;
let tvScreen; // Rename to tvScreen to avoid conflict

// Create TV
function createTV() {
    // TV group
    const tvGroup = new THREE.Group();
    // New TV size
    const tvWidth = 3.5;
    const tvHeight = 2.0;
    const tvDepth = 0.1;
    // TV frame
    const tvGeometry = new THREE.BoxGeometry(tvWidth, tvHeight, tvDepth);
    const tvMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const tv = new THREE.Mesh(tvGeometry, tvMaterial);
    tv.position.set(0, 0, 0);
    tv.castShadow = true;
    tvGroup.add(tv);
    // Background TV (slightly smaller, behind the main TV)
    const bgTV = new THREE.Mesh(tvGeometry, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    bgTV.position.set(0, 0, 0.05); // Slightly in front of main TV
    bgTV.scale.set(0.95, 0.95, 0.1); // Slightly smaller
    tvGroup.add(bgTV);
    // Screen plane with custom shader material
    const screenWidth = tvWidth * 0.92;
    const screenHeight = tvHeight * 0.87;
    const screenGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const screenMaterial = new THREE.ShaderMaterial({
        uniforms: {
            videoTexture: { value: null },
            brightness: { value: brightness },
            contrast: { value: contrast },
            saturation: { value: saturation }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D videoTexture;
            uniform float brightness;
            uniform float contrast;
            uniform float saturation;
            varying vec2 vUv;

            vec3 adjustBrightness(vec3 color, float brightness) {
                return color * brightness;
            }

            vec3 adjustContrast(vec3 color, float contrast) {
                return 0.5 + (contrast * (color - 0.5));
            }

            vec3 adjustSaturation(vec3 color, float saturation) {
                float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
                return mix(vec3(grey), color, saturation);
            }

            void main() {
                vec4 texColor = texture2D(videoTexture, vUv);
                vec3 color = texColor.rgb;
                
                // Apply adjustments
                color = adjustBrightness(color, brightness);
                color = adjustContrast(color, contrast);
                color = adjustSaturation(color, saturation);
                
                gl_FragColor = vec4(color, texColor.a);
            }
        `,
        transparent: true
    });
    tvScreen = new THREE.Mesh(screenGeometry, screenMaterial);
    tvScreen.position.z = 0.054;
    tvGroup.add(tvScreen);
    // Position the whole TV group lower and more centered on the wall
    tvGroup.position.set(0, 0.2, -4.9);
    scene.add(tvGroup);
    return { tvGroup, tv, screen: tvScreen, tvWidth, tvHeight };
}

// Lighting
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 5, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // Add a point light above the TV
    const tvLight = new THREE.PointLight(0xffffff, 0.5);
    tvLight.position.set(0, 2, -4);
    tvLight.castShadow = true;
    scene.add(tvLight);
}

// Video setup
let videoElement;
let videoTexture;
let hls;

function setupVideo() {
    // Create a hidden video element in the DOM
    videoElement = document.createElement('video');
    videoElement.style.display = 'none';
    videoElement.crossOrigin = 'anonymous';
    videoElement.loop = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    document.body.appendChild(videoElement);
    
    videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;
    videoTexture.generateMipmaps = false;

    // Update the screen material's video texture uniform
    if (tvScreen && tvScreen.material.uniforms) {
        tvScreen.material.uniforms.videoTexture.value = videoTexture;
    }

    // Set up video event listeners
    videoElement.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
        updateScreenScale(aspectRatioModes[currentAspectRatioIndex]);
    });

    videoElement.addEventListener('error', (e) => {
        console.error('Video error:', e);
        showError('Error loading video. Please try a different URL.');
    });
}

// Add aspect ratio modes
const aspectRatioModes = [
    { name: 'Normal', scale: { x: 1, y: 1 } },
    { name: 'Stretch', scale: { x: 1.33, y: 1 } },
    { name: 'Zoom', scale: { x: 1.05, y: 1.05 } },
    { name: 'Wide', scale: { x: 1.15, y: 1 } },
    { name: 'Cinema', scale: { x: 1.25, y: 1 } }
];
let currentAspectRatioIndex = 0;
let nativeAspectRatio = 16/9; // Default to 16:9

function updateScreenScale(mode) {
    if (!tvScreen || !videoElement) return;
    
    // Get video's native aspect ratio
    if (videoElement.videoWidth && videoElement.videoHeight) {
        nativeAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
        console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        console.log('Native aspect ratio:', nativeAspectRatio);
    }
    
    let scaleX = mode.scale.x;
    let scaleY = mode.scale.y;
    
    if (mode.name === 'Normal') {
        // For Normal mode, respect the video's native aspect ratio
        const tvAspectRatio = 2.3 / 1.3; // TV screen aspect ratio
        
        if (nativeAspectRatio > tvAspectRatio) {
            // Video is wider than TV
            scaleX = 1;
            scaleY = tvAspectRatio / nativeAspectRatio;
        } else {
            // Video is taller than TV
            scaleY = 1;
            scaleX = nativeAspectRatio / tvAspectRatio;
        }
        
        console.log('Normal mode scales:', scaleX, scaleY);
    }
    
    // Ensure the scaled dimensions don't exceed the TV screen bounds
    const maxWidth = 2.3; // TV screen width
    const maxHeight = 1.3; // TV screen height
    
    const scaledWidth = maxWidth * scaleX;
    const scaledHeight = maxHeight * scaleY;
    
    // If scaled dimensions exceed bounds, adjust scale to fit
    if (scaledWidth > maxWidth || scaledHeight > maxHeight) {
        const widthRatio = maxWidth / scaledWidth;
        const heightRatio = maxHeight / scaledHeight;
        const scale = Math.min(widthRatio, heightRatio);
        scaleX *= scale;
        scaleY *= scale;
    }
    
    // Center the video on the screen
    tvScreen.position.set(0, 0, 0.056);
    tvScreen.scale.set(scaleX, scaleY, 1);
    
    console.log('Final scales:', scaleX, scaleY);
}

function loadVideo(url) {
    if (hls) {
        hls.destroy();
    }

    // Show loading state
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading video...';
    loadingText.style.position = 'fixed';
    loadingText.style.top = '10px';
    loadingText.style.left = '50%';
    loadingText.style.transform = 'translateX(-50%)';
    loadingText.style.color = 'white';
    loadingText.style.backgroundColor = 'rgba(0,0,0,0.7)';
    loadingText.style.padding = '10px';
    loadingText.style.borderRadius = '5px';
    loadingText.style.zIndex = '1000';
    document.body.appendChild(loadingText);

    // Helper to unmute and play after load
    async function unmuteAndPlay() {
        try {
            videoElement.muted = false;
            videoElement.volume = 1.0;
            await videoElement.play();
            updateMuteButton();
            updateScreenScale(aspectRatioModes[currentAspectRatioIndex]);
            loadingText.remove();
        } catch (e) {
            console.error('Error playing video:', e);
            showError('Error playing video. Please try a different URL.');
            loadingText.remove();
        }
    }

    // Handle local file input
    if (url instanceof File) {
        const objectUrl = URL.createObjectURL(url);
        videoElement.src = objectUrl;
        videoElement.onloadedmetadata = () => {
            unmuteAndPlay();
        };
        return;
    }

    // Check file extension/type
    const urlLower = url.toLowerCase();
    const isHLS = urlLower.endsWith('.m3u8');
    const isWebM = urlLower.endsWith('.webm');
    const isOgg = urlLower.endsWith('.ogg');
    const isMKV = urlLower.endsWith('.mkv');

    // For GitHub raw content URLs, convert to raw.githubusercontent.com
    if (url.includes('github.com') && url.includes('/raw/')) {
        url = url.replace('github.com', 'raw.githubusercontent.com').replace('/raw/', '/');
    }

    if (isHLS) {
        if (Hls.isSupported()) {
            hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                // Add WebRTC-friendly settings
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000, // 60MB
                maxBufferHole: 0.5,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            hls.loadSource(url);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                unmuteAndPlay();
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                showError('Error loading HLS stream. Please try a different URL.');
                loadingText.remove();
            });
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = url;
            videoElement.onloadedmetadata = () => {
                unmuteAndPlay();
            };
        } else {
            showError('HLS is not supported in your browser.');
            loadingText.remove();
        }
    } else if (isMKV) {
        // For MKV, we'll need to use a more compatible format
        showError('MKV format is not directly supported. Please convert to MP4 or WebM for better compatibility.');
        loadingText.remove();
    } else {
        // Direct playback for MP4, WebM, and Ogg
        videoElement.src = url;
        
        // Set appropriate MIME type
        if (isWebM) {
            videoElement.type = 'video/webm';
        } else if (isOgg) {
            videoElement.type = 'video/ogg';
        } else {
            videoElement.type = 'video/mp4';
        }

        // Add error handling for CORS issues
        videoElement.onerror = (e) => {
            console.error('Video error:', e);
            if (e.target.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                showError('Video format not supported or CORS error. Try a different URL or format.');
            } else {
                showError('Error loading video. Please try a different URL.');
            }
            loadingText.remove();
        };

        videoElement.onloadedmetadata = () => {
            unmuteAndPlay();
        };
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '10px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.color = 'white';
    errorDiv.style.backgroundColor = 'rgba(255,0,0,0.7)';
    errorDiv.style.padding = '10px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.zIndex = '1000';
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Control panel variables
let controlPanel;
let isControlPanelVisible = false;
let muteButton;
let playPauseButton, rewindButton, forwardButton, volumeDownButton, volumeUpButton, progressBar, progressFill, timeLabel, inputTypeSelect, urlInput, fileInput, loadButton;
let settingsButton;

// Add subtitle variables at the top with other globals
let subtitleOverlayMesh, subtitleOverlayCanvas, subtitleOverlayCtx, subtitleOverlayTexture;
let isSubtitlesEnabled = false;
let currentSubtitleTrack = null;
let subtitleTracks = [];

function createControlPanel() {
    // Remove old panel if exists
    if (controlPanel) controlPanel.remove();
    controlPanel = document.createElement('div');
    controlPanel.style.position = 'fixed';
    controlPanel.style.top = '50%';
    controlPanel.style.left = '50%';
    controlPanel.style.transform = 'translate(-50%, -50%)';
    controlPanel.style.background = 'rgba(51, 51, 51, 0.75)';
    controlPanel.style.backdropFilter = 'blur(48px) saturate(2)';
    controlPanel.style.border = '1px solid #ccc';
    controlPanel.style.borderRadius = '12px';
    controlPanel.style.boxShadow = 'rgb(128, 128, 128) 0px 0px 0px 1px, rgb(0, 0, 0) 0px 0px 0px 2px, rgba(0, 0, 0, 0.18) 0px 8px 32px 0px';
    controlPanel.style.padding = '0';
    controlPanel.style.minWidth = '420px';
    controlPanel.style.color = '#ffffffbf';
    controlPanel.style.display = 'none';
    controlPanel.style.zIndex = '1000';
    controlPanel.style.fontFamily = 'system-ui, sans-serif';

    // Top bar (draggable, with close button)
    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.alignItems = 'center';
    topBar.style.marginBottom = '4px';
    topBar.style.height = '28px';
    topBar.style.justifyContent = 'center';
    topBar.style.cursor = 'move';
    topBar.innerHTML = `
      <span style="display:inline-block;position:absolute;left:0;width:12px;height:12px;background:#ff5f56;border-radius:50%;margin:8px;cursor:pointer;" id="tv-close-btn"></span>
      <span style="font-weight:600;letter-spacing:0.5px;">TV Player</span>
    `;
    controlPanel.appendChild(topBar);

    // Drag logic
    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
    topBar.addEventListener('mousedown', (e) => {
        if (e.target.id === 'tv-close-btn') return;
        isDragging = true;
        dragOffsetX = e.clientX - controlPanel.getBoundingClientRect().left;
        dragOffsetY = e.clientY - controlPanel.getBoundingClientRect().top;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            controlPanel.style.left = e.clientX - dragOffsetX + 'px';
            controlPanel.style.top = e.clientY - dragOffsetY + 'px';
            controlPanel.style.transform = '';
        }
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });
    // Close button logic
    setTimeout(() => {
        const closeBtn = document.getElementById('tv-close-btn');
        if (closeBtn) closeBtn.onclick = () => { toggleControlPanel(false); };
    }, 0);

    // Input tabs
    const inputTabs = document.createElement('div');
    inputTabs.style.display = 'flex';
    inputTabs.style.marginBottom = '12px';
    inputTabs.style.borderBottom = '1px solid #ccc';
    
    const webTab = document.createElement('button');
    webTab.textContent = 'Web URL';
    webTab.style.flex = '1';
    webTab.style.padding = '8px';
    webTab.style.border = 'none';
    webTab.style.background = 'none';
    webTab.style.cursor = 'pointer';
    webTab.style.borderBottom = '2px solid #007aff';
    webTab.style.color = '#007aff';
    
    const fileTab = document.createElement('button');
    fileTab.textContent = 'Local File';
    fileTab.style.flex = '1';
    fileTab.style.padding = '8px';
    fileTab.style.border = 'none';
    fileTab.style.background = 'none';
    fileTab.style.cursor = 'pointer';
    fileTab.style.color = '#666';
    
    inputTabs.appendChild(webTab);
    inputTabs.appendChild(fileTab);
    controlPanel.appendChild(inputTabs);

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.style.marginBottom = '12px';
    
    // Web URL input
    const webInput = document.createElement('div');
    webInput.style.display = 'flex';
    webInput.style.alignItems = 'center';
    webInput.style.gap = '8px';
    webInput.style.padding = '0 12px';
    
    urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'Enter video URL (mp4 or m3u8)';
    urlInput.style.flex = '1';
    urlInput.style.padding = '0 12px';
    urlInput.style.height = '32px';
    urlInput.style.border = 'none';
    urlInput.style.borderRadius = '6px';
    urlInput.style.color = '#ffffffbf';
    urlInput.style.backgroundColor = '#222';
    
    loadButton = document.createElement('button');
    loadButton.innerHTML = '<span class="material-symbols-rounded">play_circle</span>';
    loadButton.style.padding = '4px';
    loadButton.style.height = '32px';
    loadButton.style.fontSize = '18px';
    loadButton.style.background = '#007aff';
    loadButton.style.color = 'white';
    loadButton.style.border = 'none';
    loadButton.style.borderRadius = '6px';
    loadButton.style.cursor = 'pointer';
    loadButton.style.transition = 'background 0.2s';
    loadButton.onmouseover = () => loadButton.style.background = '#0051a8';
    loadButton.onmouseout = () => loadButton.style.background = '#007aff';
    
    webInput.appendChild(urlInput);
    webInput.appendChild(loadButton);
    
    // File input
    const fileInput = document.createElement('div');
    fileInput.style.display = 'none';
    fileInput.style.flex = '1';
    fileInput.style.alignItems = 'center';
    fileInput.style.gap = '8px';
    
    const fileInputElement = document.createElement('input');
    fileInputElement.type = 'file';
    fileInputElement.accept = 'video/mp4,video/webm,video/ogg,video/x-matroska,video/x-mpegURL';
    fileInputElement.style.flex = '1';
    fileInputElement.style.padding = '6px';
    fileInputElement.style.border = '1px solid #ccc';
    fileInputElement.style.borderRadius = '6px';
    
    const fileLoadButton = document.createElement('button');
    fileLoadButton.innerHTML = '<span class="material-symbols-rounded">play_circle</span>';
    fileLoadButton.style.padding = '6px 16px';
    fileLoadButton.style.fontSize = '18px';
    fileLoadButton.style.background = '#007aff';
    fileLoadButton.style.color = 'white';
    fileLoadButton.style.border = 'none';
    fileLoadButton.style.borderRadius = '6px';
    fileLoadButton.style.cursor = 'pointer';
    fileLoadButton.style.transition = 'background 0.2s';
    fileLoadButton.onmouseover = () => fileLoadButton.style.background = '#0051a8';
    fileLoadButton.onmouseout = () => fileLoadButton.style.background = '#007aff';
    
    fileInput.appendChild(fileInputElement);
    fileInput.appendChild(fileLoadButton);
    
    inputContainer.appendChild(webInput);
    inputContainer.appendChild(fileInput);
    controlPanel.appendChild(inputContainer);

    // Tab switching logic
    function switchTab(tab) {
        if (tab === 'web') {
            webTab.style.borderBottom = '2px solid #007aff';
            webTab.style.color = '#007aff';
            fileTab.style.borderBottom = 'none';
            fileTab.style.color = '#666';
            webInput.style.display = 'flex';
            fileInput.style.display = 'none';
        } else {
            fileTab.style.borderBottom = '2px solid #007aff';
            fileTab.style.color = '#007aff';
            webTab.style.borderBottom = 'none';
            webTab.style.color = '#666';
            webInput.style.display = 'none';
            fileInput.style.display = 'flex';
        }
    }

    webTab.onclick = () => switchTab('web');
    fileTab.onclick = () => switchTab('file');

    // Button actions
    loadButton.onclick = () => {
        const url = urlInput.value.trim();
        if (url) {
            loadVideo(url);
            toggleControlPanel();
        }
    };
    
    fileLoadButton.onclick = () => {
        if (fileInputElement.files.length > 0) {
            loadVideo(fileInputElement.files[0]);
            toggleControlPanel();
        }
    };

    // Progress bar
    const progressRow = document.createElement('div');
    progressRow.style.display = 'flex';
    progressRow.style.alignItems = 'center';
    progressRow.style.marginBottom = '10px';
    progressRow.style.padding = '0 12px';
    progressBar = document.createElement('div');
    progressBar.style.flex = '1';
    progressBar.style.height = '4px';
    progressBar.style.background = '#80808040';
    progressBar.style.borderRadius = '4px';
    progressBar.style.overflow = 'hidden';
    progressBar.style.marginRight = '12px';
    progressFill = document.createElement('div');
    progressFill.style.height = '100%';
    progressFill.style.width = '0%';
    progressFill.style.background = '#007aff';
    progressFill.style.transition = 'width 0.2s';
    progressFill.style.borderRadius = '4px';
    progressBar.appendChild(progressFill);
    timeLabel = document.createElement('span');
    timeLabel.style.fontSize = '13px';
    timeLabel.style.color = '#555';
    progressRow.appendChild(progressBar);
    progressRow.appendChild(timeLabel);
    controlPanel.appendChild(progressRow);

    // Controls row (playback)
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.alignItems = 'center';
    controlsRow.style.justifyContent = 'center';
    controlsRow.style.gap = '8px';
    controlsRow.style.marginBottom = '8px';
    controlsRow.style.padding = '0 12px';
    rewindButton = document.createElement('button');
    rewindButton.innerHTML = '<span class="material-symbols-rounded">fast_rewind</span>';
    playPauseButton = document.createElement('button');
    playPauseButton.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
    forwardButton = document.createElement('button');
    forwardButton.innerHTML = '<span class="material-symbols-rounded">fast_forward</span>';
    [rewindButton, playPauseButton, forwardButton].forEach(btn => {
        btn.style.padding = '4px';
        btn.style.height = '32px';
        btn.style.fontSize = '20px';
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.onmouseover = () => btn.style.background = '#e0e0e0';
        btn.onmouseout = () => btn.style.background = 'none';
    });
    controlsRow.appendChild(rewindButton);
    controlsRow.appendChild(playPauseButton);
    controlsRow.appendChild(forwardButton);
    controlPanel.appendChild(controlsRow);

    // Volume row (separate)
    const volumeRow = document.createElement('div');
    volumeRow.style.display = 'flex';
    volumeRow.style.alignItems = 'center';
    volumeRow.style.justifyContent = 'center';
    volumeRow.style.gap = '8px';
    volumeDownButton = document.createElement('button');
    volumeDownButton.innerHTML = '<span class="material-symbols-rounded">remove</span>';
    muteButton = document.createElement('button');
    muteButton.innerHTML = '<span class="material-symbols-rounded">volume_mute</span>';
    volumeUpButton = document.createElement('button');
    volumeUpButton.innerHTML = '<span class="material-symbols-rounded">add</span>';
    [volumeDownButton, muteButton, volumeUpButton].forEach(btn => {
        btn.style.padding = '4px';
        btn.style.height = '32px';
        btn.style.fontSize = '20px';
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.onmouseover = () => btn.style.background = '#e0e0e0';
        btn.onmouseout = () => btn.style.background = 'none';
    });
    volumeRow.appendChild(volumeDownButton);
    volumeRow.appendChild(muteButton);
    volumeRow.appendChild(volumeUpButton);
    controlPanel.appendChild(volumeRow);

    // Aspect ratio row
    const aspectRatioRow = document.createElement('div');
    aspectRatioRow.style.display = 'flex';
    aspectRatioRow.style.alignItems = 'center';
    aspectRatioRow.style.justifyContent = 'center';
    aspectRatioRow.style.gap = '8px';
    aspectRatioRow.style.marginTop = '8px';
    
    const aspectRatioButton = document.createElement('button');
    aspectRatioButton.innerHTML = '<span class="material-symbols-rounded">aspect_ratio</span>';
    aspectRatioButton.style.padding = '4px';
    aspectRatioButton.style.height = '32px';
    aspectRatioButton.style.fontSize = '20px';
    aspectRatioButton.style.background = 'none';
    aspectRatioButton.style.border = 'none';
    aspectRatioButton.style.cursor = 'pointer';
    aspectRatioButton.style.borderRadius = '4px';
    aspectRatioButton.onmouseover = () => aspectRatioButton.style.background = '#e0e0e0';
    aspectRatioButton.onmouseout = () => aspectRatioButton.style.background = 'none';
    
    const aspectRatioLabel = document.createElement('span');
    aspectRatioLabel.style.display = 'none';
    aspectRatioLabel.textContent = aspectRatioModes[currentAspectRatioIndex].name;
    
    aspectRatioButton.onclick = () => {
        currentAspectRatioIndex = (currentAspectRatioIndex + 1) % aspectRatioModes.length;
        const mode = aspectRatioModes[currentAspectRatioIndex];
        aspectRatioLabel.textContent = mode.name;
        
        updateScreenScale(mode);
        showTVOverlay('aspect', mode.name);
    };
    
    const subtitleButton = document.createElement('button');
    subtitleButton.innerHTML = '<span class="material-symbols-rounded">subtitles</span>';
    subtitleButton.style.padding = '4px';
    subtitleButton.style.height = '32px';
    subtitleButton.style.fontSize = '20px';
    subtitleButton.style.background = 'none';
    subtitleButton.style.border = 'none';
    subtitleButton.style.cursor = 'pointer';
    subtitleButton.style.borderRadius = '4px';
    subtitleButton.onmouseover = () => subtitleButton.style.background = '#e0e0e0';
    subtitleButton.onmouseout = () => subtitleButton.style.background = 'none';
    
    aspectRatioRow.appendChild(aspectRatioButton);
    aspectRatioRow.appendChild(aspectRatioLabel);
    aspectRatioRow.appendChild(subtitleButton);

    settingsButton = document.createElement('button');
    settingsButton.innerHTML = '<span class="material-symbols-rounded">settings</span>';
    settingsButton.style.padding = '4px';
    settingsButton.style.height = '32px';
    settingsButton.style.fontSize = '20px';
    settingsButton.style.background = 'none';
    settingsButton.style.border = 'none';
    settingsButton.style.cursor = 'pointer';
    settingsButton.style.borderRadius = '4px';
    settingsButton.onmouseover = () => settingsButton.style.background = '#e0e0e0';
    settingsButton.onmouseout = () => settingsButton.style.background = 'none';
    
    aspectRatioRow.appendChild(settingsButton);
    controlPanel.appendChild(aspectRatioRow);

    // Add subtitle input at the bottom
    const subtitleInputRow = document.createElement('div');
    subtitleInputRow.style.display = 'none';
    subtitleInputRow.style.padding = '12px';
    subtitleInputRow.style.borderTop = '1px solid #ffffff40';
    subtitleInputRow.style.marginTop = '8px';
    
    const subtitleInput = document.createElement('input');
    subtitleInput.type = 'text';
    subtitleInput.placeholder = 'Enter subtitle URL (.vtt or .srt)';
    subtitleInput.style.flex = '1';
    subtitleInput.style.padding = '0 12px';
    subtitleInput.style.height = '32px';
    subtitleInput.style.border = 'none';
    subtitleInput.style.borderRadius = '6px';
    subtitleInput.style.color = '#ffffffbf';
    subtitleInput.style.backgroundColor = '#222';
    subtitleInput.style.width = '100%';
    subtitleInput.style.boxSizing = 'border-box';
    
    const loadSubtitleButton = document.createElement('button');
    loadSubtitleButton.innerHTML = '<span class="material-symbols-rounded">add</span>';
    loadSubtitleButton.style.padding = '4px';
    loadSubtitleButton.style.height = '32px';
    loadSubtitleButton.style.fontSize = '20px';
    loadSubtitleButton.style.background = '#007aff';
    loadSubtitleButton.style.color = 'white';
    loadSubtitleButton.style.border = 'none';
    loadSubtitleButton.style.borderRadius = '4px';
    loadSubtitleButton.style.cursor = 'pointer';
    loadSubtitleButton.style.marginTop = '8px';
    loadSubtitleButton.style.width = '100%';
    
    subtitleInputRow.appendChild(subtitleInput);
    subtitleInputRow.appendChild(loadSubtitleButton);
    controlPanel.appendChild(subtitleInputRow);
    
    subtitleButton.onclick = () => {
        isSubtitlesEnabled = !isSubtitlesEnabled;
        subtitleInputRow.style.display = isSubtitlesEnabled ? 'block' : 'none';
        subtitleOverlayMesh.visible = isSubtitlesEnabled;
        updateSubtitles();
    };
    
    loadSubtitleButton.onclick = async () => {
        const url = subtitleInput.value.trim();
        if (url) {
            try {
                // Convert GitHub raw URLs to raw.githubusercontent.com format
                let subtitleUrl = url;
                if (url.includes('github.com') && url.includes('/raw/')) {
                    subtitleUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/raw/', '/');
                }

                const response = await fetch(subtitleUrl);
                const text = await response.text();
                
                // Parse subtitles (both VTT and SRT)
                const cues = parseSubtitles(text, url.toLowerCase().endsWith('.srt'));
                
                const track = videoElement.addTextTrack('subtitles', 'English', 'en');
                cues.forEach(cue => {
                    const vttCue = new VTTCue(cue.startTime, cue.endTime, cue.text);
                    track.addCue(vttCue);
                });
                
                currentSubtitleTrack = track;
                updateSubtitles();
            } catch (e) {
                console.error('Error loading subtitles:', e);
                showError('Error loading subtitles. Try a different URL.');
            }
        }
    };

    // Material Symbols font
    if (!document.getElementById('material-symbols')) {
        const link = document.createElement('link');
        link.id = 'material-symbols';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
        document.head.appendChild(link);
    }

    // Initial state
    urlInput.style.display = '';
    fileInput.style.display = 'none';
    urlInput.readOnly = false;
    updateMuteButton();
    updatePlayPauseButton();
    updateProgressBar();

    // Update progress bar as video plays
    videoElement.ontimeupdate = updateProgressBar;
    videoElement.onplay = updatePlayPauseButton;
    videoElement.onpause = updatePlayPauseButton;
    videoElement.onvolumechange = updateMuteButton;

    document.body.appendChild(controlPanel);
}

function toggleControlPanel(forceState) {
    if (typeof forceState === 'boolean') {
        isControlPanelVisible = forceState;
    } else {
        isControlPanelVisible = !isControlPanelVisible;
    }
    controlPanel.style.display = isControlPanelVisible ? 'block' : 'none';
    if (isControlPanelVisible) {
        controls.unlock();
    }
}

// Mute/unmute button logic
function updateMuteButton() {
    if (!muteButton) return;
    muteButton.innerHTML = videoElement.muted ? '<span class="material-symbols-rounded">volume_mute</span>' : '<span class="material-symbols-rounded">volume_up</span>';
}

function updatePlayPauseButton() {
    if (!playPauseButton) return;
    playPauseButton.innerHTML = videoElement.paused ? '<span class="material-symbols-rounded">play_arrow</span>' : '<span class="material-symbols-rounded">pause</span>';
}

function updateProgressBar() {
    if (!progressBar || !progressFill || !timeLabel) return;
    if (videoElement.duration && !isNaN(videoElement.duration)) {
        const percent = (videoElement.currentTime / videoElement.duration) * 100;
        progressFill.style.width = percent + '%';
        const cur = formatTime(videoElement.currentTime);
        const dur = formatTime(videoElement.duration);
        timeLabel.textContent = `${cur} / ${dur}`;
    } else {
        progressFill.style.width = '0%';
        timeLabel.textContent = 'LIVE';
    }
}

function formatTime(sec) {
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// TV overlay system
let tvOverlayMesh, tvOverlayCanvas, tvOverlayCtx, tvOverlayTexture, tvOverlayTimeout;
let playbackOverlayMesh, playbackOverlayCanvas, playbackOverlayCtx, playbackOverlayTexture, playbackOverlayTimeout;
function setupTVOverlay() {
    // Main overlay (VOL, picture)
    const overlayCanvasWidth = 1024;
    const overlayCanvasHeight = 128;
    tvOverlayCanvas = document.createElement('canvas');
    tvOverlayCanvas.width = overlayCanvasWidth;
    tvOverlayCanvas.height = overlayCanvasHeight;
    tvOverlayCtx = tvOverlayCanvas.getContext('2d');
    tvOverlayTexture = new THREE.CanvasTexture(tvOverlayCanvas);
    const overlayGeometry = new THREE.PlaneGeometry(tvWidth * 0.92, tvHeight * 0.18);
    const overlayMaterial = new THREE.MeshBasicMaterial({ 
        map: tvOverlayTexture, 
        transparent: true,
        opacity: 0.9
    });
    tvOverlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
    tvOverlayMesh.position.set(0, -tvHeight * 0.18, 0.11); // relative to tvGroup
    tvOverlayMesh.renderOrder = 999;
    tvOverlayMesh.visible = false;
    scene.add(tvOverlayMesh);
    // Playback overlay (play, pause, etc.)
    playbackOverlayCanvas = document.createElement('canvas');
    playbackOverlayCanvas.width = overlayCanvasWidth;
    playbackOverlayCanvas.height = overlayCanvasHeight;
    playbackOverlayCtx = playbackOverlayCanvas.getContext('2d');
    playbackOverlayTexture = new THREE.CanvasTexture(playbackOverlayCanvas);
    const playbackGeometry = new THREE.PlaneGeometry(tvWidth * 0.92, tvHeight * 0.18);
    const playbackMaterial = new THREE.MeshBasicMaterial({ 
        map: playbackOverlayTexture, 
        transparent: true,
        opacity: 0.9
    });
    playbackOverlayMesh = new THREE.Mesh(playbackGeometry, playbackMaterial);
    playbackOverlayMesh.position.set(0, tvHeight * 0.36, 0.11); // high on TV
    playbackOverlayMesh.renderOrder = 1000;
    playbackOverlayMesh.visible = false;
    scene.add(playbackOverlayMesh);
    // Ensure Material Symbols font is loaded for canvas
    if (!document.getElementById('material-symbols-canvas')) {
        const link = document.createElement('link');
        link.id = 'material-symbols-canvas';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
        document.head.appendChild(link);
    }
}

function drawMaterialSymbol(ctx, symbol, x, y, size = 72, color = '#fff') {
    ctx.save();
    ctx.font = `normal ${size}px \"Material Symbols Rounded\", system-ui, sans-serif`;
    // Try to set font-variation-settings for filled icons (experimental, may not work in all browsers)
    if ('fontVariantSettings' in ctx) {
        ctx['fontVariantSettings'] = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    } else if ('font-variation-settings' in ctx) {
        ctx['font-variation-settings'] = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    }
    // If not supported, icons may appear outlined. For guaranteed filled icons, use SVG or pre-rendered images.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    ctx.fillText(symbol, x, y);
    ctx.restore();
}

// Wrap showTVOverlay for playback overlays to ensure font is loaded
const originalShowTVOverlay = showTVOverlay;
showTVOverlay = async function(type, value) {
  if (type === 'play' || type === 'pause' || type === 'rewind' || type === 'forward') {
    await ensureTVCDLoaded();
    originalShowTVOverlay(type, value);
  } else {
    originalShowTVOverlay(type, value);
  }
};

function showTVOverlay(type, value) {
    // For playback symbols, use playback overlay
    if (type === 'play' || type === 'pause' || type === 'rewind' || type === 'forward') {
        if (!playbackOverlayCtx || !playbackOverlayCanvas) return;
        playbackOverlayCtx.clearRect(0, 0, playbackOverlayCanvas.width, playbackOverlayCanvas.height);
        playbackOverlayCtx.globalAlpha = 1.0;
        const centerY = playbackOverlayCanvas.height / 2;
        let symbol = null;
        if (type === 'play') symbol = 'play_arrow';
        if (type === 'pause') symbol = 'pause';
        if (type === 'rewind') symbol = 'fast_rewind';
        if (type === 'forward') symbol = 'fast_forward';
        if (symbol) {
            // Only show the label, using the 'tvcd' font
            let label = '';
            if (type === 'play') label = 'PLAY';
            if (type === 'pause') label = 'PAUSE';
            if (type === 'rewind') label = 'REWIND';
            if (type === 'forward') label = 'FORWARD';
            playbackOverlayCtx.font = `bold 40px 'tvcd', system-ui, sans-serif`;
            playbackOverlayCtx.textAlign = 'left';
            playbackOverlayCtx.textBaseline = 'middle';
            playbackOverlayCtx.fillStyle = '#fff';
            playbackOverlayCtx.shadowColor = '#000';
            playbackOverlayCtx.shadowBlur = 8;
            // Place label near the left with a margin
            const margin = 48;
            const yOffset = 40;
            playbackOverlayCtx.fillText(label, margin, centerY + yOffset - 6);
        }
        playbackOverlayTexture.needsUpdate = true;
        playbackOverlayMesh.visible = true;
        if (playbackOverlayTimeout) clearTimeout(playbackOverlayTimeout);
        playbackOverlayTimeout = setTimeout(() => {
            playbackOverlayMesh.visible = false;
        }, 5000);
        return;
    }
    // All other overlays use main overlay
    if (!tvOverlayCtx || !tvOverlayCanvas) return;
    tvOverlayCtx.clearRect(0, 0, tvOverlayCanvas.width, tvOverlayCanvas.height);
    tvOverlayCtx.globalAlpha = 1.0;
    // Move overlay lower on the screen
    const centerY = tvOverlayCanvas.height * 0.7;
    let icon = null, numBars = 10, filledBars = 0;
    if (type === 'brightness') { icon = 'wb_sunny'; filledBars = Math.round((value / 2) * numBars); }
    if (type === 'contrast') { icon = 'contrast'; filledBars = Math.round((value / 2) * numBars); }
    if (type === 'saturation') { icon = 'opacity'; filledBars = Math.round((value / 2) * numBars); }
    const barWidth = 18;
    const barHeight = 36;
    const barSpacing = 6;
    const barsWidth = numBars * barWidth + (numBars - 1) * barSpacing;
    const gap = 20;
    // Set up overlay label and fixed width for alignment
    let overlayLabel = '';
    if (type === 'brightness') overlayLabel = 'BRIGHTNESS';
    if (type === 'contrast') overlayLabel = 'CONTRAST';
    if (type === 'saturation') overlayLabel = 'SATURATION';
    if (type === 'volume') overlayLabel = 'VOLUME';
    tvOverlayCtx.font = `bold 40px 'tvcd', system-ui, sans-serif`;
    // Fixed label width based on the longest label
    const fixedLabel = 'BRIGHTNESS';
    const fixedLabel2 = 'SATURATION';
    const fixedLabelWidth = Math.max(tvOverlayCtx.measureText(fixedLabel).width, tvOverlayCtx.measureText(fixedLabel2).width);
    const labelWidth = fixedLabelWidth + 32; // make a little wider for spacing
    if (type === 'brightness' || type === 'contrast' || type === 'saturation') {
        // Reserve the same width for the label as for the bars
        const iconBoxWidth = labelWidth;
        const groupWidth = iconBoxWidth + gap + barsWidth;
        // Scoot overlays to the left by subtracting from groupStartX
        const leftMargin = 100;
        const groupStartX = leftMargin;
        const labelX = groupStartX + iconBoxWidth; // right-aligned
        const barsStartX = groupStartX + iconBoxWidth + gap;
        const yOffset = 2;
        // Draw label (right-aligned)
        tvOverlayCtx.textAlign = 'right';
        tvOverlayCtx.textBaseline = 'middle';
        tvOverlayCtx.fillStyle = '#fff';
        tvOverlayCtx.shadowColor = '#000';
        tvOverlayCtx.shadowBlur = 8;
        tvOverlayCtx.fillText(overlayLabel, labelX, centerY + yOffset);
        // Draw filled bars as font glyphs
        const barChar = '\x7f';
        const barString = barChar.repeat(filledBars);
        tvOverlayCtx.textAlign = 'left';
        tvOverlayCtx.font = `bold 40px 'tvcd', system-ui, sans-serif`;
        tvOverlayCtx.fillText(barString, barsStartX, centerY + yOffset);
    } else if (type === 'volume') {
        const groupWidth = labelWidth + gap + barsWidth;
        const leftMargin = 100;
        const groupStartX = leftMargin;
        const labelX = groupStartX + labelWidth; // right-aligned
        const barsStartX = groupStartX + labelWidth + gap;
        const yOffset = 2;
        // Draw label (right-aligned)
        tvOverlayCtx.textAlign = 'right';
        tvOverlayCtx.textBaseline = 'middle';
        tvOverlayCtx.fillStyle = '#fff';
        tvOverlayCtx.shadowColor = '#000';
        tvOverlayCtx.shadowBlur = 8;
        tvOverlayCtx.fillText(overlayLabel, labelX, centerY + yOffset);
        // Draw filled bars as font glyphs
        const barChar = '\x7f';
        const filledBars = Math.round(value * numBars);
        const barString = barChar.repeat(filledBars);
        tvOverlayCtx.textAlign = 'left';
        tvOverlayCtx.font = `bold 40px 'tvcd', system-ui, sans-serif`;
        tvOverlayCtx.fillText(barString, barsStartX, centerY + yOffset);
    } else if (type === 'aspect') {
        tvOverlayCtx.font = 'bold 40px system-ui, sans-serif';
        tvOverlayCtx.textAlign = 'center';
        tvOverlayCtx.textBaseline = 'middle';
        tvOverlayCtx.fillStyle = '#fff';
        tvOverlayCtx.shadowColor = '#000';
        tvOverlayCtx.shadowBlur = 8;
        tvOverlayCtx.fillText((value + '').toUpperCase(), tvOverlayCanvas.width / 2, centerY);
    }
    tvOverlayTexture.needsUpdate = true;
    tvOverlayMesh.visible = true;
    if (tvOverlayTimeout) clearTimeout(tvOverlayTimeout);
    tvOverlayTimeout = setTimeout(() => {
        tvOverlayMesh.visible = false;
    }, 5000);
}

// Add subtitle setup function
function setupSubtitleOverlay() {
    subtitleOverlayCanvas = document.createElement('canvas');
    subtitleOverlayCanvas.width = 1024;
    subtitleOverlayCanvas.height = 128;
    subtitleOverlayCtx = subtitleOverlayCanvas.getContext('2d');
    subtitleOverlayTexture = new THREE.CanvasTexture(subtitleOverlayCanvas);
    const overlayGeometry = new THREE.PlaneGeometry(2.2, 0.3);
    const overlayMaterial = new THREE.MeshBasicMaterial({ 
        map: subtitleOverlayTexture, 
        transparent: true,
        opacity: 0.9
    });
    subtitleOverlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
    subtitleOverlayMesh.position.set(0, -tvHeight * 0.33, 0.11); // relative to tvGroup
    subtitleOverlayMesh.renderOrder = 999;
    subtitleOverlayMesh.visible = false;
    scene.add(subtitleOverlayMesh);
}

// Add subtitle rendering function
function updateSubtitles() {
    if (!isSubtitlesEnabled || !currentSubtitleTrack || !subtitleOverlayCtx) return;
    const currentTime = videoElement.currentTime;
    const currentCue = currentSubtitleTrack.activeCues[0];
    if (currentCue) {
        subtitleOverlayCtx.clearRect(0, 0, subtitleOverlayCanvas.width, subtitleOverlayCanvas.height);
        // Set up text properties
        subtitleOverlayCtx.font = 'bold 48px system-ui, sans-serif';
        subtitleOverlayCtx.textAlign = 'center';
        // Draw at the bottom of the canvas
        const y = subtitleOverlayCanvas.height - 24;
        subtitleOverlayCtx.textBaseline = 'alphabetic';
        // Draw text outline
        subtitleOverlayCtx.strokeStyle = '#000';
        subtitleOverlayCtx.lineWidth = 4;
        subtitleOverlayCtx.strokeText(currentCue.text, subtitleOverlayCanvas.width / 2, y);
        // Draw text fill
        subtitleOverlayCtx.fillStyle = '#fff';
        subtitleOverlayCtx.fillText(currentCue.text, subtitleOverlayCanvas.width / 2, y);
        subtitleOverlayTexture.needsUpdate = true;
        subtitleOverlayMesh.visible = true;
    } else {
        subtitleOverlayMesh.visible = false;
    }
}

// Update subtitle parser to handle both VTT and SRT
function parseSubtitles(text, isSRT) {
    try {
        const cues = [];
        const lines = text.split('\n');
        let currentCue = null;
        let lineIndex = 0;
        
        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            
            // Skip empty lines and headers
            if (line === '' || line === 'WEBVTT' || line === '1') {
                lineIndex++;
                continue;
            }
            
            // More robust timestamp parsing
            const timestampPattern = isSRT 
                ? /(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})/
                : /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;
                
            const timestampMatch = line.match(timestampPattern);
            
            if (timestampMatch) {
                if (currentCue) {
                    // Validate cue before adding
                    if (currentCue.startTime < currentCue.endTime && currentCue.text.trim()) {
                        cues.push(currentCue);
                    }
                }
                
                const startTime = parseTimestamp(timestampMatch[1].replace(',', '.'));
                const endTime = parseTimestamp(timestampMatch[2].replace(',', '.'));
                
                if (!isNaN(startTime) && !isNaN(endTime) && startTime < endTime) {
                    currentCue = {
                        startTime,
                        endTime,
                        text: ''
                    };
                }
            } else if (currentCue) {
                if (!isSRT || !/^\d+$/.test(line)) {
                    currentCue.text += (currentCue.text ? '\n' : '') + line;
                }
            }
            
            lineIndex++;
        }
        
        if (currentCue && currentCue.startTime < currentCue.endTime && currentCue.text.trim()) {
            cues.push(currentCue);
        }
        
        return cues;
    } catch (e) {
        console.error('Error parsing subtitles:', e);
        return [];
    }
}

function parseTimestamp(timestamp) {
    const [hours, minutes, seconds] = timestamp.split(':');
    return parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds);
}

// Setup the scene
createRoom();
const { tvGroup, tv, screen, tvWidth, tvHeight } = createTV();
setupLighting();
setupVideo();
createControlPanel();
setupTVOverlay();
setupSubtitleOverlay();

screen.material.map = videoTexture;
// Update overlay and subtitle mesh positions to match new TV size/position
// TV overlay (centered on TV screen)
if (tvOverlayMesh) {
    tvOverlayMesh.position.set(0, -tvHeight * 0.18, 0.11); // relative to tvGroup
    tvGroup.add(tvOverlayMesh);
}
if (playbackOverlayMesh) {
    // Place playback overlay high on the TV
    playbackOverlayMesh.position.set(0, tvHeight * 0.36, 0.11); // relative to tvGroup
    tvGroup.add(playbackOverlayMesh);
}
if (subtitleOverlayMesh) {
    // Place subtitle overlay just above the very bottom of the TV
    subtitleOverlayMesh.position.set(0, -tvHeight * 0.33, 0.11); // relative to tvGroup
    tvGroup.add(subtitleOverlayMesh);
}

// Position camera
camera.position.set(0, 0, 0);

// Movement controls
document.addEventListener('keydown', (event) => {
    if (!isControlPanelVisible && event.key.toLowerCase() in keys) {
        keys[event.key.toLowerCase()] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (!isControlPanelVisible && event.key.toLowerCase() in keys) {
        keys[event.key.toLowerCase()] = false;
    }
});

let pointerLockCooldown = false;

// Listen for pointer lock error and change events
function onPointerLockError(e) {
    pointerLockCooldown = true;
    setTimeout(() => { pointerLockCooldown = false; }, 500);
}

function onPointerLockChange() {
    if (!controls.isLocked) {
        pointerLockCooldown = true;
        setTimeout(() => { pointerLockCooldown = false; }, 200);
    }
}

document.addEventListener('pointerlockerror', onPointerLockError, false);
document.addEventListener('pointerlockchange', onPointerLockChange, false);

function tryPointerLock() {
    if (!controls.isLocked && !pointerLockCooldown && !isControlPanelVisible) {
        try {
            const result = controls.lock();
            if (result && typeof result.then === 'function') {
                result.catch(() => {});
            }
        } catch (e) {}
    }
}

document.addEventListener('click', tryPointerLock);

// Handle window resize
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const handleResize = debounce(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, 250);

window.addEventListener('resize', handleResize);

// Raycaster for TV interaction
const raycaster = new THREE.Raycaster();
let isLookingAtTV = false;

// ENTER/RETURN to open control panel
window.addEventListener('keydown', (e) => {
    if (!isControlPanelVisible && isLookingAtTV && (e.key === 'Enter' || e.key === 'Return')) {
        toggleControlPanel();
    }
    if (isControlPanelVisible && e.key === 'Escape') {
        toggleControlPanel();
    }
});

// Playback controls
rewindButton.onclick = () => {
    if (!videoElement) return;
    videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
    showTVOverlay('rewind');
};

playPauseButton.onclick = async () => {
    if (!videoElement) return;
    try {
        if (videoElement.paused) {
            await videoElement.play();
            showTVOverlay('play');
        } else {
            videoElement.pause();
            showTVOverlay('pause');
        }
        updatePlayPauseButton();
    } catch (e) {
        console.error('Error toggling play/pause:', e);
        showError('Error controlling video playback.');
    }
};

forwardButton.onclick = () => {
    if (!videoElement) return;
    videoElement.currentTime = Math.min(videoElement.duration || 0, videoElement.currentTime + 10);
    showTVOverlay('forward');
};

volumeDownButton.onclick = () => {
    if (!videoElement) return;
    videoElement.volume = Math.max(0, videoElement.volume - 0.1);
    showTVOverlay('volume', videoElement.volume);
};

volumeUpButton.onclick = () => {
    if (!videoElement) return;
    videoElement.volume = Math.min(1, videoElement.volume + 0.1);
    showTVOverlay('volume', videoElement.volume);
};

muteButton.onclick = () => {
    if (!videoElement) return;
    videoElement.muted = !videoElement.muted;
    updateMuteButton();
    showTVOverlay('volume', videoElement.muted ? 0 : videoElement.volume);
};

progressBar.onclick = (e) => {
    if (!videoElement || !videoElement.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoElement.currentTime = percent * videoElement.duration;
};

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Raycast from camera forward to detect if looking at the TV
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(screen, true);
    isLookingAtTV = intersects.length > 0;

    if (controls.isLocked && !isControlPanelVisible) {
        // Camera-relative movement
        const direction = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        right.crossVectors(direction, camera.up).normalize();

        let move = new THREE.Vector3();
        if (keys.w) move.add(direction);
        if (keys.s) move.sub(direction);
        if (keys.a) move.sub(right);
        if (keys.d) move.add(right);
        move.normalize();
        controls.getObject().position.addScaledVector(move, moveSpeed);
    }
    
    if (isSubtitlesEnabled) {
        updateSubtitles();
    }
    
    renderer.render(scene, camera);
}

animate(); 

// Add window management system
let windows = [];
let baseZIndex = 1000;

function bringWindowToFront(window) {
    const index = windows.indexOf(window);
    if (index > -1) {
        windows.splice(index, 1);
    }
    windows.push(window);
    updateWindowZIndices();
    
    // Ensure window is within viewport
    const rect = window.getBoundingClientRect();
    if (rect.left < 0) window.style.left = '0px';
    if (rect.top < 0) window.style.top = '0px';
    if (rect.right > window.innerWidth) window.style.left = (window.innerWidth - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) window.style.top = (window.innerHeight - rect.height) + 'px';
}

function updateWindowZIndices() {
    windows.forEach((window, index) => {
        window.style.zIndex = baseZIndex + index;
    });
}

// Create settings window
function createSettingsWindow() {
    const settingsWindow = document.createElement('div');
    settingsWindow.style.position = 'fixed';
    settingsWindow.style.top = '50%';
    settingsWindow.style.left = '50%';
    settingsWindow.style.transform = 'translate(-50%, -50%)';
    settingsWindow.style.background = 'rgba(51, 51, 51, 0.75)';
    settingsWindow.style.backdropFilter = 'blur(48px) saturate(2)';
    settingsWindow.style.border = '1px solid #ccc';
    settingsWindow.style.borderRadius = '12px';
    settingsWindow.style.boxShadow = 'rgb(128, 128, 128) 0px 0px 0px 1px, rgb(0, 0, 0) 0px 0px 0px 2px, rgba(0, 0, 0, 0.18) 0px 8px 32px 0px';
    settingsWindow.style.padding = '0';
    settingsWindow.style.minWidth = '420px';
    settingsWindow.style.color = '#ffffffbf';
    settingsWindow.style.display = 'none';
    settingsWindow.style.zIndex = baseZIndex;
    settingsWindow.style.fontFamily = 'system-ui, sans-serif';

    // Top bar (draggable, with close button)
    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.alignItems = 'center';
    topBar.style.marginBottom = '4px';
    topBar.style.height = '28px';
    topBar.style.justifyContent = 'center';
    topBar.style.cursor = 'move';
    topBar.innerHTML = `
      <span style="display:inline-block;position:absolute;left:0;width:12px;height:12px;background:#ff5f56;border-radius:50%;margin:8px;cursor:pointer;" id="settings-close-btn"></span>
      <span style="font-weight:600;letter-spacing:0.5px;">TV Settings</span>
    `;
    settingsWindow.appendChild(topBar);

    // Drag logic
    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
    topBar.addEventListener('mousedown', (e) => {
        if (e.target.id === 'settings-close-btn') return;
        isDragging = true;
        dragOffsetX = e.clientX - settingsWindow.getBoundingClientRect().left;
        dragOffsetY = e.clientY - settingsWindow.getBoundingClientRect().top;
        document.body.style.userSelect = 'none';
        bringWindowToFront(settingsWindow);
    });
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            settingsWindow.style.left = e.clientX - dragOffsetX + 'px';
            settingsWindow.style.top = e.clientY - dragOffsetY + 'px';
            settingsWindow.style.transform = '';
        }
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = '';
    });

    // Close button logic
    setTimeout(() => {
        const closeBtn = document.getElementById('settings-close-btn');
        if (closeBtn) closeBtn.onclick = () => { settingsWindow.style.display = 'none'; };
    }, 0);

    // Settings tabs
    const settingsTabs = document.createElement('div');
    settingsTabs.style.display = 'flex';
    settingsTabs.style.marginBottom = '12px';
    settingsTabs.style.borderBottom = '1px solid #ccc';
    
    const subtitlesTab = document.createElement('button');
    subtitlesTab.textContent = 'Subtitles';
    subtitlesTab.style.flex = '1';
    subtitlesTab.style.padding = '8px';
    subtitlesTab.style.border = 'none';
    subtitlesTab.style.background = 'none';
    subtitlesTab.style.cursor = 'pointer';
    subtitlesTab.style.borderBottom = '2px solid #007aff';
    subtitlesTab.style.color = '#007aff';
    
    const pictureTab = document.createElement('button');
    pictureTab.textContent = 'Picture';
    pictureTab.style.flex = '1';
    pictureTab.style.padding = '8px';
    pictureTab.style.border = 'none';
    pictureTab.style.background = 'none';
    pictureTab.style.cursor = 'pointer';
    pictureTab.style.color = '#666';
    
    settingsTabs.appendChild(subtitlesTab);
    settingsTabs.appendChild(pictureTab);
    settingsWindow.appendChild(settingsTabs);

    // Settings content container
    const settingsContent = document.createElement('div');
    settingsContent.style.padding = '12px';

    // Subtitles settings
    const subtitlesSettings = document.createElement('div');
    subtitlesSettings.innerHTML = `
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 8px;">Subtitle URL</label>
            <input type="text" placeholder="Enter subtitle URL (.vtt or .srt)" style="width: 100%; padding: 8px; border: none; border-radius: 6px; background: #222; color: #ffffffbf; margin-bottom: 8px;">
            <button style="width: 100%; padding: 8px; background: #007aff; color: white; border: none; border-radius: 6px; cursor: pointer;">Load Subtitles</button>
        </div>
    `;
    subtitlesSettings.style.display = 'block';

    // Picture settings
    const pictureSettings = document.createElement('div');
    pictureSettings.innerHTML = `
        <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                <button class="picture-btn" id="brightness-down" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">remove</span>
                </button>
                <button class="picture-btn" id="brightness-reset" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">wb_sunny</span>
                </button>
                <button class="picture-btn" id="brightness-up" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">add</span>
                </button>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                <button class="picture-btn" id="contrast-down" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">remove</span>
                </button>
                <button class="picture-btn" id="contrast-reset" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">contrast</span>
                </button>
                <button class="picture-btn" id="contrast-up" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">add</span>
                </button>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <button class="picture-btn" id="saturation-down" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">remove</span>
                </button>
                <button class="picture-btn" id="saturation-reset" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">opacity</span>
                </button>
                <button class="picture-btn" id="saturation-up" style="padding: 4px; height: 32px; font-size: 20px; background: none; border: none; cursor: pointer; border-radius: 4px;">
                    <span class="material-symbols-rounded">add</span>
                </button>
            </div>
        </div>
    `;
    pictureSettings.style.display = 'none';

    // Add button event listeners
    setTimeout(() => {
        // Brightness controls
        document.getElementById('brightness-down').onclick = () => {
            brightness = Math.max(0, brightness - 0.1);
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.brightness.value = brightness;
            }
            showTVOverlay('brightness', brightness);
        };

        document.getElementById('brightness-reset').onclick = () => {
            brightness = 1.0;
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.brightness.value = brightness;
            }
            showTVOverlay('brightness', brightness);
        };

        document.getElementById('brightness-up').onclick = () => {
            brightness = Math.min(2, brightness + 0.1);
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.brightness.value = brightness;
            }
            showTVOverlay('brightness', brightness);
        };

        // Contrast controls
        document.getElementById('contrast-down').onclick = () => {
            contrast = Math.max(0, contrast - 0.1);
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.contrast.value = contrast;
            }
            showTVOverlay('contrast', contrast);
        };

        document.getElementById('contrast-reset').onclick = () => {
            contrast = 1.0;
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.contrast.value = contrast;
            }
            showTVOverlay('contrast', contrast);
        };

        document.getElementById('contrast-up').onclick = () => {
            contrast = Math.min(2, contrast + 0.1);
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.contrast.value = contrast;
            }
            showTVOverlay('contrast', contrast);
        };

        // Saturation controls
        document.getElementById('saturation-down').onclick = () => {
            saturation = Math.max(0, saturation - 0.1);
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.saturation.value = saturation;
            }
            showTVOverlay('saturation', saturation);
        };

        document.getElementById('saturation-reset').onclick = () => {
            saturation = 1.0;
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.saturation.value = saturation;
            }
            showTVOverlay('saturation', saturation);
        };

        document.getElementById('saturation-up').onclick = () => {
            saturation = Math.min(2, saturation + 0.1);
            if (tvScreen && tvScreen.material.uniforms) {
                tvScreen.material.uniforms.saturation.value = saturation;
            }
            showTVOverlay('saturation', saturation);
        };

        // Add hover effects for all picture buttons
        document.querySelectorAll('.picture-btn').forEach(btn => {
            btn.onmouseover = () => btn.style.background = '#e0e0e0';
            btn.onmouseout = () => btn.style.background = 'none';
        });
    }, 0);

    settingsContent.appendChild(subtitlesSettings);
    settingsContent.appendChild(pictureSettings);
    settingsWindow.appendChild(settingsContent);

    // Tab switching logic
    function switchSettingsTab(tab) {
        if (tab === 'subtitles') {
            subtitlesTab.style.borderBottom = '2px solid #007aff';
            subtitlesTab.style.color = '#007aff';
            pictureTab.style.borderBottom = 'none';
            pictureTab.style.color = '#666';
            subtitlesSettings.style.display = 'block';
            pictureSettings.style.display = 'none';
        } else {
            pictureTab.style.borderBottom = '2px solid #007aff';
            pictureTab.style.color = '#007aff';
            subtitlesTab.style.borderBottom = 'none';
            subtitlesTab.style.color = '#666';
            subtitlesSettings.style.display = 'none';
            pictureSettings.style.display = 'block';
        }
    }

    subtitlesTab.onclick = () => switchSettingsTab('subtitles');
    pictureTab.onclick = () => switchSettingsTab('picture');

    // Add to windows array
    windows.push(settingsWindow);
    document.body.appendChild(settingsWindow);

    return settingsWindow;
}

// Create settings window instance
const settingsWindow = createSettingsWindow();

// Add click handler for settings button
settingsButton.onclick = () => {
    settingsWindow.style.display = 'block';
    bringWindowToFront(settingsWindow);
};

// Add click handler for control panel to bring it to front
controlPanel.addEventListener('mousedown', () => {
    bringWindowToFront(controlPanel);
});

// Add Material Symbols CSS for UI
if (!document.getElementById('material-symbols-style')) {
    const style = document.createElement('style');
    style.id = 'material-symbols-style';
    style.innerHTML = `
        .material-symbols-rounded {
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
    `;
    document.head.appendChild(style);
} 

// Add cleanup function
function cleanup() {
    // Clean up video resources
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.load();
        videoElement.remove();
    }
    
    // Clean up HLS
    if (hls) {
        hls.destroy();
    }
    
    // Clean up THREE.js resources
    if (videoTexture) {
        videoTexture.dispose();
    }
    if (tvScreen && tvScreen.material) {
        tvScreen.material.dispose();
    }
    if (tvOverlayTexture) {
        tvOverlayTexture.dispose();
    }
    if (playbackOverlayTexture) {
        playbackOverlayTexture.dispose();
    }
    if (subtitleOverlayTexture) {
        subtitleOverlayTexture.dispose();
    }
    
    // Remove event listeners
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('pointerlockerror', onPointerLockError);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    
    // Clean up DOM elements
    if (controlPanel) controlPanel.remove();
    if (settingsWindow) settingsWindow.remove();
    
    // Clear timeouts
    if (tvOverlayTimeout) clearTimeout(tvOverlayTimeout);
    if (playbackOverlayTimeout) clearTimeout(playbackOverlayTimeout);
}

// Add to window unload
window.addEventListener('unload', cleanup);

function showLoadingIndicator(show) {
    let indicator = document.getElementById('loading-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loading-indicator';
        indicator.style.position = 'fixed';
        indicator.style.top = '50%';
        indicator.style.left = '50%';
        indicator.style.transform = 'translate(-50%, -50%)';
        indicator.style.background = 'rgba(0,0,0,0.7)';
        indicator.style.color = 'white';
        indicator.style.padding = '20px';
        indicator.style.borderRadius = '10px';
        indicator.style.zIndex = '1000';
        document.body.appendChild(indicator);
    }
    indicator.style.display = show ? 'block' : 'none';
    if (show) {
        indicator.textContent = 'Loading...';
    }
}

// Add CSS classes for common styles
const style = document.createElement('style');
style.textContent = `
    .control-button {
        padding: 4px;
        height: 32px;
        font-size: 20px;
        background: none;
        border: none;
        cursor: pointer;
        border-radius: 4px;
    }
    .control-button:hover {
        background: #e0e0e0;
    }
    .picture-control {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 8px;
    }
`;
document.head.appendChild(style);

// Consolidate picture control logic
function createPictureControl(type, min, max, step) {
    return {
        down: () => {
            window[type] = Math.max(min, window[type] - step);
            updatePictureControl(type);
        },
        reset: () => {
            window[type] = 1.0;
            updatePictureControl(type);
        },
        up: () => {
            window[type] = Math.min(max, window[type] + step);
            updatePictureControl(type);
        }
    };
}

function updatePictureControl(type) {
    if (tvScreen && tvScreen.material.uniforms) {
        tvScreen.material.uniforms[type].value = window[type];
    }
    showTVOverlay(type, window[type]);
}
