package handlers

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
)

var (
	// sessionID -> channel for signaling
	activeSignaling = make(map[uint]chan string)
	signalingMu     sync.Mutex
)

// GenerateRandomCode generates a 6-character alphanumeric code
func GenerateRandomCode() string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Avoid ambiguous chars
	b := make([]byte, 6)
	for i := range b {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		b[i] = charset[num.Int64()]
	}
	return string(b)
}

// RequestPairingCode generates a code for a display to show on screen
func RequestPairingCode(c echo.Context) error {
	displayID := c.QueryParam("display_id")
	if displayID == "" {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Missing display_id"})
	}

	var display models.Display
	if err := db.DB.First(&display, displayID).Error; err != nil {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Display not found"})
	}

	code := GenerateRandomCode()
	display.ScreenshareCode = code
	db.DB.Save(&display)

	return c.JSON(http.StatusOK, echo.Map{"code": code})
}

// DirectJoinScreenshare allows an authorized user to share directly to a display they manage
func DirectJoinScreenshare(c echo.Context) error {
	displayIDRaw := c.FormValue("display_id")
	if displayIDRaw == "" {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Missing display_id"})
	}

	displayID, _ := strconv.ParseUint(displayIDRaw, 10, 32)
	user, ok := c.Get("user").(*auth.JwtCustomClaims)
	if !ok {
		return c.JSON(http.StatusUnauthorized, echo.Map{"error": "Unauthorized"})
	}

	var display models.Display
	if err := db.DB.First(&display, displayID).Error; err != nil {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Display not found"})
	}

	// Verify user belongs to same organization as display
	if display.OrganizationID != user.OrganizationID {
		return c.JSON(http.StatusForbidden, echo.Map{"error": "You do not have permission to share to this display"})
	}

	session := models.ScreenshareSession{
		CreatedAt:      time.Now(),
		DisplayID:      display.ID,
		GuestName:      user.Email, // Use user's email from JWT
		OrganizationID: display.OrganizationID,
		IsActive:       true,
		UserID:         &user.UserID,
	}

	if err := db.DB.Create(&session).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to start session"})
	}

	// Initialize signaling
	signalingMu.Lock()
	activeSignaling[session.ID] = make(chan string, 50)
	signalingMu.Unlock()
	log.Printf("[Screenshare] Direct Session %d created by %s for display %d", session.ID, user.Email, display.ID)

	// Send "FORCE_SCREENSHARE" to display via WebSocket
	NotifyDisplay(fmt.Sprintf("%d", display.ID), "FORCE_SCREENSHARE", echo.Map{
		"session_id": session.ID,
		"guest_name": user.Email,
	})

	util.LogAudit(c, "SCREENSHARE_DIRECT_START", "DISPLAY", display.ID, fmt.Sprintf("Direct screenshare started by %s (Session: %d)", user.Email, session.ID))

	// Return session info and ICE configuration
	return c.JSON(http.StatusOK, echo.Map{
		"session_id": session.ID,
		"display_id": display.ID,
		"ice_servers": []echo.Map{
			{"urls": []string{"stun:stun.l.google.com:19302"}},
			{"urls": []string{"stun:stun1.l.google.com:19302"}},
			{"urls": []string{"stun:stun2.l.google.com:19302"}},
			{"urls": []string{"stun:stun.services.mozilla.com"}},
		},
	})
}

