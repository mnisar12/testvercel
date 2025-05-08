import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";

const PeerComponent = () => {
  // Generate a unique ID with a random suffix to avoid conflicts
  const generateUniqueId = () => {
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
  const connectionIntervals = useRef({}); // Track intervals per connection
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

    // Always log to console for debugging
    console.log(message);

    // Only add to visual message log if it's a user message, not a system message
    // For user messages, we only show the raw content without timestamp or peer IDs
    if (!isSystemMessage) {
      setMessageLog((prevLog) => [...prevLog, message]);
    }
  };

  // Initialize peer connection with a unique ID
  const initializePeer = () => {
    if (!isComponentMounted.current) return;

    // Clean up any existing peer
    if (peer.current) {
      console.log(
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
    console.log(`Initializing peer with new ID: ${newPeerId}`);
    setPeerId(newPeerId);
    setConnectionStatus("connecting");

    // Enhanced configuration for better cross-platform compatibility
    const peerConfig = {
      host: "multiplayer.tenant-7654b5-asrpods.ord1.ingress.coreweave.cloud",
      path: "/",
      secure: true,
      debug: 1, // Reduced debug level to minimize console output
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
        iceTransportPolicy: "all",
        iceCandidatePoolSize: platform === "ios" ? 10 : 5,
      },
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

        console.log(
          `Successfully connected to signaling server with ID: ${id}`
        );
        console.log(`Running on platform: ${platform}`);
        setPeerId(id);
        setConnectionStatus("connected");
        reconnectAttempts.current = 0;

        // Start discovering peers - but only once
        fetchAndConnectToPeers();

        // Set up periodic peer discovery - less frequent polling
        clearInterval(fetchPeersIntervalRef.current);
        fetchPeersIntervalRef.current = setInterval(
          fetchAndConnectToPeers,
          15000 // Increased to 15 seconds to reduce connection attempts
        );
      });

      peer.current.on("error", (error) => {
        if (!isComponentMounted.current) return;

        console.error("PeerJS error:", error);

        if (error.type === "peer-unavailable") {
          // This is normal when trying to connect to a peer that isn't available
          return;
        }

        if (error.type === "unavailable-id") {
          // ID conflict - generate a new one and reconnect after a delay
          console.log("ID conflict detected, will reconnect with a new ID");
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(initializePeer, 1000);
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

            console.log(
              `Connection lost. Reconnecting in ${delay / 1000}s (attempt ${
                reconnectAttempts.current
              }/${maxReconnectAttempts})...`
            );

            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(initializePeer, delay);
          } else {
            console.log(
              `Failed to reconnect after ${maxReconnectAttempts} attempts.`
            );
          }
        }
      });

      peer.current.on("disconnected", () => {
        if (!isComponentMounted.current) return;

        console.log(
          "Disconnected from signaling server. Attempting to reconnect..."
        );
        setConnectionStatus("disconnected");

        // Try to reconnect directly first
        peer.current.reconnect();

        // If that doesn't work within 3 seconds, re-initialize
        setTimeout(() => {
          if (peer.current && !peer.current.open) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(initializePeer, 3000);
          }
        }, 3000);
      });

      peer.current.on("connection", handleIncomingConnection);
    } catch (err) {
      console.log(`Failed to initialize peer: ${err.message}`);

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

    console.log(`Incoming connection from: ${conn.peer}`);

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

    // Don't spam connection attempts
    const lastAttempt = connections.current[remotePeerId]?.lastAttempt || 0;
    const now = Date.now();
    if (now - lastAttempt < 10000) {
      // Prevent reconnecting within 10 seconds
      return;
    }

    try {
      console.log(`Initiating connection to: ${remotePeerId}`);

      // Track when we last attempted this connection
      if (!connections.current[remotePeerId]) {
        connections.current[remotePeerId] = { lastAttempt: now };
      } else {
        connections.current[remotePeerId].lastAttempt = now;
      }

      // Connection options
      const connectionOptions = {
        reliable: true,
        serialization: "json",
        metadata: {
          platform,
          peerId: peerId,
          timestamp: Date.now(),
        },
      };

      const conn = peer.current.connect(remotePeerId, connectionOptions);
      connections.current[remotePeerId] = conn;
      connections.current[remotePeerId].lastAttempt = now;

      setupConnectionHandlers(conn);

      // Add a timeout for connection establishment
      setTimeout(() => {
        if (conn && !conn.open) {
          console.log(`Connection timeout to ${remotePeerId}`);
          try {
            conn.close();
          } catch (err) {}

          // Only keep record of the last attempt
          connections.current[remotePeerId] = {
            lastAttempt: Date.now(),
          };
        }
      }, 10000);
    } catch (err) {
      console.log(`Failed to connect to ${remotePeerId}: ${err.message}`);
      // Keep track of failed attempt
      connections.current[remotePeerId] = {
        lastAttempt: Date.now(),
      };
    }
  };

  // Set up event handlers for a peer connection
  const setupConnectionHandlers = (conn) => {
    if (!conn) return;

    // Remove any existing listeners to prevent duplicates
    try {
      conn.removeAllListeners?.();
    } catch (err) {}

    // Clear any existing interval for this connection
    if (connectionIntervals.current[conn.peer]) {
      clearInterval(connectionIntervals.current[conn.peer]);
      delete connectionIntervals.current[conn.peer];
    }

    conn.on("open", () => {
      if (!isComponentMounted.current) return;

      console.log(`Connection established with: ${conn.peer}`);

      // Extract remote platform from metadata if available
      const remotePlatform = conn.metadata?.platform || "unknown";
      console.log(`Peer ${conn.peer} is on platform: ${remotePlatform}`);

      // Add to peer list if not already there
      setPeerList((prevList) => {
        if (!prevList.includes(conn.peer)) {
          return [...prevList, conn.peer];
        }
        return prevList;
      });

      // Send a greeting message
      try {
        conn.send(`Hello from ${platform}`);
      } catch (err) {
        console.log(`Failed to send greeting to ${conn.peer}: ${err.message}`);
      }

      // For iOS or Android, send a "ping" message every 30 seconds to keep connection alive
      if (platform === "ios" || platform === "android") {
        connectionIntervals.current[conn.peer] = setInterval(() => {
          if (conn && conn.open) {
            try {
              conn.send("__ping__");
            } catch (err) {
              clearInterval(connectionIntervals.current[conn.peer]);
              delete connectionIntervals.current[conn.peer];
            }
          } else {
            clearInterval(connectionIntervals.current[conn.peer]);
            delete connectionIntervals.current[conn.peer];
          }
        }, 30000);
      }
    });

    conn.on("data", (data) => {
      if (!isComponentMounted.current) return;

      // Skip internal ping messages
      if (data === "__ping__") return;

      // Get the platform from connection metadata
      const remotePlatform = conn.metadata?.platform || "unknown";

      // Format the message to ONLY show content and platform - no timestamps or peer IDs
      if (typeof data === "string") {
        // Log received messages to the message log (not a system message)
        logMessage(`${data}`, false);
      }
    });

    conn.on("close", () => {
      if (!isComponentMounted.current) return;

      console.log(`Connection with ${conn.peer} closed.`);

      // Clear any interval for this connection
      if (connectionIntervals.current[conn.peer]) {
        clearInterval(connectionIntervals.current[conn.peer]);
        delete connectionIntervals.current[conn.peer];
      }

      // Keep the last attempt record but mark connection as closed
      connections.current[conn.peer] = {
        lastAttempt: Date.now(),
        closed: true,
      };

      // Update the peer list
      setPeerList((prevList) => prevList.filter((id) => id !== conn.peer));
    });

    conn.on("error", (err) => {
      if (!isComponentMounted.current) return;

      console.log(`Connection error with ${conn.peer}: ${err}`);

      // Clear any interval for this connection
      if (connectionIntervals.current[conn.peer]) {
        clearInterval(connectionIntervals.current[conn.peer]);
        delete connectionIntervals.current[conn.peer];
      }

      // Keep the last attempt record but mark connection as errored
      connections.current[conn.peer] = {
        lastAttempt: Date.now(),
        error: true,
      };

      // Update the peer list
      setPeerList((prevList) => prevList.filter((id) => id !== conn.peer));
    });
  };

  // Fetch all peers and connect to them
  const fetchAndConnectToPeers = async () => {
    if (!isComponentMounted.current) return;
    if (!peer.current || !peer.current.open) {
      console.log("Cannot fetch peers - not connected to server");
      return;
    }

    // Don't fetch too often if we already have connections
    const openConnections = Object.values(connections.current).filter(
      (conn) => conn && conn.open
    );

    if (openConnections.length > 0) {
      // Reduce polling frequency when we already have connections
      // 70% chance to skip when we already have peers
      if (Math.random() > 0.3) {
        return;
      }
    }

    try {
      const response = await fetch(
        "https://multiplayer.tenant-7654b5-asrpods.ord1.ingress.coreweave.cloud/peerjs/peers"
      );

      if (!response.ok) {
        console.log(
          `Error fetching peers: ${response.status} ${response.statusText}`
        );
        return;
      }

      const peers = await response.json();

      if (!isComponentMounted.current) return;

      // Connect to new peers that we're not already connected to
      if (peers && Array.isArray(peers) && peers.length > 0) {
        console.log(`Discovered ${peers.length} peers on the server`);

        // Get already connected peer IDs
        const connectedPeerIds = Object.keys(connections.current).filter(
          (id) => connections.current[id]?.open
        );

        // Find only new peers to connect to
        const newPeers = peers.filter(
          (remotePeerId) =>
            remotePeerId !== peerId &&
            !connectedPeerIds.includes(remotePeerId) &&
            (!connections.current[remotePeerId]?.lastAttempt ||
              Date.now() - connections.current[remotePeerId].lastAttempt >
                30000)
        );

        if (newPeers.length > 0) {
          console.log(`Found ${newPeers.length} new peers to connect to`);

          // Connect to new peers with a delay between attempts
          for (let i = 0; i < newPeers.length; i++) {
            connectToPeer(newPeers[i]);
            // Add delay between connection attempts to reduce network traffic spikes
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } else {
        console.log("No other peers found on the server");
      }
    } catch (error) {
      console.error("Error fetching peers:", error);
    }
  };

  // Force connection refresh
  const forceRefreshConnections = () => {
    console.log("Forcing connection refresh...");

    // Close all current connections
    Object.entries(connections.current).forEach(([peerId, conn]) => {
      if (conn && conn.open) {
        try {
          conn.close();
        } catch (err) {
          console.error("Error closing connection:", err);
        }
      }

      // Track last attempt time
      connections.current[peerId] = {
        lastAttempt: Date.now(),
        forceClosed: true,
      };
    });

    // Clear all connection intervals
    Object.keys(connectionIntervals.current).forEach((peerId) => {
      clearInterval(connectionIntervals.current[peerId]);
      delete connectionIntervals.current[peerId];
    });

    // Update the UI
    setPeerList([]);

    // Fetch peers again after a short delay
    setTimeout(fetchAndConnectToPeers, 2000);
  };

  // Send a message to all connected peers
  const sendMessage = () => {
    if (!isComponentMounted.current) return;
    if (!messageInput.trim()) return;

    const message = messageInput.trim();

    // Format message to include platform
    const formattedMessageForLog = `${message}`;

    // Get all open connections
    const openConnections = Object.values(connections.current).filter(
      (conn) => conn && conn.open
    );

    if (openConnections.length === 0) {
      console.log("No connected peers to send to!");
      return;
    }

    // Send the message to all connected peers
    let sentCount = 0;
    openConnections.forEach((conn) => {
      try {
        // Just send the raw message text - the receiving end will format it
        conn.send(message);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to a peer: ${err.message}`);
      }
    });

    // Log the sent message to the message log (not a system message)
    // For display, format with platform but no timestamp or peer ID
    logMessage(formattedMessageForLog, false);

    console.log(`Sent "${message}" to ${sentCount} peers`);
    setMessageInput("");
  };

  // Initialize peer when component mounts
  useEffect(() => {
    isComponentMounted.current = true;
    initializePeer();

    // Reduced frequency iOS-specific polling
    let iosRefreshInterval;
    if (platform === "ios") {
      iosRefreshInterval = setInterval(() => {
        const hasOpenConnections = Object.values(connections.current).some(
          (conn) => conn && conn.open
        );

        if (peer.current && peer.current.open && !hasOpenConnections) {
          console.log("iOS extra connection attempt (no open connections)...");
          fetchAndConnectToPeers();
        }
      }, 30000); // Reduced to once every 30 seconds
    }

    // Cleanup when component unmounts
    return () => {
      isComponentMounted.current = false;

      console.log("Component unmounting, cleaning up connections...");

      // Clear all timers
      clearTimeout(reconnectTimeoutRef.current);
      clearInterval(fetchPeersIntervalRef.current);
      if (iosRefreshInterval) clearInterval(iosRefreshInterval);

      // Clear all connection intervals
      Object.keys(connectionIntervals.current).forEach((peerId) => {
        clearInterval(connectionIntervals.current[peerId]);
      });
      connectionIntervals.current = {};

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
  }, [platform]);

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
        color: "black",
      }}
    >
      <h1 style={{ color: "black" }}>Peer-to-Peer Messaging ({platform})</h1>

      <div
        style={{
          backgroundColor: "#f5f5f5",
          padding: "15px",
          borderRadius: "5px",
          marginBottom: "20px",
          color: "black",
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
              color: "black",
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
                      color: "black",
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
                  color: "black",
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
                  color: "black",
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
              color: "black",
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
                    color: "black",
                  }}
                >
                  {msg}
                </div>
              ))
            ) : (
              <div
                style={{
                  color: "black",
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
                color: "white",
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
