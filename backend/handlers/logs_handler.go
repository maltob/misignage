package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
)

func GetSystemLogs(c echo.Context) error {
	user := auth.GetUserFromContext(c)

	var logs []models.SystemLog
	query := db.DB.Where("organization_id = ?", user.OrganizationID)

	// Optional filters
	if slideID := c.QueryParam("slide_id"); slideID != "" {
		if id, err := strconv.Atoi(slideID); err == nil {
			query = query.Where("slide_id = ?", id)
		}
	}

	if source := c.QueryParam("source"); source != "" {
		query = query.Where("source = ?", source)
	}

	if level := c.QueryParam("level"); level != "" {
		query = query.Where("level = ?", level)
	}

	// Limit to last 200 logs by default
	query.Order("created_at desc").Limit(200).Find(&logs)

	return c.JSON(http.StatusOK, logs)
}