// JoinScreenshare handles a browser wanting to share based on a code
func JoinScreenshare(c echo.Context) error {
	code := strings.ToUpper(c.FormValue("code"))
	guestName := c.FormValue("name")

	var display models.Display
	if err := db.DB.Where("screenshare_code = ?", code).First(&display).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, echo.Map{"error": "Invalid pairing code"})
	}

	// Check if OIDC is required (placeholder for now, assume guest allowed)
	// In a full implementation, we'd check against Organization settings or Slide/Display specific flags.

	session := models.ScreenshareSession{
		CreatedAt:      time.Now(),
		Code:           code,
		DisplayID:      display.ID,
		GuestName:      guestName,
		OrganizationID: display.OrganizationID,
		IsActive:       true,
	}

	// If authenticated, link the UserID
	if user, ok := c.Get("user").(*auth.JwtCustomClaims); ok {
		session.UserID = &user.UserID
	}

	if err := db.DB.Create(&session).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, echo.Map{"error": "Failed to start session"})
	}

	// Initialize signaling channel with larger buffer for candidates
	signalingMu.Lock()
	activeSignaling[session.ID] = make(chan string, 50)
	signalingMu.Unlock()
	log.Printf("[Screenshare] Session %d created for display %d", session.ID, display.ID)

	util.LogAudit(c, "SCREENSHARE_START", "DISPLAY", display.ID, fmt.Sprintf("Screenshare started by %s (Session: %d)", guestName, session.ID))

	// Return session info and ICE configuration
	return c.JSON(http.StatusOK, echo.Map{
		"session_id": session.ID,
		"display_id": display.ID,
		"ice_servers": []echo.Map{
			{"urls": []string{"stun:stun.l.google.com:19302"}},
			{"urls": []string{"stun:stun1.l.google.com:19302"}},
			{"urls": []string{"stun:stun2.l.google.com:19302"}},
			{"urls": []string{"stun:stun.services.mozilla.com"}},
		},
	})
}

// SignalSharer receives signals from the browser (sharer) and routes them to the display
func SignalSharer(c echo.Context) error {
	id := c.Param("id") // session id
	var msg struct {
		Signal string `json:"signal"`
	}
	if err := c.Bind(&msg); err != nil {
		return err
	}

	var session models.ScreenshareSession
	if err := db.DB.First(&session, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Session not found"})
	}

	log.Printf("[Screenshare] Routing signal to display %d (Session %d)", session.DisplayID, session.ID)
	// Forward to Display via existing WebSocket
	NotifyDisplay(fmt.Sprintf("%d", session.DisplayID), "screenshare_signal", echo.Map{
		"session_id": session.ID,
		"signal":     msg.Signal,
		"guest_name": session.GuestName,
	})

	return c.NoContent(http.StatusOK)
}

// SignalToSharer is a placeholder for the display sending signals back to the browser.
// In this architecture, the browser will likely poll or use a separate WS if needed,
// but for simplicity, let's allow a "ReceiveSignal" endpoint for the browser.
func ReceiveSignal(c echo.Context) error {
	id := c.Param("id") // session id
	val, err := strconv.ParseUint(id, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, echo.Map{"error": "Invalid session ID"})
	}
	sessionID := uint(val)

	log.Printf("[Screenshare] Sharer polling for signals (Session %d)", sessionID)
	signalingMu.Lock()
	ch, ok := activeSignaling[sessionID]
	signalingMu.Unlock()

	if !ok {
		return c.JSON(http.StatusNotFound, echo.Map{"error": "Session signaling channel not found"})
	}

	select {
	case signal := <-ch:
		log.Printf("[Screenshare] Delivering signal to sharer (Session %d)", sessionID)
		return c.JSON(http.StatusOK, echo.Map{"signal": signal})
	case <-time.After(30 * time.Second):
		return c.NoContent(http.StatusNoContent)
	}
}

// PostSignalToSharer is called when the Display sends a signal (e.g. ICE candidate) back to the browser
func PostSignalToSharer(sessionID uint, signal string) {
	log.Printf("[Screenshare] Posting signal to channel (Session %d)", sessionID)
	signalingMu.Lock()
	ch, ok := activeSignaling[sessionID]
	signalingMu.Unlock()

	if ok {
		select {
		case ch <- signal:
			log.Printf("[Screenshare] Signal queued for session %d", sessionID)
		default:
			log.Printf("[Screenshare] WARNING: Signaling channel for session %d is full, dropping signal!", sessionID)
		}
	} else {
		log.Printf("[Screenshare] WARNING: Received signal for unknown/closed session %d", sessionID)
	}
}

// GetIceServers returns the STUN/TURN configuration
func GetIceServers(c echo.Context) error {
	// In a real app, these would come from env vars
	// TURN_URL, TURN_USER, TURN_PASS
	return c.JSON(http.StatusOK, []echo.Map{
		{"urls": []string{"stun:stun.l.google.com:19302"}},
		{"urls": []string{"stun:stun1.l.google.com:19302"}},
		{"urls": []string{"stun:stun2.l.google.com:19302"}},
		{"urls": []string{"stun:stun.services.mozilla.com"}},
	})
}
