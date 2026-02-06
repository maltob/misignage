package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for now
		},
	}
	// displayID -> connection
	clients   = make(map[string]*websocket.Conn)
	clientsMu sync.Mutex

	// userID -> connection (for dashboard updates)
	dashboardClients   = make(map[string]*websocket.Conn)
	dashboardClientsMu sync.Mutex
)

func HandleWS(c echo.Context) error {
	displayID := c.QueryParam("display_id")
	tokenStr := c.QueryParam("token")

	// Verify Token
	token, err := jwt.ParseWithClaims(tokenStr, &auth.JwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		return auth.GetJWTSecret(), nil
	})

	if err != nil || !token.Valid {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or expired token"})
	}

	claims, ok := token.Claims.(*auth.JwtCustomClaims)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
	}

	// Handle Dashboard Users vs Displays
	isDashboardUser := claims.UserID != 0

	// If it's a display, enforce displayID match
	if !isDashboardUser {
		if displayID == "" {
			return c.String(http.StatusBadRequest, "Missing display_id")
		}
		if fmt.Sprintf("%d", claims.DisplayID) != displayID {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
		}
	}

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	if isDashboardUser {
		userID := fmt.Sprintf("%d", claims.UserID)
		dashboardClientsMu.Lock()
		dashboardClients[userID] = ws
		dashboardClientsMu.Unlock()

		defer func() {
			dashboardClientsMu.Lock()
			delete(dashboardClients, userID)
			dashboardClientsMu.Unlock()
		}()
	} else {
		clientsMu.Lock()
		clients[displayID] = ws
		clientsMu.Unlock()

		defer func() {
			clientsMu.Lock()
			delete(clients, displayID)
			clientsMu.Unlock()
		}()
	}

	for {
		// Read message from display (e.g. heartbeat or status)
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Printf("WS error for display %s: %v", displayID, err)
			break
		}

		var incoming struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(msg, &incoming); err == nil {
			if incoming.Type == "screenshare_signal" {
				log.Printf("[WS] Received signal from display: %s", string(incoming.Payload))
				var sig struct {
					SessionID uint   `json:"session_id"`
					Signal    string `json:"signal"`
				}
				if err := json.Unmarshal(incoming.Payload, &sig); err == nil {
					log.Printf("[WS] Routing signal to sharer for session %d", sig.SessionID)
					PostSignalToSharer(sig.SessionID, sig.Signal)
				} else {
					log.Printf("[WS] Failed to unmarshal signal payload: %v", err)
				}
			}
		}

		log.Printf("Received from display %s: %s", displayID, string(msg))
	}

	return nil
}

// NotifyDisplay sends a message to a specific display
func NotifyDisplay(displayID string, msgType string, payload interface{}) {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	if conn, ok := clients[displayID]; ok {
		msg := map[string]interface{}{
			"type":    msgType,
			"payload": payload,
		}
		err := conn.WriteJSON(msg)
		if err != nil {
			log.Printf("Failed to notify display %s: %v", displayID, err)
			conn.Close()
			delete(clients, displayID)
		}
	}
}

// NotifyDashboard sends a message to all connected dashboard users
func NotifyDashboard(msgType string, payload interface{}) {
	dashboardClientsMu.Lock()
	defer dashboardClientsMu.Unlock()

	msg := map[string]interface{}{
		"type":    msgType,
		"payload": payload,
	}

	for userID, conn := range dashboardClients {
		err := conn.WriteJSON(msg)
		if err != nil {
			log.Printf("Failed to notify dashboard user %s: %v", userID, err)
			conn.Close()
			delete(dashboardClients, userID)
		}
	}
}

func HandlePoll(c echo.Context) error {
	// Simple long polling placeholder
	// In a real implementation, this would wait for a signal
	displayID := c.QueryParam("display_id")
	log.Printf("Long poll request from display %s", displayID)

	// Wait for a short duration or a signal
	time.Sleep(10 * time.Second)

	return c.JSON(http.StatusOK, map[string]string{"status": "no_change"})
}
