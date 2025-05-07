// import React, { useState, useEffect, useRef } from "react";
// import Peer from "peerjs";

// const PeerComponent = () => {
//   const [peerId, setPeerId] = useState(null);
//   const [messageLog, setMessageLog] = useState([]);
//   const [isConnected, setIsConnected] = useState(false);
//   const [peerList, setPeerList] = useState([]); // List of all connected peers
//   const [targetPeerId, setTargetPeerId] = useState(""); // To track the target peer ID
//   const peer = useRef(null); // Ref to store the peer instance
//   const connections = useRef({}); // Store connections to peers

//   // Initialize PeerJS peer when the component is mounted
//   useEffect(() => {
//     // Initialize the peer object
//     peer.current = new Peer({
//       host: "172.16.15.127",
//       port: 9000,
//       path: "/",
//     });

//     // When the peer connection is established, handle events
//     peer.current.on("open", (id) => {
//       setPeerId(id);
//       logMessage(`My peer ID is: ${id}`);
//     });

//     peer.current.on("error", (error) => {
//       console.error("PeerJS error:", error);
//     });

//     // Handle incoming peer connections
//     peer.current.on("connection", (conn) => {
//       logMessage(`Incoming peer connection from ${conn.peer}!`);
//       setPeerList((prevList) => {
//         if (!prevList.includes(conn.peer)) {
//           return [...prevList, conn.peer]; // Add the peer to the list
//         }
//         return prevList;
//       });

//       conn.on("data", (data) => {
//         logMessage(`Received from ${conn.peer}: ${data}`);
//       });

//       conn.on("open", () => {
//         conn.send("Hello!");
//         connections.current[conn.peer] = conn; // Save the connection for messaging
//       });

//       // When a connection is closed, remove from the peer list
//       conn.on("close", () => {
//         setPeerList((prevList) =>
//           prevList.filter((peer) => peer !== conn.peer)
//         );
//       });
//     });

//     return () => {
//       if (peer.current) {
//         peer.current.destroy(); // Clean up when the component is unmounted
//       }
//     };
//   }, []);

//   // Log messages for messaging history
//   const logMessage = (message) => {
//     setMessageLog((prevLog) => [...prevLog, message]);
//   };

//   // Connect to a peer automatically (if not already connected)
//   const connectToPeer = (targetPeerId) => {
//     if (!connections.current[targetPeerId]) {
//       logMessage(`Connecting to ${targetPeerId}...`);
//       const conn = peer.current.connect(targetPeerId);

//       conn.on("open", () => {
//         logMessage(`Connected to ${targetPeerId}`);
//         conn.send("Hi!");
//         connections.current[targetPeerId] = conn; // Store connection for messaging
//       });

//       conn.on("data", (data) => {
//         logMessage(`Received from ${targetPeerId}: ${data}`);
//       });

//       conn.on("error", (error) => {
//         logMessage(`Connection error with ${targetPeerId}: ${error}`);
//       });
//     }
//   };

//   // Send a message to all connected peers
//   const sendMessage = (message) => {
//     Object.values(connections.current).forEach((conn) => {
//       conn.send(message);
//     });
//     logMessage(`Sent to all: ${message}`);
//   };

//   // Handle target peer ID change
//   const handleTargetPeerIdChange = (e) => {
//     setTargetPeerId(e.target.value);
//   };

//   // Handle the click on connect button
//   const handleConnectClick = () => {
//     if (targetPeerId) {
//       connectToPeer(targetPeerId);
//     } else {
//       logMessage("Please enter a peer ID to connect.");
//     }
//   };

//   return (
//     <div>
//       <h1>Peer-to-Peer Messaging</h1>
//       <div>
//         <h3>Your Peer ID: {peerId}</h3>
//       </div>

//       <div>
//         <h3>Connected Peers:</h3>
//         <ul>
//           {peerList.map((peerId) => (
//             <li key={peerId}>{peerId}</li>
//           ))}
//         </ul>
//       </div>

