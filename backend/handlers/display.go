package handlers

import (
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
)

func RegisterDisplay(c echo.Context) error {
	req := new(models.Display)
	if err := c.Bind(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Generate a 6-digit registration code
	rand.Seed(time.Now().UnixNano())
	code := fmt.Sprintf("%06d", rand.Intn(1000000))

	// Generate a secure secret for the display
	secret := fmt.Sprintf("%x", time.Now().UnixNano()) // Simple secret generation for now
	hashedSecret, _ := auth.HashPassword(secret)

	display := models.Display{
		Name:             req.Name,
		Size:             req.Size,
		BrowserAgent:     req.BrowserAgent,
		RegistrationCode: code,
		IPAddress:        c.RealIP(),
		Status:           "idle",
		Approved:         false,
		Secret:           hashedSecret,
	}

	if err := db.DB.Create(&display).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create display"})
	}

	// Log audit event (System action, no user)
	util.LogAudit(c, "REGISTER", "DISPLAY", display.ID, fmt.Sprintf("Display registered with code %s", code))

	// Return the display with the PLAINTEXT secret (one-time only)
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":                display.ID,
		"name":              display.Name,
		"registration_code": display.RegistrationCode,
		"secret":            secret,
	})
}

func LoginDisplay(c echo.Context) error {
	req := struct {
		ID     uint   `json:"id"`
		Secret string `json:"secret"`
	}{}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var display models.Display
	if err := db.DB.First(&display, req.ID).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	if !auth.CheckPasswordHash(req.Secret, display.Secret) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	token, err := auth.GenerateDisplayToken(display.ID, display.OrganizationID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	return c.JSON(http.StatusOK, map[string]string{"token": token})
}

func ApproveDisplay(c echo.Context) error {
	idStr := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)

	fmt.Printf("Approving display ID: [%s] for Org: %d\n", idStr, user.OrganizationID)

	var display models.Display
	if err := db.DB.First(&display, idStr).Error; err != nil {
		fmt.Printf("Approve failed: Display ID [%s] not found\n", idStr)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}

	display.Approved = true
	display.OrganizationID = user.OrganizationID
	if err := db.DB.Save(&display).Error; err != nil {
		fmt.Printf("Approve failed: Could not save display [%s]: %v\n", idStr, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to approve display"})
	}

	fmt.Printf("Successfully approved display: %d\n", display.ID)
	util.LogAudit(c, "APPROVE", "DISPLAY", display.ID, "Display approved and linked to organization")
	return c.JSON(http.StatusOK, display)
}

func ClaimDisplayByCode(c echo.Context) error {
	req := struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}{}
	if err := c.Bind(&req); err != nil {
		fmt.Printf("Claim failed: Invalid request binding\n")
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request format"})
	}

	user, ok := c.Get("user").(*auth.JwtCustomClaims)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	fmt.Printf("Claiming display with code: [%s] for Org: %d\n", req.Code, user.OrganizationID)

	var display models.Display
	if err := db.DB.Where("registration_code = ? AND (approved = ? OR organization_id = ?)", req.Code, false, 0).First(&display).Error; err != nil {
		fmt.Printf("Claim failed: Code [%s] not found or already approved\n", req.Code)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Invalid registration code or display already claimed"})
	}

	display.Approved = true
	display.OrganizationID = user.OrganizationID
	if req.Name != "" {
		display.Name = req.Name
	}

	if err := db.DB.Save(&display).Error; err != nil {
		fmt.Printf("Failed to save claimed display: %v\n", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to link display to organization"})
	}

	// Ensure display is in "Main" group by default
	var mainGroup models.Group
	if err := db.DB.Where("organization_id = ? AND name = ?", user.OrganizationID, "Main").First(&mainGroup).Error; err != nil {
		mainGroup = models.Group{Name: "Main", OrganizationID: user.OrganizationID}
		db.DB.Create(&mainGroup)
	}
	db.DB.Model(&mainGroup).Association("Displays").Append(&display)

	fmt.Printf("Successfully claimed display: %d (%s) and added to Main group\n", display.ID, display.Name)
	util.LogAudit(c, "CLAIM", "DISPLAY", display.ID, "Display claimed via registration code")
	return c.JSON(http.StatusOK, display)
}

func GetDisplays(c echo.Context) error {
	user, ok := c.Get("user").(*auth.JwtCustomClaims)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var displays []models.Display
	dbQuery := db.DB.Where("organization_id = ?", user.OrganizationID)

	if user.Role != "admin" {
		if len(user.GroupIDs) > 0 {
			dbQuery = dbQuery.Joins("JOIN group_displays ON group_displays.display_id = displays.id").
				Where("group_displays.group_id IN ?", user.GroupIDs)
		} else {
			return c.JSON(http.StatusOK, []models.Display{})
		}
	}

	dbQuery.Preload("Groups.Schedules").Preload("Schedules").Find(&displays)
	return c.JSON(http.StatusOK, displays)
}

func GetPendingDisplays(c echo.Context) error {
	user, ok := c.Get("user").(*auth.JwtCustomClaims)
	if !ok || user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Admin only"})
	}

	var displays []models.Display
	db.DB.Where("organization_id = 0 OR approved = ?", false).Find(&displays)
	return c.JSON(http.StatusOK, displays)
}

