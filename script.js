// === 1. INITIALIZE GLOBE.GL ===
const globeContainer = document.getElementById('globeViz');
const world = Globe()
  (globeContainer)
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
  .pointOfView({ lat: 20, lng: 0, altitude: 2.5 });

// Auto-rotate by default, will disable when hand is detected
world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 1.0;
world.controls().enableZoom = true;

const statusOverlay = document.getElementById('statusText');
const statusContainer = document.getElementById('statusContainer');

// State for gesture control
let currentLat = 20;
let currentLng = 0;
let currentAltitude = 2.5;

// === 2. CONNECT TO PYTHON BACKEND VIA WEBSOCKETS ===
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:8765');

  ws.onopen = () => {
    console.log("Connected to Python backend!");
    statusOverlay.innerText = "Connected to Tracking Backend";
    statusOverlay.style.color = "#00FF00";
    
    // Hide status container after a few seconds
    setTimeout(() => {
      statusContainer.style.display = 'none';
    }, 2000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.hand_detected) {
      // Hand is visible, pause auto-rotation
      world.controls().autoRotate = false;
      
      // === GESTURE LOGIC ===
      
      // 1. Pan/Rotate based on palm position
      const deadzoneX = 0.15;
      const deadzoneY = 0.15;
      
      const dx = (0.5 - data.x); 
      const dy = (data.y - 0.5);

      if (Math.abs(dx) > deadzoneX) {
        currentLng += dx * 2.0; 
      }
      if (Math.abs(dy) > deadzoneY) {
        currentLat += dy * 2.0;
        if (currentLat > 85) currentLat = 85;
        if (currentLat < -85) currentLat = -85;
      }

      // 2. Zoom based on Pinch distance
      const pinchDistance = data.pinch_distance;

      // If pinched (distance < 0.05), zoom OUT
      // If open (distance > 0.15), zoom IN
      if (pinchDistance < 0.05) {
        currentAltitude += 0.05; // Zoom out
      } else if (pinchDistance > 0.15) {
        currentAltitude -= 0.05; // Zoom in
      }

      // Clamp altitude
      if (currentAltitude < 1.1) currentAltitude = 1.1;
      if (currentAltitude > 5.0) currentAltitude = 5.0;

      // Apply new point of view
      world.pointOfView({ lat: currentLat, lng: currentLng, altitude: currentAltitude }, 0);
      
    } else {
      // No hand detected, resume auto-rotate
      world.controls().autoRotate = true;
      
      // Sync current values back from the globe so it doesn't snap
      const pov = world.pointOfView();
      currentLat = pov.lat;
      currentLng = pov.lng;
      currentAltitude = pov.altitude;
    }
  };

  ws.onclose = () => {
    console.log("Disconnected from backend. Reconnecting...");
    statusContainer.style.display = 'flex';
    statusOverlay.innerText = "Disconnected. Reconnecting...";
    statusOverlay.style.color = "#FF5555";
    setTimeout(connectWebSocket, 1000);
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

// Start connection
connectWebSocket();

// Handle window resize
window.addEventListener('resize', () => {
  world.width(window.innerWidth);
  world.height(window.innerHeight);
});
