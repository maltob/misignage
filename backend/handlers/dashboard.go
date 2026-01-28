package handlers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/user/misignage/auth"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
)

func GetDashboardStats(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)

	var displayCount int64
	var playlistCount int64
	var slideCount int64
	var reportsToday int64

	db.DB.Model(&models.Display{}).Where("organization_id = ?", user.OrganizationID).Count(&displayCount)
	db.DB.Model(&models.Playlist{}).Where("organization_id = ?", user.OrganizationID).Count(&playlistCount)
	db.DB.Model(&models.Slide{}).Where("organization_id = ?", user.OrganizationID).Count(&slideCount)

	// Count displays that checked in today (since midnight)
	now := time.Now()
	beginningOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	db.DB.Model(&models.Display{}).Where("organization_id = ? AND last_seen >= ?", user.OrganizationID, beginningOfDay).Count(&reportsToday)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"total_displays":   displayCount,
		"active_playlists": playlistCount,
		"total_slides":     slideCount,
		"reports_today":    reportsToday,
	})
}
