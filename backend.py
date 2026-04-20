import cv2
import mediapipe as mp
import asyncio
import websockets
import json
import threading
import math

# Global state for gestures
gesture_state = {
    "hand_detected": False,
    "x": 0.5,
    "y": 0.5,
    "pinch_distance": 0.1
}

# Websocket handler
async def broadcast_gestures(websocket):
    print("Client connected!")
    while True:
        try:
            await websocket.send(json.dumps(gesture_state))
            await asyncio.sleep(0.033) # Broadcast at ~30 FPS
        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected.")
            break

async def ws_server():
    print("Starting WebSocket Server on ws://localhost:8765")
    async with websockets.serve(broadcast_gestures, "localhost", 8765):
        await asyncio.Future()  # run forever

def start_ws_server():
    asyncio.run(ws_server())

# Start WebSocket server in a background thread
threading.Thread(target=start_ws_server, daemon=True).start()

# MediaPipe setup
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Try opening camera with default backend
print("Starting Camera...")
cap = cv2.VideoCapture(0)

# On Windows, sometimes DirectShow (CAP_DSHOW) works better if default fails
if not cap.isOpened() or not cap.read()[0]:
    print("Warning: Camera 0 failed. Trying DirectShow (Windows specific)...")
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened() or not cap.read()[0]:
    print("Warning: Camera 0 with DirectShow failed. Trying Camera index 1...")
    cap = cv2.VideoCapture(1)

if not cap.isOpened() or not cap.read()[0]:
    print("ERROR: Could not connect to any camera! Please check if another app is using it.")

while cap.isOpened():
    success, image = cap.read()
    if not success:
        continue
    
    # Flip the image horizontally for a natural mirror effect
    image = cv2.flip(image, 1)
    
    # Process the image and find hands
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = hands.process(image_rgb)
    
    if results.multi_hand_landmarks:
        hand_landmarks = results.multi_hand_landmarks[0]
        mp_drawing.draw_landmarks(image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
        
        # Get Palm (Landmark 9) X and Y
        palm = hand_landmarks.landmark[9]
        
        # Get Thumb (4) and Index (8) for pinch distance
        thumb = hand_landmarks.landmark[4]
        index = hand_landmarks.landmark[8]
        
        distance = math.sqrt((thumb.x - index.x)**2 + (thumb.y - index.y)**2)
        
        gesture_state["hand_detected"] = True
        gesture_state["x"] = palm.x
        gesture_state["y"] = palm.y
        gesture_state["pinch_distance"] = distance
    else:
        gesture_state["hand_detected"] = False
    
    # Display the debug window
    cv2.imshow('Hand Tracking (Press ESC to close)', image)
    
    # Press 'ESC' to exit
    if cv2.waitKey(5) & 0xFF == 27:
        break

print("Shutting down...")
cap.release()
cv2.destroyAllWindows()