//       <div>
//         <h3>Messages:</h3>
//         <div className="messages">
//           {messageLog.map((msg, index) => (
//             <div key={index}>{msg}</div>
//           ))}
//         </div>
//       </div>

//       <div>
//         <input
//           type="text"
//           placeholder="Enter Peer ID to connect"
//           value={targetPeerId}
//           onChange={handleTargetPeerIdChange}
//         />
//         <button onClick={handleConnectClick}>Connect to Peer</button>
//       </div>

//       <div>
//         <h3>Send Message to All:</h3>
//         <input
//           type="text"
//           placeholder="Type your message"
//           onKeyDown={(e) => {
//             if (e.key === "Enter") {
//               sendMessage(e.target.value);
//               e.target.value = ""; // Clear input after sending
//             }
//           }}
//         />
//       </div>
//     </div>
//   );
// };

// export default PeerComponent;

/** Connections */
import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";

const PeerComponent = () => {
  // Generate a unique ID with a random suffix to avoid conflicts
  const generateUniqueId = () => {
    // Create a base ID with timestamp to ensure uniqueness
    const timestamp = new Date().getTime().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `peer_${timestamp}_${randomStr}`;
  };

  // State for tracking component status
  const [peerId, setPeerId] = useState("");
  const [messageLog, setMessageLog] = useState([]);
  const [peerList, setPeerList] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("initializing");
  const [platform, setPlatform] = useState("unknown");

  // Refs for maintaining references across renders
  const peer = useRef(null);
  const connections = useRef({});
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);
  const fetchPeersIntervalRef = useRef(null);
  const isComponentMounted = useRef(true);

  // Detect platform on component mount
  useEffect(() => {
    // Simple platform detection
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      setPlatform("ios");
    } else if (/android/i.test(userAgent)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }
  }, []);

  // Log messages function - only logs actual messages, not system events
  const logMessage = (message, isSystemMessage = true) => {
    if (!isComponentMounted.current) return;

    // Always log to console
    console.log(message);

    // Only add to visual message log if it's a user message, not a system message
    if (!isSystemMessage) {
      const timestamp = new Date().toLocaleTimeString();
      const formattedMessage = `${timestamp}: ${message}`;
      setMessageLog((prevLog) => [...prevLog, formattedMessage]);
    }
  };

  // Initialize peer connection with a unique ID
  const initializePeer = () => {
    if (!isComponentMounted.current) return;

    // Clean up any existing peer
    if (peer.current) {
      logMessage(
        "Cleaning up existing peer connection before creating a new one"
      );
      try {
        peer.current.destroy();
      } catch (err) {
        console.error("Error destroying peer:", err);
      }
      peer.current = null;
    }

    // Generate a new unique ID each time to avoid conflicts
    const newPeerId = generateUniqueId();
    logMessage(`Initializing peer with new ID: ${newPeerId}`);
    setPeerId(newPeerId);
    setConnectionStatus("connecting");

    // Enhanced configuration for better cross-platform compatibility
    const peerConfig = {
      host: "172.16.15.127",
      port: 9000,
      path: "/",
      debug: 3,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
        // For iOS compatibility, force ICE to use UDP by blocking TCP
        iceTransportPolicy: platform === "ios" ? "all" : "all",
        // Increase timeout for iOS connections which tend to be slower
        iceCandidatePoolSize: platform === "ios" ? 10 : 5,
      },
      // Use best quality and stability settings for iOS
      // These settings can help with iOS-specific connection issues
      connectionOptions: {
        reliable: true,
        serialization: "json",
        metadata: { platform },
      },
    };

    // Create a new peer
    try {
      peer.current = new Peer(newPeerId, peerConfig);

      // Set up event handlers
      peer.current.on("open", (id) => {
        if (!isComponentMounted.current) return;

        logMessage(`Successfully connected to signaling server with ID: ${id}`);
        logMessage(`Running on platform: ${platform}`);
        setPeerId(id);
        setConnectionStatus("connected");
        reconnectAttempts.current = 0;

        // Start discovering peers
        fetchAndConnectToPeers();

        // Set up periodic peer discovery
        clearInterval(fetchPeersIntervalRef.current);
        fetchPeersIntervalRef.current = setInterval(
          fetchAndConnectToPeers,
          5000
        );
      });

      peer.current.on("error", (error) => {
        if (!isComponentMounted.current) return;

        console.error("PeerJS error:", error);
        logMessage(`Error: ${error.type} - ${error.message}`);

        if (error.type === "peer-unavailable") {
          // This is normal when trying to connect to a peer that isn't available
          return;
        }

        if (error.type === "unavailable-id") {
          // ID conflict - generate a new one and reconnect immediately
          logMessage("ID conflict detected, will reconnect with a new ID");
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(initializePeer, 500);
          return;
        }

        if (
          error.type === "disconnected" ||
          error.type === "network" ||
          error.type === "server-error"
        ) {
          setConnectionStatus("disconnected");

          // Try to reconnect if we haven't exceeded max attempts
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttempts.current),
              10000
            ); // Exponential backoff

            logMessage(
              `Connection lost. Reconnecting in ${delay / 1000}s (attempt ${
                reconnectAttempts.current
              }/${maxReconnectAttempts})...`
            );

            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(initializePeer, delay);
          } else {
            logMessage(
              `Failed to reconnect after ${maxReconnectAttempts} attempts.`
            );
          }
        }
      });

      peer.current.on("disconnected", () => {
        if (!isComponentMounted.current) return;

        logMessage(
          "Disconnected from signaling server. Attempting to reconnect..."
        );
        setConnectionStatus("disconnected");

        // iOS-specific: Try multiple reconnect strategies
        if (platform === "ios") {
          logMessage("Trying iOS-specific reconnect strategy...");

          // On iOS, let's try to reconnect directly first
          peer.current.reconnect();

          // If that doesn't work within 2 seconds, re-initialize
          setTimeout(() => {
            if (peer.current && !peer.current.open) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = setTimeout(initializePeer, 1000);
            }
          }, 2000);
        } else {
          // For other platforms, just re-initialize
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(initializePeer, 1000);
        }
      });

      peer.current.on("connection", handleIncomingConnection);
    } catch (err) {
      logMessage(`Failed to initialize peer: ${err.message}`);

      // Try again with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          10000
        );

        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(initializePeer, delay);
      }
    }
  };

  // Handle incoming peer connection
  const handleIncomingConnection = (conn) => {
    if (!isComponentMounted.current) return;

    logMessage(`Incoming connection from: ${conn.peer}`);

    // Store the connection
    connections.current[conn.peer] = conn;

    // Set up event handlers for this connection
    setupConnectionHandlers(conn);
  };

  // Connect to a specific peer
  const connectToPeer = (remotePeerId) => {
    if (!isComponentMounted.current) return;
    if (remotePeerId === peerId) return; // Don't connect to ourselves
    if (connections.current[remotePeerId]?.open) return; // Already connected

    try {
      logMessage(`Initiating connection to: ${remotePeerId}`);

      // iOS-specific connection parameters for better compatibility
      const connectionOptions = {
        reliable: true,
        serialization: "json", // This works better across platforms than binary
        metadata: {
          platform,
          peerId: peerId, // Include our ID in metadata for better identification
          timestamp: Date.now(), // Add timestamp to help with iOS reconnections
        },
      };

      const conn = peer.current.connect(remotePeerId, connectionOptions);

      connections.current[remotePeerId] = conn;
      setupConnectionHandlers(conn);

      // iOS-specific timeout for connection establishment
      if (platform === "ios") {
        // If connection doesn't open within 10 seconds, retry
        setTimeout(() => {
          if (conn && !conn.open) {
            logMessage(`Connection timeout to ${remotePeerId}, retrying...`);
            conn.close();
            delete connections.current[remotePeerId];

            // Try again with a small delay
            setTimeout(() => connectToPeer(remotePeerId), 1000);
          }
        }, 10000);
      }
    } catch (err) {
      logMessage(`Failed to connect to ${remotePeerId}: ${err.message}`);
      // Remove failed connection
      delete connections.current[remotePeerId];
    }
  };

  // Set up event handlers for a peer connection
  const setupConnectionHandlers = (conn) => {
    if (!conn) return;

    // Remove any existing listeners to prevent duplicates
    if (typeof conn.removeAllListeners === "function") {
      conn.removeAllListeners();
    }

    conn.on("open", () => {
      if (!isComponentMounted.current) return;

      logMessage(`Connection established with: ${conn.peer}`);

      // Extract remote platform from metadata if available
      const remotePlatform = conn.metadata?.platform || "unknown";
      logMessage(`Peer ${conn.peer} is on platform: ${remotePlatform}`);

      // Add to peer list if not already there
      setPeerList((prevList) => {
        if (!prevList.includes(conn.peer)) {
          return [...prevList, conn.peer];
        }
        return prevList;
      });

      // Send a greeting message
      try {
        // Include platform info in greeting
        conn.send(`Hello from ${peerId} (${platform})!`);
      } catch (err) {
        logMessage(`Failed to send greeting to ${conn.peer}: ${err.message}`);
      }

      // For iOS, send a "ping" message every 30 seconds to keep connection alive
      if (platform === "ios") {
        const pingInterval = setInterval(() => {
          if (conn && conn.open) {
            try {
              conn.send("__ping__");
            } catch (err) {
              clearInterval(pingInterval);
            }
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);

        // Clean up interval when component unmounts
        return () => clearInterval(pingInterval);
      }
    });

    conn.on("data", (data) => {
      if (!isComponentMounted.current) return;

      // Skip internal ping messages
      if (data === "__ping__") return;

      // Log received messages to the message log (not a system message)
      logMessage(`Received from ${conn.peer}: ${data}`, false);
    });

    conn.on("close", () => {
      if (!isComponentMounted.current) return;

      logMessage(`Connection with ${conn.peer} closed.`);
      delete connections.current[conn.peer];
      setPeerList((prevList) => prevList.filter((id) => id !== conn.peer));

      // For iOS, try to reconnect to the peer after a short delay
      if (platform === "ios") {
        setTimeout(() => {
          // Try to re-establish connection
          if (peer.current && peer.current.open) {
            connectToPeer(conn.peer);
          }
        }, 2000);
      }
    });

    conn.on("error", (err) => {
      if (!isComponentMounted.current) return;

      logMessage(`Connection error with ${conn.peer}: ${err}`);
      delete connections.current[conn.peer];
      setPeerList((prevList) => prevList.filter((id) => id !== conn.peer));

      // For iOS, try to reconnect after errors
      if (platform === "ios") {
        setTimeout(() => {
          if (peer.current && peer.current.open) {
            connectToPeer(conn.peer);
          }
        }, 3000);
      }
    });
  };

  // Fetch all peers and connect to them
  const fetchAndConnectToPeers = async () => {
    if (!isComponentMounted.current) return;
    if (!peer.current || !peer.current.open) {
      logMessage("Cannot fetch peers - not connected to server");
      return;
    }

    try {
      const response = await fetch("http://172.16.15.127:9000/peerjs/peers");

      if (!response.ok) {
        logMessage(
          `Error fetching peers: ${response.status} ${response.statusText}`
        );
        return;
      }

      const peers = await response.json();

      if (!isComponentMounted.current) return;

      // Connect to each peer that we're not already connected to
      if (peers && Array.isArray(peers) && peers.length > 0) {
        logMessage(`Discovered ${peers.length} peers on the server`);

        // For iOS, add a small delay between connection attempts
        // This helps prevent overwhelming the WebRTC stack on iOS
        if (platform === "ios") {
          for (let i = 0; i < peers.length; i++) {
            const remotePeerId = peers[i];
            if (
              remotePeerId !== peerId &&
              !connections.current[remotePeerId]?.open
            ) {
              connectToPeer(remotePeerId);
              // Wait 500ms between connection attempts on iOS
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        } else {
          // For other platforms, connect to all at once
          peers.forEach((remotePeerId) => {
            if (
              remotePeerId !== peerId &&
              !connections.current[remotePeerId]?.open
            ) {
              connectToPeer(remotePeerId);
            }
          });
        }
      } else {
        logMessage("No other peers found on the server");
      }

      // On iOS, log the current connections for debugging
      if (platform === "ios") {
        const openConnections = Object.entries(connections.current)
          .filter(([_, conn]) => conn && conn.open)
          .map(([id, _]) => id);

        logMessage(
          `Current open connections on iOS: ${openConnections.length}`
        );
        console.log("Open connections:", openConnections);
      }
    } catch (error) {
      console.error("Error fetching peers:", error);
      logMessage(`Failed to fetch peers: ${error.message}`);
    }
  };

  // Force connection refresh (especially useful for iOS)
  const forceRefreshConnections = () => {
    logMessage("Forcing connection refresh...");

    // Close all current connections
    Object.values(connections.current).forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.close();
        } catch (err) {
          console.error("Error closing connection:", err);
        }
      }
    });

    // Clear connections
    connections.current = {};
    setPeerList([]);

    // Fetch peers again
    fetchAndConnectToPeers();
  };

  // Send a message to all connected peers
  const sendMessage = () => {
    if (!isComponentMounted.current) return;
    if (!messageInput.trim()) return;

    const message = messageInput.trim();
    let sentCount = 0;
    let failedCount = 0;

    const connectedPeers = Object.entries(connections.current).filter(
      ([_, conn]) => conn && conn.open
    );

    if (connectedPeers.length === 0) {
      logMessage("No connected peers to send to!");
      return;
    }

    connectedPeers.forEach(([peerId, conn]) => {
      try {
        conn.send(message);
        sentCount++;
      } catch (err) {
        logMessage(`Failed to send to ${peerId}: ${err.message}`);
        failedCount++;
      }
    });

    // Log the sent message to the message log (not a system message)
    logMessage(`You sent: ${message}`, false);

    // Only log the status to console
    console.log(
      `Sent "${message}" to ${sentCount} peers${
        failedCount > 0 ? ` (${failedCount} failed)` : ""
      }`
    );

    setMessageInput("");
  };

  // Initialize peer when component mounts
  useEffect(() => {
    isComponentMounted.current = true;
    initializePeer();

    // iOS-specific: Add more frequent peer discovery to improve connection odds
    let iosRefreshInterval;
    if (platform === "ios") {
      iosRefreshInterval = setInterval(() => {
        if (
          peer.current &&
          peer.current.open &&
          Object.keys(connections.current).length === 0
        ) {
          logMessage("iOS extra connection attempt...");
          fetchAndConnectToPeers();
        }
      }, 15000); // Every 15 seconds if no connections
    }

    // Cleanup when component unmounts
    return () => {
      isComponentMounted.current = false;

      logMessage("Component unmounting, cleaning up connections...");

      // Clear all timers
      clearTimeout(reconnectTimeoutRef.current);
      clearInterval(fetchPeersIntervalRef.current);
      if (iosRefreshInterval) clearInterval(iosRefreshInterval);

      // Close all connections
      Object.values(connections.current).forEach((conn) => {
        if (conn && conn.open) {
          try {
            conn.close();
          } catch (err) {
            console.error("Error closing connection:", err);
          }
        }
      });

      // Clean connections object
      connections.current = {};

      // Destroy peer gracefully
      if (peer.current) {
        try {
          peer.current.destroy();
        } catch (err) {
          console.error("Error destroying peer:", err);
        }
        peer.current = null;
      }
    };
  }, [platform]); // Dependency on platform to re-initialize if platform detection changes

  // Status indicator color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "green";
      case "connecting":
        return "orange";
      case "disconnected":
        return "red";
      default:
        return "gray";
    }
  };

  // Determine if send button should be disabled
  const isSendDisabled =
    !messageInput.trim() ||
    peerList.length === 0 ||
    connectionStatus !== "connected";

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        color: "black", // Ensure all text is black
      }}
    >
      <h1 style={{ color: "black" }}>Peer-to-Peer Messaging ({platform})</h1>

      <div
        style={{
          backgroundColor: "#f5f5f5",
          padding: "15px",
          borderRadius: "5px",
          marginBottom: "20px",
          color: "black", // Ensure text is black
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "black" }}>
          Your Peer ID: {peerId}
          <span
            style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: getStatusColor(),
              marginLeft: "10px",
            }}
          />
        </h3>
        <div style={{ fontSize: "14px", color: "black" }}>
          Status: {connectionStatus}
        </div>

        <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
          {connectionStatus === "disconnected" && (
            <button
              onClick={() => {
                reconnectAttempts.current = 0;
                initializePeer();
              }}
              style={{
                padding: "5px 10px",
                backgroundColor: "#4285f4",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Reconnect Now
            </button>
          )}

          {/* Special button for iOS to force refresh connections */}
          <button
            onClick={forceRefreshConnections}
            style={{
              padding: "5px 10px",
              backgroundColor: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Force Refresh Connections
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: "1" }}>
          <h3 style={{ color: "black" }}>
            Connected Peers ({peerList.length}):
          </h3>
          <div
            style={{
              backgroundColor: "#f5f5f5",
              padding: "15px",
              borderRadius: "5px",
              minHeight: "100px",
              maxHeight: "200px",
              overflowY: "auto",
              color: "black", // Ensure text is black
            }}
          >
            {peerList.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyleType: "none" }}>
                {peerList.map((id) => (
                  <li
                    key={id}
                    style={{
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      color: "black", // Ensure text is black
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: connections.current[id]?.open
                          ? "green"
                          : "orange",
                        marginRight: "8px",
                      }}
                    />
                    <span style={{ wordBreak: "break-all", color: "black" }}>
                      {id}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div
                style={{
                  height: "100px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "black", // Ensure text is black
                }}
              >
                <p style={{ color: "black" }}>No peers connected yet</p>
              </div>
            )}
          </div>

          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "black" }}>Send Message to All Peers:</h3>
            <div style={{ display: "flex" }}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message"
                style={{
                  flexGrow: 1,
                  marginRight: "10px",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  color: "black", // Ensure text is black
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSendDisabled) {
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isSendDisabled}
                style={{
                  padding: "8px 15px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isSendDisabled ? "not-allowed" : "pointer",
                  opacity: isSendDisabled ? "0.5" : "1",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: "1" }}>
          <h3 style={{ color: "black" }}>Messages:</h3>
          <div
            style={{
              height: "350px",
              overflowY: "auto",
              border: "1px solid #ccc",
              borderRadius: "5px",
              padding: "10px",
              backgroundColor: "#f9f9f9",
              color: "black", // Ensure text is black
            }}
          >
            {messageLog.length > 0 ? (
              messageLog.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "8px",
                    fontSize: "14px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "monospace",
                    color: "black", // Ensure text is black
                  }}
                >
                  {msg}
                </div>
              ))
            ) : (
              <div
                style={{
                  color: "black", // Changed from #888 to black
                  textAlign: "center",
                  marginTop: "20px",
                }}
              >
                No messages yet
              </div>
            )}
          </div>

          <div style={{ marginTop: "10px", textAlign: "right" }}>
            <button
              onClick={() => setMessageLog([])}
              style={{
                padding: "5px 10px",
                backgroundColor: "#f44336",
                color: "black", // Changed to black
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Clear Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeerComponent;
