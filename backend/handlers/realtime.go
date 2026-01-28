package handlers

import (
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
)

func HandleWS(c echo.Context) error {
	displayID := c.QueryParam("display_id")
	tokenStr := c.QueryParam("token")

	if displayID == "" {
		return c.String(http.StatusBadRequest, "Missing display_id")
	}

	// Verify Token
	token, err := jwt.ParseWithClaims(tokenStr, &auth.JwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		return auth.GetJWTSecret(), nil
	})

	if err != nil || !token.Valid {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or expired token"})
	}

	claims, ok := token.Claims.(*auth.JwtCustomClaims)
	if !ok || fmt.Sprintf("%d", claims.DisplayID) != displayID {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
	}

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	clientsMu.Lock()
	clients[displayID] = ws
	clientsMu.Unlock()

	defer func() {
		clientsMu.Lock()
		delete(clients, displayID)
		clientsMu.Unlock()
	}()

	for {
		// Read message from display (e.g. heartbeat or status)
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Printf("WS error for display %s: %v", displayID, err)
			break
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

func HandlePoll(c echo.Context) error {
	// Simple long polling placeholder
	// In a real implementation, this would wait for a signal
	displayID := c.QueryParam("display_id")
	log.Printf("Long poll request from display %s", displayID)

	// Wait for a short duration or a signal
	time.Sleep(10 * time.Second)

	return c.JSON(http.StatusOK, map[string]string{"status": "no_change"})
}
