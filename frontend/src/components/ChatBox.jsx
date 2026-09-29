import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSocket } from "../hooks/useSocket";
import { addMessage } from "../store/slices/activeRideSlice";

export function ChatBox() {
  const socket = useSocket();
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);

  const role = useSelector((s) => s.user.profile?.role);
  const messages = useSelector((s) => s.activeRide.messages || []);
  const ride = useSelector((s) => s.activeRide.ride);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Only show chat if ride is ACCEPTED, ARRIVING, or ONGOING
  const isActive = ride && ["ACCEPTED", "ARRIVING", "ONGOING"].includes(ride.status);
  if (!isActive) return null;

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !socket) return;

    // Emit to server
    socket.emit("chat_message", { text });

    // Optimistically add to local state
    dispatch(addMessage({
      sender: role,
      text: text.trim(),
      timestamp: new Date().toISOString()
    }));

    setText("");
  }

  return (
    <div className={`chat-widget ${isOpen ? "open" : "collapsed"}`}>
      <div className="chat-header" onClick={() => setIsOpen(!isOpen)}>
        <span>💬 Message {role === "rider" ? "Driver" : "Rider"}</span>
        <span>{isOpen ? "▼" : "▲"}</span>
      </div>

      {isOpen && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "20px" }}>
                Send a message to coordinate pickup...
              </p>
            ) : (
              messages.map((msg, i) => {
                const isMine = msg.sender === role;
                return (
                  <div key={i} className={`chat-msg ${isMine ? "mine" : "theirs"}`}>
                    {msg.text}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              autoFocus
            />
            <button type="submit" disabled={!text.trim()}>
              ➤
            </button>
          </form>
        </>
      )}
    </div>
  );
}
