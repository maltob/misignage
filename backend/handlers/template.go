package handlers

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
)

func CreateTemplate(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	template := new(models.SlideTemplate)
	if err := c.Bind(template); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}
	template.OrganizationID = user.OrganizationID

	if err := db.DB.Create(template).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create template"})
	}

	util.LogAudit(c, "CREATE", "TEMPLATE", template.ID, fmt.Sprintf("Created HTML template: %s", template.Name))

	return c.JSON(http.StatusCreated, template)
}

func GetTemplates(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	var templates []models.SlideTemplate
	db.DB.Where("organization_id = ? OR organization_id = 0", user.OrganizationID).Find(&templates)
	return c.JSON(http.StatusOK, templates)
}

func DeleteTemplate(c echo.Context) error {
	id := c.Param("id")
	user := c.Get("user").(*auth.JwtCustomClaims)
	if err := db.DB.Where("id = ? AND organization_id = ?", id, user.OrganizationID).Delete(&models.SlideTemplate{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete template"})
	}

	util.LogAudit(c, "DELETE", "TEMPLATE", 0, fmt.Sprintf("Deleted template ID: %s", id))

	return c.NoContent(http.StatusOK)
}
