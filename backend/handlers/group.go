package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/maltob/misignage/auth"
	"github.com/maltob/misignage/db"
	"github.com/maltob/misignage/models"
	"github.com/maltob/misignage/util"
)

func CreateGroup(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	group := new(models.Group)
	if err := c.Bind(group); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}
	group.OrganizationID = user.OrganizationID

	if err := db.DB.Create(group).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create group"})
	}

	util.LogAudit(c, "CREATE", "GROUP", group.ID, fmt.Sprintf("Created group: %s", group.Name))

	return c.JSON(http.StatusCreated, group)
}

func GetGroups(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	var groups []models.Group
	db.DB.Preload("Displays").Preload("Playlists").Preload("Slides").Where("organization_id = ?", user.OrganizationID).Find(&groups)
	return c.JSON(http.StatusOK, groups)
}

func DeleteGroup(c echo.Context) error {
	id := c.Param("id")
	if err := db.DB.Delete(&models.Group{}, id).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete group"})
	}

	util.LogAudit(c, "DELETE", "GROUP", 0, fmt.Sprintf("Deleted group ID: %s", id))

	return c.NoContent(http.StatusOK)
}

func AddToGroup(c echo.Context) error {
	groupID, _ := strconv.Atoi(c.Param("id"))
	req := struct {
		Type string `json:"type"` // display, playlist, slide
		ID   uint   `json:"id"`
	}{}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var group models.Group
	if err := db.DB.First(&group, groupID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Group not found"})
	}

	switch req.Type {
	case "display":
		var display models.Display
		db.DB.First(&display, req.ID)
		db.DB.Model(&group).Association("Displays").Append(&display)
	case "playlist":
		var playlist models.Playlist
		db.DB.First(&playlist, req.ID)
		db.DB.Model(&group).Association("Playlists").Append(&playlist)
	case "slide":
		var slide models.Slide
		db.DB.First(&slide, req.ID)
		db.DB.Model(&group).Association("Slides").Append(&slide)
	}

	util.LogAudit(c, "ADD_TO_GROUP", "GROUP", group.ID, fmt.Sprintf("Added %s %d to group: %s", req.Type, req.ID, group.Name))

	return c.NoContent(http.StatusOK)
}
func RemoveFromGroup(c echo.Context) error {
	groupID, _ := strconv.Atoi(c.Param("id"))
	req := struct {
		Type string `json:"type"` // display, playlist, slide
		ID   uint   `json:"id"`
	}{}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	var group models.Group
	if err := db.DB.First(&group, groupID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Group not found"})
	}

	switch req.Type {
	case "display":
		var display models.Display
		db.DB.First(&display, req.ID)
		db.DB.Model(&group).Association("Displays").Delete(&display)
	case "playlist":
		var playlist models.Playlist
		db.DB.First(&playlist, req.ID)
		db.DB.Model(&group).Association("Playlists").Delete(&playlist)
	case "slide":
		var slide models.Slide
		db.DB.First(&slide, req.ID)
		db.DB.Model(&group).Association("Slides").Delete(&slide)
	}

	return c.NoContent(http.StatusOK)
}
