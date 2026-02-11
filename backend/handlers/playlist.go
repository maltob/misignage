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
	"github.com/segmentio/ksuid"
	"gorm.io/gorm"
)

func CreatePlaylist(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	playlist := new(models.Playlist)
	if err := c.Bind(playlist); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Fallback for FormData submissions which Bind (JSON-oriented) might miss
	if playlist.Name == "" {
		playlist.Name = c.FormValue("name")
	}

	playlist.OrganizationID = user.OrganizationID

	if playlist.IsPublic && playlist.PublicSlug == "" {
		playlist.PublicSlug = ksuid.New().String()
	}

	if err := db.DB.Create(&playlist).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create playlist"})
	}

	// Assign groups if provided
	if groupIDs := c.Request().Form["group_ids[]"]; len(groupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", groupIDs).Find(&groups)
		db.DB.Model(&playlist).Association("Groups").Replace(groups)
	}

	util.LogAudit(c, "CREATE", "PLAYLIST", playlist.ID, fmt.Sprintf("Created playlist: %s", playlist.Name))

	return c.JSON(http.StatusCreated, playlist)
}

func GetPlaylists(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	var playlists []models.Playlist
	dbQuery := db.DB.Where("organization_id = ?", user.OrganizationID).Preload("Slides.Slide").Preload("Groups")

	if user.Role != "admin" {
		if len(user.GroupIDs) > 0 {
			dbQuery = dbQuery.Joins("JOIN group_playlists ON group_playlists.playlist_id = playlists.id").
				Where("group_playlists.group_id IN ?", user.GroupIDs)
		} else {
			// If not admin and no groups assigned, return nothing
			return c.JSON(http.StatusOK, []models.Playlist{})
		}
	}

	dbQuery.Find(&playlists)
	return c.JSON(http.StatusOK, playlists)
}

func AddSlideToPlaylist(c echo.Context) error {
	playlistID, _ := strconv.Atoi(c.Param("id"))
	req := struct {
		SlideID  uint `json:"slide_id"`
		Order    int  `json:"order"`
		Duration int  `json:"duration"`
	}{}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ps := models.PlaylistSlide{
		PlaylistID: uint(playlistID),
		SlideID:    req.SlideID,
		Order:      req.Order,
		Duration:   req.Duration,
	}

	if err := db.DB.Create(&ps).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to add slide"})
	}

	return c.JSON(http.StatusCreated, ps)
}

func UpdatePlaylistSlides(c echo.Context) error {
	playlistID, _ := strconv.Atoi(c.Param("id"))
	var req []struct {
		ID       uint `json:"id"`
		SlideID  uint `json:"slide_id"`
		Order    int  `json:"order"`
		Duration int  `json:"duration"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	err := db.DB.Transaction(func(tx *gorm.DB) error {
		var incomingIDs []uint
		for _, s := range req {
			ps := models.PlaylistSlide{
				ID:         s.ID,
				PlaylistID: uint(playlistID),
				SlideID:    s.SlideID,
				Order:      s.Order,
				Duration:   s.Duration,
			}
			if err := tx.Save(&ps).Error; err != nil {
				return err
			}
			incomingIDs = append(incomingIDs, ps.ID)
		}

		// Delete slides not in the update request
		if err := tx.Where("playlist_id = ? AND id NOT IN ?", playlistID, incomingIDs).Delete(&models.PlaylistSlide{}).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update playlist slides"})
	}

	return c.NoContent(http.StatusOK)
}

func DeletePlaylist(c echo.Context) error {
	id := c.Param("id")
	if err := db.DB.Delete(&models.Playlist{}, id).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete playlist"})
	}

	util.LogAudit(c, "DELETE", "PLAYLIST", 0, fmt.Sprintf("Deleted playlist ID: %s", id))

	return c.NoContent(http.StatusOK)
}

func UpdatePlaylist(c echo.Context) error {
	user := c.Get("user").(*auth.JwtCustomClaims)
	id := c.Param("id")
	var playlist models.Playlist
	if err := db.DB.Where("id = ? AND organization_id = ?", id, user.OrganizationID).First(&playlist).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Playlist not found"})
	}

	if name := c.FormValue("name"); name != "" {
		playlist.Name = name
	}

	if c.FormValue("is_public") != "" {
		playlist.IsPublic = c.FormValue("is_public") == "true"
		if playlist.IsPublic && playlist.PublicSlug == "" {
			playlist.PublicSlug = ksuid.New().String()
		}
	}

	if err := db.DB.Save(&playlist).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update playlist"})
	}

	// Update groups if provided
	if groupIDs := c.Request().Form["group_ids[]"]; len(groupIDs) > 0 {
		var groups []models.Group
		db.DB.Where("id IN ?", groupIDs).Find(&groups)
		db.DB.Model(&playlist).Association("Groups").Replace(groups)
	} else if c.FormValue("group_ids_cleared") == "true" {
		db.DB.Model(&playlist).Association("Groups").Clear()
	}

	util.LogAudit(c, "UPDATE", "PLAYLIST", playlist.ID, fmt.Sprintf("Updated playlist: %s", playlist.Name))

	return c.JSON(http.StatusOK, playlist)
}
