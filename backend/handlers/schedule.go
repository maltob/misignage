package handlers

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
)

func CreateSchedule(c echo.Context) error {
	req := struct {
		models.Schedule
		DisplayIDs []uint `json:"display_ids"`
		GroupIDs   []uint `json:"group_ids"`
	}{}
	user := c.Get("user").(*auth.JwtCustomClaims)
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	req.Schedule.OrganizationID = user.OrganizationID
	if err := db.DB.Create(&req.Schedule).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create schedule"})
	}

	// Update associations
	if len(req.DisplayIDs) > 0 {
		var displays []models.Display
		db.DB.Where("id IN ?", req.DisplayIDs).Find(&displays)
		db.DB.Model(&req.Schedule).Association("Displays").Replace(displays)
	}
	if len(req.GroupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", req.GroupIDs).Find(&groups)
		db.DB.Model(&req.Schedule).Association("Groups").Replace(groups)
	}

	return c.JSON(http.StatusCreated, req.Schedule)
}

func UpdateSchedule(c echo.Context) error {
	id := c.Param("id")
	req := struct {
		models.Schedule
		DisplayIDs []uint `json:"display_ids"`
		GroupIDs   []uint `json:"group_ids"`
	}{}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var schedule models.Schedule
	if err := db.DB.First(&schedule, id).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Schedule not found"})
	}

	user := c.Get("user").(*auth.JwtCustomClaims)
	db.DB.Model(&schedule).Updates(req.Schedule)
	db.DB.Model(&schedule).Update("organization_id", user.OrganizationID)

	// Update associations
	var displays []models.Display
	db.DB.Where("id IN ?", req.DisplayIDs).Find(&displays)
	db.DB.Model(&schedule).Association("Displays").Replace(displays)

	var groups []models.Group
	db.DB.Where("id IN ?", req.GroupIDs).Find(&groups)
	db.DB.Model(&schedule).Association("Groups").Replace(groups)

	return c.JSON(http.StatusOK, schedule)
}

func GetSchedules(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	var schedules []models.Schedule
	db.DB.Preload("Playlist").Preload("Displays").Preload("Groups").
		Where("organization_id = ?", user.OrganizationID).
		Find(&schedules)

	fmt.Printf("DEBUG: GetSchedules for Org %d found %d schedules\n", user.OrganizationID, len(schedules))
	// Log all schedules in DB for debugging
	var allSchedules []models.Schedule
	db.DB.Find(&allSchedules)
	for _, s := range allSchedules {
		fmt.Printf("DEBUG: Schedule ID %d has OrgID %d\n", s.ID, s.OrganizationID)
	}

	return c.JSON(http.StatusOK, schedules)
}

func DeleteSchedule(c echo.Context) error {
	id := c.Param("id")
	if err := db.DB.Delete(&models.Schedule{}, id).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete schedule"})
	}
	return c.NoContent(http.StatusOK)
}