func GetDisplayStatus(c echo.Context) error {
	idStr := c.Param("id")
	fmt.Printf("Checking status for display ID: [%s]\n", idStr)

	var display models.Display
	if err := db.DB.Preload("Organization").First(&display, idStr).Error; err != nil {
		fmt.Printf("Display ID [%s] not found in DB\n", idStr)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}
	return c.JSON(http.StatusOK, display)
}

func ReportHeartbeat(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	idStr := c.Param("id")

	// Verify the token belongs to this display (or an admin)
	if fmt.Sprintf("%d", user.DisplayID) != idStr && user.Role != "admin" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	var display models.Display
	if err := db.DB.First(&display, idStr).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}

	display.LastSeen = time.Now()
	display.Status = "online"
	db.DB.Save(&display)

	return c.NoContent(http.StatusOK)
}

func GetDisplayContent(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	idStr := c.Param("id")

	// Verify the token belongs to this display
	if fmt.Sprintf("%d", user.DisplayID) != idStr {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	var display models.Display
	if err := db.DB.Preload("Groups").First(&display, idStr).Error; err != nil {
		fmt.Printf("GetContent failed: Display ID [%s] not found\n", idStr)
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}

	if !display.Approved {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Display not approved"})
	}

	// Get all group IDs for this display
	var groupIDs []uint
	for _, g := range display.Groups {
		groupIDs = append(groupIDs, g.ID)
	}
	var schedules []models.Schedule
	// Query schedules that either:
	// 1. Directly target this display
	// 2. Target any group this display belongs to
	// 3. Are "Global" (no specific displays OR groups selected)
	query := db.DB.Preload("Playlist.Slides.Slide").
		Where("organization_id = ?", display.OrganizationID)

	targetClause := "(id IN (SELECT schedule_id FROM schedule_displays WHERE display_id = ?))"
	targetClause += " OR (id NOT IN (SELECT schedule_id FROM schedule_displays) AND id NOT IN (SELECT schedule_id FROM schedule_groups))"

	if len(groupIDs) > 0 {
		targetClause = "(" + targetClause + " OR id IN (SELECT schedule_id FROM schedule_groups WHERE group_id IN (?)))"
		query = query.Where(targetClause, display.ID, groupIDs)
	} else {
		query = query.Where(targetClause, display.ID)
	}

	err := query.Order("created_at DESC").Find(&schedules).Error

	if err != nil {
		// Fallback if no specific schedules found
		return c.JSON(http.StatusOK, []models.Schedule{})
	}

	return c.JSON(http.StatusOK, schedules)
}

func SendDisplayCommand(c echo.Context) error {
	idStr := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)

	var display models.Display
	if err := db.DB.Where("id = ? AND organization_id = ?", idStr, user.OrganizationID).First(&display).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}

	req := struct {
		Command string      `json:"command"`
		Payload interface{} `json:"payload"`
	}{}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid command request"})
	}

	// Route to WebSocket
	NotifyDisplay(idStr, req.Command, req.Payload)

	idUint, _ := strconv.Atoi(idStr)
	util.LogAudit(c, "SEND_COMMAND", "DISPLAY", uint(idUint), fmt.Sprintf("Command: %s", req.Command))

	return c.NoContent(http.StatusOK)
}

func UploadDisplayScreenshot(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	idStr := c.Param("id")

	// Verify the token belongs to this display
	if fmt.Sprintf("%d", user.DisplayID) != idStr {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Unauthorized"})
	}

	file, err := c.FormFile("screenshot")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Missing screenshot file"})
	}

	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	// Use storage package or local path
	filename := fmt.Sprintf("screenshot_%s_%d.jpg", idStr, time.Now().Unix())
	dstPath := "uploads/" + filename
	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return err
	}

	// Update DB
	db.DB.Model(&models.Display{}).Where("id = ?", idStr).Update("last_screenshot", "/api/uploads/"+filename)

	return c.JSON(http.StatusOK, map[string]string{"path": "/api/uploads/" + filename})
}

func DeleteDisplay(c echo.Context) error {
	idStr := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)

	// Authorization check: Admin or Org Owner
	if user.Role != "admin" {
		// If not admin, verify ownership via OrganizationID (already implicit in queries but good to be explicit)
		// For now, we'll rely on the organization_id check in the query
	}

	var display models.Display
	if err := db.DB.Where("id = ? AND organization_id = ?", idStr, user.OrganizationID).First(&display).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}

	// Delete associations if necessary (e.g. remove from groups, schedules)
	// GORM's cascading delete might handle some, but explicit cleanup is safer
	db.DB.Model(&display).Association("Groups").Clear()

	if err := db.DB.Delete(&display).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete display"})
	}

	util.LogAudit(c, "DELETE", "DISPLAY", display.ID, "Display deleted")

	return c.NoContent(http.StatusOK)
}

func UpdateDisplay(c echo.Context) error {
	idStr := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)

	var display models.Display
	if err := db.DB.Where("id = ? AND organization_id = ?", idStr, user.OrganizationID).First(&display).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Display not found"})
	}

	req := struct {
		Name              string `json:"name"`
		AllowLocalPairing *bool  `json:"allow_local_pairing"`
	}{}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.Name != "" {
		display.Name = req.Name
	}
	if req.AllowLocalPairing != nil {
		display.AllowLocalPairing = *req.AllowLocalPairing
	}

	if err := db.DB.Save(&display).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update display"})
	}

	return c.JSON(http.StatusOK, display)
}
