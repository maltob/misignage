package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/user/misignage/db"
	"github.com/user/misignage/models"
	"gorm.io/gorm"
)

func CreatePlaylist(c echo.Context) error {
	playlist := new(models.Playlist)
	if err := c.Bind(playlist); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if err := db.DB.Create(&playlist).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create playlist"})
	}

	return c.JSON(http.StatusCreated, playlist)
}

func GetPlaylists(c echo.Context) error {
	var playlists []models.Playlist
	db.DB.Preload("Slides.Slide").Find(&playlists)
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
	return c.NoContent(http.StatusOK)
}
